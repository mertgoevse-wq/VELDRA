// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { remotePreviewRefreshSignal } from '~/lib/stores/remotePreviewSignal';
import { saveAndroidFallbackWorkspace, saveSyncBaseSnapshot } from '~/lib/persistence/androidFallbackStorage';
import { WORK_DIR } from '~/utils/constants';
import { Preview } from '~/components/workbench/Preview';

/**
 * "Real end-to-end creation loop" mandate, Block 1: prove
 *   user prompt -> agent file actions -> real workspace files -> real file sync ->
 *   real Remote Runtime start -> real Preview URL -> Preview renders it -> a second
 *   edit -> re-sync -> Preview reflects the update
 * through every VELDRA-owned layer, using the SAME wiring production uses
 * (workbenchStore.addArtifact()'s real ActionRunner + real FilesStore.saveFile, the real
 * (unmocked) RemoteWorkspaceSync.pushLocalWorkspaceToRemote, a real fake-indexeddb-backed
 * androidFallbackStorage round-trip). Only two boundaries this environment genuinely cannot
 * provide are replaced: the Remote Runtime HTTP server itself (RemoteRuntimeClient's network
 * calls, spied the same way action-runner.spec.ts and Preview.spec.tsx already do) and a real
 * WebContainer/browser sandbox (never reached -- this scenario is Android + Remote Runtime,
 * which routes file/build/start actions through the local-workspace + Remote Runtime bridge,
 * not WebContainer, matching the real product's only currently-working execution path on
 * Android per docs/ai-state/CURRENT_STATE.md).
 */

const REMOTE_ANDROID_STATE = {
  mode: 'remote' as const,
  webContainerAvailable: false,
  isAndroid: true,
  remoteRuntimeUrl: 'https://runtime.example.com',
  remoteAuthToken: 'test-token',
  remoteWorkspaceId: 'workspace-1',
  capabilities: {
    fileSystem: true,
    terminal: true,
    commandExecution: false,
    agentBuildCommands: true,
    packageInstall: true,
    devServer: true,
    preview: true,
    persistentFileSystem: false,
  },
  autoDetected: false,
};

