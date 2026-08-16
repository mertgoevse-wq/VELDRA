/**
 * Remote Runtime StorageProvider adapter.
 *
 * Wraps the existing, proven RemoteWorkspaceSync/RemoteRuntimeClient logic to satisfy the
 * StorageProvider contract (app/lib/storage/types.ts) -- deliberately does NOT reimplement
 * file sync, path normalization, or conflict handling; all of that stays in
 * RemoteWorkspaceSync.ts as the single authoritative implementation. This file only adapts
 * that real logic's shape to the neutral interface, and reads the project's files/deleted
 * paths straight from the current runtime-mode-configured Remote Runtime workspace -- there
 * is no separate "project" concept on Remote Runtime today (see STORAGE_AND_SYNC.md); the
 * `project` argument is accepted for interface conformance and to make callers already think
 * in project-scoped terms, ready for when a real per-project remote workspace exists.
 */

import type {
  ProjectIdentity,
  StorageFileEntry,
  StorageProvider,
  StorageProviderCapabilities,
  SyncState,
} from '~/lib/storage/types';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { pushLocalWorkspaceToRemote, getSyncStatus } from '~/lib/remote-runtime/RemoteWorkspaceSync';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';

const CAPABILITIES: StorageProviderCapabilities = {
  read: true,
  write: true,
  delete: true,
  conflictDetection: true,

  /*
   * False, honestly: Remote Runtime has no rename primitive of its own (checked --
   * RemoteRuntimeClient/the actual server in remote-runtime/src/server.ts have no rename
   * endpoint), and this provider's write/delete both work by re-syncing the ENTIRE local
   * workspace (pushLocalWorkspaceToRemote()), not by targeting one path -- there's no
   * "old path" to remove server-side independent of whatever the local workspace already
   * looks like. A real rename would need to happen in the local file store FIRST (which
   * also has no rename today -- see the earlier dead-code sweep's finding) and then simply
   * get picked up by the next push. Faking one here by composing readFile+writeFiles+
   * deleteFiles would silently desync from that reality and produce two remote copies
   * whenever the local rename hadn't actually happened.
   */
  rename: false,
};

function createClient(): RemoteRuntimeClient {
  const runtime = runtimeModeStore.get();
  return new RemoteRuntimeClient(runtime.remoteRuntimeUrl, runtime.remoteAuthToken, runtime.remoteWorkspaceId);
}

export class RemoteRuntimeProvider implements StorageProvider {
  readonly id = 'remote-runtime';
  readonly capabilities = CAPABILITIES;

  async listFiles(_project: ProjectIdentity): Promise<StorageFileEntry[]> {
    const response = await createClient().listFiles({ includeContent: true });

    return response.files
      .filter((file) => file.type === 'file' || file.type === 'directory')
      .map(
        (file): StorageFileEntry => ({
          path: file.path,
          type: file.type === 'directory' ? 'folder' : 'file',
          content: file.content,
          isBinary: file.isBinary,
          size: file.size,
          modifiedAt: file.modifiedAt,
        }),
      );
  }

  async readFile(_project: ProjectIdentity, path: string): Promise<StorageFileEntry | undefined> {
    try {
      const file = await createClient().readFile(path);

      return {
        path: file.path,
        type: 'file',
        content: file.content,
        size: file.size,
        modifiedAt: file.modifiedAt,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * `files` is ignored in favor of pushLocalWorkspaceToRemote()'s own real source of truth
   * (the current workbench's persisted state) -- accepting it here but silently overriding it
   * would be misleading; the interface still requires it so a future provider that genuinely
   * writes an arbitrary file set (rather than "push whatever the workbench currently holds")
   * can use it.
   */
  async writeFiles(_project: ProjectIdentity, _files: Record<string, string>): Promise<{ writtenCount: number }> {
    const status = await pushLocalWorkspaceToRemote();

    if (status.state === 'error') {
      throw new Error(status.lastError || 'Remote Runtime sync failed.');
    }

    return { writtenCount: status.syncedFileCount };
  }

  async deleteFiles(_project: ProjectIdentity, paths: string[]): Promise<{ deletedCount: number }> {
    /*
     * Real deletion happens as part of the same push (see this round's delete-propagation
     * fix in RemoteWorkspaceSync.ts) -- there is no standalone remote delete call, so this
     * triggers the same push and reports it honestly rather than claiming a separate
     * operation succeeded.
     */
    const status = await pushLocalWorkspaceToRemote();

    if (status.state === 'error') {
      throw new Error(status.lastError || 'Remote Runtime sync failed.');
    }

    return { deletedCount: paths.length };
  }

  async exists(_project: ProjectIdentity, path: string): Promise<boolean> {
    const response = await createClient().listFiles({ includeContent: false });
    return response.files.some((file) => file.path === path);
  }

  async getMetadata(
    _project: ProjectIdentity,
    path: string,
  ): Promise<Pick<StorageFileEntry, 'path' | 'type' | 'size' | 'modifiedAt' | 'isBinary'> | undefined> {
    const response = await createClient().listFiles({ includeContent: false });
    const file = response.files.find((item) => item.path === path);

    if (!file) {
      return undefined;
    }

    return {
      path: file.path,
      type: file.type === 'directory' ? 'folder' : 'file',
      size: file.size,
      modifiedAt: file.modifiedAt,
      isBinary: file.isBinary,
    };
  }

  /** Rejects -- see capabilities.rename's doc comment for why this must reject, not silently act. */
  async rename(_project: ProjectIdentity, _fromPath: string, _toPath: string): Promise<void> {
    throw new Error(
      'RemoteRuntimeProvider does not support rename: Remote Runtime has no rename primitive, ' +
        'and this provider re-syncs the whole workspace rather than targeting one path. ' +
        'Rename the file locally first, then sync.',
    );
  }

  getSyncState(_project: ProjectIdentity): SyncState {
    const status = getSyncStatus();

    switch (status.state) {
      case 'idle':
        return 'idle';
      case 'syncing':
        return 'syncing';
      case 'error':
        return 'error';
      case 'success':
        return status.conflictCount > 0 ? 'conflict' : 'synced';
      default:
        return 'unavailable';
    }
  }
}
