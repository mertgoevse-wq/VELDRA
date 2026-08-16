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
