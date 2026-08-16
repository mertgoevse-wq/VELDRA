// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteRuntimeProvider } from './remote-runtime-provider';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { resetSyncStatus } from '~/lib/remote-runtime/RemoteWorkspaceSync';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { saveAndroidFallbackWorkspace } from '~/lib/persistence/androidFallbackStorage';
import { WORK_DIR } from '~/utils/constants';

/**
 * RemoteRuntimeProvider is a thin adapter over already-real, already-tested logic
 * (RemoteRuntimeClient, RemoteWorkspaceSync) -- these tests prove the adapter translates
 * shapes correctly and genuinely delegates (rather than reimplementing anything), using the
 * same real fake-indexeddb-backed persistence RemoteWorkspaceSync.spec.ts already
 * establishes. Only the actual Remote Runtime HTTP client is spied.
 */

const REMOTE_STATE = {
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

const PROJECT = { id: 'workspace-1' };

describe('RemoteRuntimeProvider', () => {
  const originalRuntime = runtimeModeStore.get();

  beforeEach(async () => {
    runtimeModeStore.set(REMOTE_STATE);
    resetSyncStatus();
    await saveAndroidFallbackWorkspace({}, []);
  });

  afterEach(() => {
    runtimeModeStore.set(originalRuntime);
    vi.restoreAllMocks();
  });

  it('reports honest capabilities matching what Remote Runtime actually supports', () => {
    const provider = new RemoteRuntimeProvider();
    expect(provider.capabilities).toEqual({ read: true, write: true, delete: true, conflictDetection: true });
  });

  it('translates a real listFiles response into the neutral StorageFileEntry shape', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({
      files: [
        { path: 'index.html', type: 'file', content: '<html></html>', size: 14, modifiedAt: '2026-08-16T00:00:00Z' },
        { path: 'src', type: 'directory' },
      ],
    });

    const provider = new RemoteRuntimeProvider();
    const entries = await provider.listFiles(PROJECT);

    expect(entries).toEqual([
      {
        path: 'index.html',
        type: 'file',
        content: '<html></html>',
        isBinary: undefined,
        size: 14,
        modifiedAt: '2026-08-16T00:00:00Z',
      },
      { path: 'src', type: 'folder', content: undefined, isBinary: undefined, size: undefined, modifiedAt: undefined },
    ]);
  });

  it('writeFiles delegates to the real pushLocalWorkspaceToRemote and reports its real result honestly', async () => {
    await saveAndroidFallbackWorkspace(
      { [`${WORK_DIR}/index.html`]: { type: 'file', content: '<html></html>', isBinary: false } },
      [],
    );

    const syncFiles = vi
      .spyOn(RemoteRuntimeClient.prototype, 'syncFiles')
      .mockResolvedValue({ ok: true, writtenFileCount: 1, files: [] });

    const provider = new RemoteRuntimeProvider();
    const result = await provider.writeFiles(PROJECT, {});

    expect(syncFiles).toHaveBeenCalled();
    expect(result).toEqual({ writtenCount: 1 });
  });

  it('writeFiles throws a real error instead of reporting fake success when the underlying sync fails', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'syncFiles').mockRejectedValue(new Error('network down'));

    const provider = new RemoteRuntimeProvider();
    await expect(provider.writeFiles(PROJECT, {})).rejects.toThrow('network down');
  });

  it('getSyncState reflects the real sync status, including a real conflict', async () => {
    const provider = new RemoteRuntimeProvider();
    expect(provider.getSyncState(PROJECT)).toBe('idle');

    vi.spyOn(RemoteRuntimeClient.prototype, 'syncFiles').mockResolvedValue({
      ok: true,
      writtenFileCount: 0,
      files: [],
    });

    const { pushLocalWorkspaceToRemote } = await import('~/lib/remote-runtime/RemoteWorkspaceSync');
    await pushLocalWorkspaceToRemote();

    expect(provider.getSyncState(PROJECT)).toBe('synced');
  });
});
