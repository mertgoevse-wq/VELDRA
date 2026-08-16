/**
 * Local (IndexedDB fallback) StorageProvider adapter.
 *
 * Wraps the existing androidFallbackStorage.ts persistence -- does not reimplement
 * IndexedDB access. androidFallbackStorage.ts now genuinely isolates storage per project
 * (see docs/architecture/STORAGE_AND_SYNC.md's "Project identity" section) -- every
 * method here passes `project.id` straight through rather than relying on that module's
 * internal getCurrentProjectId() default, so this adapter genuinely respects whichever
 * ProjectIdentity it's called with, not just whatever the current URL happens to be.
 * (An earlier version of this file predated that migration and left `project` unused --
 * fixed here in the same round the isolation itself was added, since leaving it unused
 * would have silently reintroduced the exact gap that migration closed.)
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

  /*
   * Real: a rename composes cleanly from this provider's own read+write+delete primitives,
   * and androidFallbackStorage's single saveAndroidFallbackWorkspace() call makes the
   * remove-old/add-new swap genuinely atomic (one IndexedDB write), not best-effort.
   */
  rename: true,
};

export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local-indexeddb';
  readonly capabilities = CAPABILITIES;

  async listFiles(project: ProjectIdentity): Promise<StorageFileEntry[]> {
    const state = await loadAndroidFallbackState(project.id);

    return Object.entries(state.workspace.files ?? {}).map(([path, dirent]) => toStorageFileEntry(path, dirent));
  }

  async readFile(project: ProjectIdentity, path: string): Promise<StorageFileEntry | undefined> {
    const state = await loadAndroidFallbackState(project.id);
    const dirent = state.workspace.files?.[path];

    return dirent ? toStorageFileEntry(path, dirent) : undefined;
  }

  async writeFiles(project: ProjectIdentity, files: Record<string, string>): Promise<{ writtenCount: number }> {
    const state = await loadAndroidFallbackState(project.id);
    const nextFiles: Record<string, PersistedDirent> = { ...(state.workspace.files ?? {}) };

    for (const [path, content] of Object.entries(files)) {
      nextFiles[path] = { type: 'file', content, isBinary: false };
    }

    await saveAndroidFallbackWorkspace(nextFiles, state.workspace.deletedPaths ?? [], project.id);

    return { writtenCount: Object.keys(files).length };
  }

  async deleteFiles(project: ProjectIdentity, paths: string[]): Promise<{ deletedCount: number }> {
    const state = await loadAndroidFallbackState(project.id);
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

    await saveAndroidFallbackWorkspace(nextFiles, Array.from(nextDeletedPaths), project.id);

    return { deletedCount };
  }

  async exists(project: ProjectIdentity, path: string): Promise<boolean> {
    const state = await loadAndroidFallbackState(project.id);
    return path in (state.workspace.files ?? {});
  }

  async getMetadata(
    project: ProjectIdentity,
    path: string,
  ): Promise<Pick<StorageFileEntry, 'path' | 'type' | 'size' | 'modifiedAt' | 'isBinary'> | undefined> {
    const entry = await this.readFile(project, path);

    if (!entry) {
      return undefined;
    }

    return {
      path: entry.path,
      type: entry.type,
      size: entry.size,
      modifiedAt: entry.modifiedAt,
      isBinary: entry.isBinary,
    };
  }

  async rename(project: ProjectIdentity, fromPath: string, toPath: string): Promise<void> {
    const state = await loadAndroidFallbackState(project.id);
    const nextFiles: Record<string, PersistedDirent> = { ...(state.workspace.files ?? {}) };
    const dirent = nextFiles[fromPath];

    if (!dirent) {
      throw new Error(`Cannot rename "${fromPath}": it does not exist.`);
    }

    delete nextFiles[fromPath];
    nextFiles[toPath] = dirent;

    const nextDeletedPaths = new Set(state.workspace.deletedPaths ?? []);
    nextDeletedPaths.add(fromPath);
    nextDeletedPaths.delete(toPath);

    /*
     * One save call -- one IndexedDB transaction -- so the old-path-removed/new-path-added
     * swap is genuinely atomic, not two operations that could partially fail.
     */
    await saveAndroidFallbackWorkspace(nextFiles, Array.from(nextDeletedPaths), project.id);
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