describe('Real creation loop, end-to-end (files -> sync -> remote start -> live preview -> edit -> refresh)', () => {
  const originalRuntime = runtimeModeStore.get();
  let artifactCounter = 0;

  beforeEach(async () => {
    runtimeModeStore.set(REMOTE_ANDROID_STATE);
    workbenchStore.files.set({});
    await saveAndroidFallbackWorkspace({}, []);
    await saveSyncBaseSnapshot({});

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
    runtimeModeStore.set(originalRuntime);
    remotePreviewRefreshSignal.set(0);
    vi.restoreAllMocks();
  });

  it('drives a real prompt-to-preview loop, then a real second edit, with no fabricated success anywhere', async () => {
    artifactCounter += 1;

    const messageId = `msg-${artifactCounter}`;
    const artifactId = `artifact-${artifactCounter}`;

    // Step 1-6: agent "responds" to the prompt by issuing real file actions.
    workbenchStore.addArtifact({ messageId, title: 'Build a todo app', id: artifactId, type: 'bundled' });

    const runner = workbenchStore.artifacts.get()[artifactId]?.runner;
    expect(runner).toBeDefined();

    const fileAction = {
      artifactId,
      messageId,
      actionId: 'write-index',
      action: { type: 'file', filePath: 'index.html', content: '<html><body>Todo App v1</body></html>' },
    } as const;

    runner!.addAction(fileAction);
    await runner!.runAction(fileAction);

    // Step 7 (proof): the real workbench file store now genuinely holds the generated file.
    const writtenPath = `${WORK_DIR}/index.html`;
    const writtenFile = workbenchStore.files.get()[writtenPath];
    expect(writtenFile?.type).toBe('file');
    expect(writtenFile?.type === 'file' ? writtenFile.content : undefined).toBe(
      '<html><body>Todo App v1</body></html>',
    );

    /*
     * Step 7-9: agent starts the dev server. Only the real HTTP boundary is replaced -- with a
     * genuinely stateful fake (push now reads remote state via listFiles for real three-way
     * conflict detection, so the fake must actually remember what syncFiles wrote, not just
     * report success blindly).
     */
    const remoteFilesState: Record<string, string> = {};
    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockImplementation(async () => ({
      files: Object.entries(remoteFilesState).map(([path, content]) => ({
        path,
        type: 'file' as const,
        content,
        isBinary: false,
      })),
    }));

    const syncFiles = vi
      .spyOn(RemoteRuntimeClient.prototype, 'syncFiles')
      .mockImplementation(async (files, deletedPaths) => {
        for (const [path, content] of Object.entries(files)) {
          remoteFilesState[path] = content;
        }

        for (const path of deletedPaths ?? []) {
          delete remoteFilesState[path];
        }

        return { ok: true, writtenFileCount: Object.keys(files).length, files: [] };
      });
    const runCommand = vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockResolvedValue({
      commandId: 'cmd-start-1',
      commandProfile: 'npm run dev',
      workspaceId: 'workspace-1',
      status: 'running',
      startedAt: new Date(0).toISOString(),
    });

    const startAction = {
      artifactId,
      messageId,
      actionId: 'start-dev-server',
      action: { type: 'start', content: 'npm run dev' },
    } as const;

    runner!.addAction(startAction);
    await runner!.runAction(startAction);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Step 7 (proof): sync genuinely carried the real file content generated above, not a stub.
    expect(syncFiles).toHaveBeenCalledWith(
      expect.objectContaining({ 'index.html': '<html><body>Todo App v1</body></html>' }),
      [],
    );

    // Step 9: the real, safe command-profile bridge actually ran.
    expect(runCommand).toHaveBeenCalledWith('npm run dev');
    expect(runner!.actions.get()['start-dev-server']?.status).toBe('complete');

    // Step 10 (proof): starting the server really told Preview to re-check, not just internally.
    expect(remotePreviewRefreshSignal.get()).toBe(1);

    // Step 10-13: Preview mounts, discovers the real running server, and renders it.
    vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl').mockResolvedValue({
      ok: true,
      status: 'running',
      previewUrl: 'https://preview.example.com/workspace-1',
      port: 5173,
      message: 'Dev server running.',
    });

    render(<Preview />);

    const iframe = await screen.findByTitle('remote-preview');
    expect(iframe).toHaveAttribute('src', 'https://preview.example.com/workspace-1');

    // Step 16: a second real user request modifies the project.
    const secondFileAction = {
      artifactId,
      messageId,
      actionId: 'write-index-v2',
      action: {
        type: 'file',
        filePath: 'index.html',
        content: '<html><body>Todo App v2 - added dark mode</body></html>',
      },
    } as const;

    runner!.addAction(secondFileAction);
    await runner!.runAction(secondFileAction);

    const updatedFile = workbenchStore.files.get()[writtenPath];
    expect(updatedFile?.type === 'file' ? updatedFile.content : undefined).toBe(
      '<html><body>Todo App v2 - added dark mode</body></html>',
    );

    // The agent re-syncs and restarts (a real second start action, same as the first).
    const restartAction = {
      artifactId,
      messageId,
      actionId: 'restart-dev-server',
      action: { type: 'start', content: 'npm run dev' },
    } as const;

    runner!.addAction(restartAction);
    await runner!.runAction(restartAction);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Step 7 (proof, round 2): the SECOND sync carried the SECOND edit's real content.
    expect(syncFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ 'index.html': '<html><body>Todo App v2 - added dark mode</body></html>' }),
      [],
    );
    expect(remotePreviewRefreshSignal.get()).toBe(2);
  }, 15000);

  it('represents a real build failure honestly end-to-end: the agent-visible action state fails, Preview never claims success', async () => {
    artifactCounter += 1;

    const messageId = `msg-${artifactCounter}`;
    const artifactId = `artifact-${artifactCounter}`;

    workbenchStore.addArtifact({ messageId, title: 'Build a broken app', id: artifactId, type: 'bundled' });

    const runner = workbenchStore.artifacts.get()[artifactId]?.runner;

    const fileAction = {
      artifactId,
      messageId,
      actionId: 'write-broken',
      action: { type: 'file', filePath: 'index.html', content: '<html>' },
    } as const;
    runner!.addAction(fileAction);
    await runner!.runAction(fileAction);

    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({ files: [] });
    vi.spyOn(RemoteRuntimeClient.prototype, 'syncFiles').mockResolvedValue({
      ok: true,
      writtenFileCount: 1,
      files: [],
    });
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockResolvedValue({
      commandId: 'cmd-build-fail',
      commandProfile: 'npm run build',
      workspaceId: 'workspace-1',
      status: 'running',
      startedAt: new Date(0).toISOString(),
    });
    vi.spyOn(RemoteRuntimeClient.prototype, 'getCommandStatus').mockResolvedValue({
      commandId: 'cmd-build-fail',
      commandProfile: 'npm run build',
      workspaceId: 'workspace-1',
      status: 'exited',
      startedAt: new Date(0).toISOString(),
      exitCode: 1,
      error: 'npm ERR! Missing script: "build"',
    });

    const buildAction = {
      artifactId,
      messageId,
      actionId: 'build-broken',
      action: { type: 'build', content: '' },
    } as const;
    runner!.addAction(buildAction);
    await runner!.runAction(buildAction);

    expect(runner!.actions.get()['build-broken']?.status).toBe('failed');

    // A failed build must never fire the Preview refresh signal -- there is nothing to preview.
    expect(remotePreviewRefreshSignal.get()).toBe(0);

    // Preview, checked independently, also reports the real "not running" state -- never invents one.
    vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl').mockResolvedValue({
      ok: true,
      status: 'none',
      message: 'No dev server detected yet.',
    });

    render(<Preview />);

    await waitFor(() => expect(screen.getByText('Live Preview Unavailable')).toBeInTheDocument());
    expect(screen.queryByTitle('remote-preview')).not.toBeInTheDocument();
  }, 15000);
});
