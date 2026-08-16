/**
 * Local (IndexedDB fallback) StorageProvider adapter.
 *
 * Wraps the existing androidFallbackStorage.ts persistence -- does not reimplement IndexedDB
 * access. Honest limitation, carried over rather than hidden: androidFallbackStorage.ts has
 * no per-project scoping today (confirmed by direct trace -- it stores one single global
 * workspace under a fixed key, not one per chat/project). This adapter's `project` argument
 * is therefore accepted for interface conformance only; every call operates on that one
 * global local workspace, the same real behavior the rest of the app already has. Making
 * this a real per-project local store is future work (see docs/architecture/STORAGE_AND_SYNC.md),
 * not something to fake here.
 */

import type {
  ProjectIdentity,
  StorageFileEntry,
  StorageProvider,
  StorageProviderCapabilities,
  SyncState,
} from '~/lib/storage/types';
import {
  loadAndroidFallbackState,
  saveAndroidFallbackWorkspace,
  type PersistedDirent,
} from '~/lib/persistence/androidFallbackStorage';

const CAPABILITIES: StorageProviderCapabilities = {
  read: true,
  write: true,
  delete: true,

  /*
   * A single local copy has nothing to conflict against -- conflicts only exist relative to
   * some other copy (see RemoteRuntimeProvider, which genuinely can detect them).
   */
  conflictDetection: false,
};

export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local-indexeddb';
  readonly capabilities = CAPABILITIES;

  async listFiles(_project: ProjectIdentity): Promise<StorageFileEntry[]> {
    const state = await loadAndroidFallbackState();

    return Object.entries(state.workspace.files ?? {}).map(([path, dirent]) => toStorageFileEntry(path, dirent));
  }

  async readFile(_project: ProjectIdentity, path: string): Promise<StorageFileEntry | undefined> {
    const state = await loadAndroidFallbackState();
    const dirent = state.workspace.files?.[path];

    return dirent ? toStorageFileEntry(path, dirent) : undefined;
  }

  async writeFiles(_project: ProjectIdentity, files: Record<string, string>): Promise<{ writtenCount: number }> {
    const state = await loadAndroidFallbackState();
    const nextFiles: Record<string, PersistedDirent> = { ...(state.workspace.files ?? {}) };

    for (const [path, content] of Object.entries(files)) {
      nextFiles[path] = { type: 'file', content, isBinary: false };
    }

    await saveAndroidFallbackWorkspace(nextFiles, state.workspace.deletedPaths ?? []);

    return { writtenCount: Object.keys(files).length };
  }

  async deleteFiles(_project: ProjectIdentity, paths: string[]): Promise<{ deletedCount: number }> {
    const state = await loadAndroidFallbackState();
    const nextFiles: Record<string, PersistedDirent> = { ...(state.workspace.files ?? {}) };
    const nextDeletedPaths = new Set(state.workspace.deletedPaths ?? []);
    let deletedCount = 0;

    for (const path of paths) {
      if (path in nextFiles) {
        delete nextFiles[path];
        nextDeletedPaths.add(path);
        deletedCount += 1;
      }
    }

    await saveAndroidFallbackWorkspace(nextFiles, Array.from(nextDeletedPaths));

    return { deletedCount };
  }

  getSyncState(_project: ProjectIdentity): SyncState {
    /*
     * A local-only copy is never "syncing" with anything else -- it either has the data or
     * it doesn't, with nothing external to compare against (see capabilities.conflictDetection).
     */
    return 'synced';
  }
}

function toStorageFileEntry(path: string, dirent: PersistedDirent): StorageFileEntry {
  return {
    path,
    type: dirent.type === 'folder' ? 'folder' : 'file',
    content: dirent.type === 'file' ? dirent.content : undefined,
    isBinary: dirent.type === 'file' ? dirent.isBinary : undefined,
    isLocked: dirent.isLocked,
  };
}
