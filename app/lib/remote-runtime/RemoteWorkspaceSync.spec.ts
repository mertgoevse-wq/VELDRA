// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pushLocalWorkspaceToRemote, pullRemoteWorkspaceToLocal } from './RemoteWorkspaceSync';
import { RemoteRuntimeClient } from './RemoteRuntimeClient';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { workbenchStore } from '~/lib/stores/workbench';
import {
  saveAndroidFallbackWorkspace,
  loadAndroidFallbackState,
  saveSyncBaseSnapshot,
} from '~/lib/persistence/androidFallbackStorage';
import { WORK_DIR } from '~/utils/constants';

/**
 * Block 4 of the multi-file consistency mandate: a locally-deleted file never told the Remote
 * Runtime server it was gone (server had no delete capability at all), and a pull could
 * silently resurrect a file the user had explicitly deleted (the pull merge only checked for
 * a CONTENT mismatch against a local file, and a deleted file has no local file, so it never
 * matched that check). Both are fixed together here since they're the same root cause: delete
 * state never crossed the sync boundary. Uses the real (unmocked) sync functions against a
 * real fake-indexeddb-backed persistence layer, only the Remote Runtime HTTP client is spied.
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

describe('RemoteWorkspaceSync -- delete propagation', () => {
  const originalRuntime = runtimeModeStore.get();

  beforeEach(async () => {
    runtimeModeStore.set(REMOTE_STATE);
    workbenchStore.files.set({});
    await saveAndroidFallbackWorkspace({}, []);
    await saveSyncBaseSnapshot({});
  });

  afterEach(() => {
    runtimeModeStore.set(originalRuntime);
    vi.restoreAllMocks();
  });

  it('push sends locally-deleted paths to the remote server alongside the file write', async () => {
    await saveAndroidFallbackWorkspace(
      { [`${WORK_DIR}/index.html`]: { type: 'file', content: '<html></html>', isBinary: false } },
      [`${WORK_DIR}/old-file.js`],
    );

    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({ files: [] });

    const syncFiles = vi.spyOn(RemoteRuntimeClient.prototype, 'syncFiles').mockResolvedValue({
      ok: true,
      writtenFileCount: 1,
      deletedFileCount: 1,
      files: [],
    });

    const status = await pushLocalWorkspaceToRemote();

    expect(syncFiles).toHaveBeenCalledWith(expect.objectContaining({ 'index.html': '<html></html>' }), ['old-file.js']);
    expect(status.state).toBe('success');
  });

  it('does not send a deletedPaths argument at all when nothing was deleted (no behavior change for the common case)', async () => {
    await saveAndroidFallbackWorkspace(
      { [`${WORK_DIR}/index.html`]: { type: 'file', content: '<html></html>', isBinary: false } },
      [],
    );

    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({ files: [] });

    const syncFiles = vi
      .spyOn(RemoteRuntimeClient.prototype, 'syncFiles')
      .mockResolvedValue({ ok: true, writtenFileCount: 1, files: [] });

    await pushLocalWorkspaceToRemote();

    expect(syncFiles).toHaveBeenCalledWith(expect.objectContaining({ 'index.html': '<html></html>' }), []);
  });

  it('push does not overwrite a file that was modified remotely since the last sync (real conflict, no data loss)', async () => {
    // First sync: local and remote agree, establishing a base snapshot.
    await saveAndroidFallbackWorkspace(
      { [`${WORK_DIR}/shared.js`]: { type: 'file', content: 'original', isBinary: false } },
      [],
    );
    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({
      files: [{ path: 'shared.js', type: 'file', content: 'original', isBinary: false }],
    });
    vi.spyOn(RemoteRuntimeClient.prototype, 'syncFiles').mockResolvedValue({
      ok: true,
      writtenFileCount: 0,
      files: [],
    });
    await pushLocalWorkspaceToRemote();
    vi.restoreAllMocks();

    // Now local edits shared.js, AND remote is discovered to have independently changed too.
    await saveAndroidFallbackWorkspace(
      { [`${WORK_DIR}/shared.js`]: { type: 'file', content: 'local edit', isBinary: false } },
      [],
    );
    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({
      files: [{ path: 'shared.js', type: 'file', content: 'remote edit', isBinary: false }],
    });

    const secondSyncFiles = vi
      .spyOn(RemoteRuntimeClient.prototype, 'syncFiles')
      .mockResolvedValue({ ok: true, writtenFileCount: 0, files: [] });

    const status = await pushLocalWorkspaceToRemote();

    // syncFiles must never be called with shared.js as a write -- that would clobber the remote edit.
    expect(secondSyncFiles).not.toHaveBeenCalledWith(expect.objectContaining({ 'shared.js': expect.anything() }), []);
    expect(status.conflicts).toContainEqual(
      expect.objectContaining({ path: 'shared.js', reason: expect.stringContaining('changed this file differently') }),
    );
  });

  it('pull does NOT resurrect a file the user explicitly deleted locally, and records it as a real conflict', async () => {
    await saveAndroidFallbackWorkspace({}, [`${WORK_DIR}/deleted.js`]);

    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({
      files: [{ path: 'deleted.js', type: 'file', content: 'console.log("stale")', isBinary: false }],
    });

    const status = await pullRemoteWorkspaceToLocal();

    expect(status.state).toBe('success');
    expect(status.conflicts).toContainEqual(
      expect.objectContaining({ path: 'deleted.js', reason: expect.stringContaining('deleted locally') }),
    );

    const localState = await loadAndroidFallbackState();
    expect(localState.workspace.files[`${WORK_DIR}/deleted.js`]).toBeUndefined();
  });

  it('pull still restores a file that was never deleted locally (no regression on the normal pull path)', async () => {
    await saveAndroidFallbackWorkspace({}, []);

    vi.spyOn(RemoteRuntimeClient.prototype, 'listFiles').mockResolvedValue({
      files: [{ path: 'new-from-remote.js', type: 'file', content: 'console.log("hi")', isBinary: false }],
    });

    const status = await pullRemoteWorkspaceToLocal();

    expect(status.state).toBe('success');
    expect(status.conflicts).toEqual([]);

    const localState = await loadAndroidFallbackState();
    expect(localState.workspace.files[`${WORK_DIR}/new-from-remote.js`]?.content).toBe('console.log("hi")');
  });
});
