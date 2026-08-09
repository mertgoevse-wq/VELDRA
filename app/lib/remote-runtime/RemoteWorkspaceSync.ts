import {
  loadAndroidFallbackState,
  saveAndroidFallbackWorkspace,
  type PersistedDirent,
} from '~/lib/persistence/androidFallbackStorage';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import { RemoteRuntimeClient } from './RemoteRuntimeClient';

export interface RemoteWorkspaceConflict {
  path: string;
  reason: string;
}

export interface RemoteWorkspaceSyncStatus {
  state: 'idle' | 'syncing' | 'success' | 'error';
  lastOperation?: 'push' | 'pull' | 'single-file';
  lastSyncAt?: string;
  syncedFileCount: number;
  skippedFileCount: number;
  conflictCount: number;
  lastError?: string;
  warnings: string[];
  conflicts: RemoteWorkspaceConflict[];
}

const initialStatus: RemoteWorkspaceSyncStatus = {
  state: 'idle',
  syncedFileCount: 0,
  skippedFileCount: 0,
  conflictCount: 0,
  warnings: [],
  conflicts: [],
};

let syncStatus: RemoteWorkspaceSyncStatus = { ...initialStatus };

function updateSyncStatus(partial: Partial<RemoteWorkspaceSyncStatus>) {
  syncStatus = {
    ...syncStatus,
    ...partial,
    warnings: partial.warnings ?? syncStatus.warnings,
    conflicts: partial.conflicts ?? syncStatus.conflicts,
  };
}

function createClient() {
  const runtime = runtimeModeStore.get();
  const missing = getMissingRemoteRuntimeConfig();

  if (missing.length > 0) {
    throw new Error(`Remote Runtime is not configured. Missing: ${missing.join(', ')}.`);
  }

  return new RemoteRuntimeClient(runtime.remoteRuntimeUrl, runtime.remoteAuthToken, runtime.remoteWorkspaceId);
}

export function getMissingRemoteRuntimeConfig(): string[] {
  const runtime = runtimeModeStore.get();
  const missing: string[] = [];

  if (!runtime.remoteRuntimeUrl.trim()) {
    missing.push('server URL');
  }

  if (!runtime.remoteAuthToken.trim()) {
    missing.push('auth token');
  }

  if (!runtime.remoteWorkspaceId.trim()) {
    missing.push('workspace ID');
  }

  return missing;
}

function normalizeWorkspacePath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/').trim();

  if (normalized.startsWith(`${WORK_DIR}/`)) {
    normalized = normalized.slice(WORK_DIR.length + 1);
  }

  normalized = normalized.replace(/^\/+/, '');

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  return normalized;
}

function denormalizeWorkspacePath(remotePath: string, existingFiles: Record<string, PersistedDirent>): string {
  const normalized = normalizeWorkspacePath(remotePath);
  const existingKey = Object.keys(existingFiles).find((filePath) => normalizeWorkspacePath(filePath) === normalized);

  return existingKey ?? `${WORK_DIR}/${normalized}`;
}

function isTextFile(
  dirent: PersistedDirent | undefined,
): dirent is PersistedDirent & { type: 'file'; content: string } {
  return dirent?.type === 'file' && !dirent.isBinary && typeof dirent.content === 'string';
}

function collectLocalTextFiles(files: Record<string, PersistedDirent>) {
  const textFiles: Record<string, string> = {};
  const warnings: string[] = [];
  let skippedFileCount = 0;

  for (const [filePath, dirent] of Object.entries(files)) {
    if (!dirent || dirent.type !== 'file') {
      continue;
    }

    const remotePath = normalizeWorkspacePath(filePath);

    if (!remotePath) {
      skippedFileCount += 1;
      warnings.push(`Skipped file with empty path: ${filePath}`);
      continue;
    }

    if (dirent.isBinary) {
      skippedFileCount += 1;
      warnings.push(`Skipped binary file: ${remotePath}`);
      continue;
    }

    textFiles[remotePath] = dirent.content ?? '';
  }

  return { textFiles, warnings, skippedFileCount };
}

async function persistWorkbenchBeforeSync() {
  await workbenchStore.saveAllFiles();
  await workbenchStore.saveCurrentDocument();
}

export function getSyncStatus(): RemoteWorkspaceSyncStatus {
  return {
    ...syncStatus,
    warnings: [...syncStatus.warnings],
    conflicts: [...syncStatus.conflicts],
  };
}

export function resetSyncStatus() {
  syncStatus = { ...initialStatus, warnings: [], conflicts: [] };
}

export async function pushLocalWorkspaceToRemote(): Promise<RemoteWorkspaceSyncStatus> {
  updateSyncStatus({
    state: 'syncing',
    lastOperation: 'push',
    lastError: undefined,
    warnings: [],
    conflicts: [],
    conflictCount: 0,
    syncedFileCount: 0,
    skippedFileCount: 0,
  });

  try {
    await persistWorkbenchBeforeSync();

    const state = await loadAndroidFallbackState();
    const { textFiles, warnings, skippedFileCount } = collectLocalTextFiles(state.workspace.files ?? {});
    const client = createClient();
    const result = await client.syncFiles(textFiles);

    updateSyncStatus({
      state: 'success',
      lastSyncAt: new Date().toISOString(),
      syncedFileCount: result.writtenFileCount ?? Object.keys(textFiles).length,
      skippedFileCount,
      warnings,
    });
  } catch (error) {
    updateSyncStatus({
      state: 'error',
      lastError: error instanceof Error ? error.message : 'Remote workspace push failed',
    });
  }

  return getSyncStatus();
}

export async function pullRemoteWorkspaceToLocal(): Promise<RemoteWorkspaceSyncStatus> {
  updateSyncStatus({
    state: 'syncing',
    lastOperation: 'pull',
    lastError: undefined,
    warnings: [],
    conflicts: [],
    conflictCount: 0,
    syncedFileCount: 0,
    skippedFileCount: 0,
  });

  try {
    await persistWorkbenchBeforeSync();

    const client = createClient();
    const remoteFilesResponse = await client.listFiles({ includeContent: true });
    const localState = await loadAndroidFallbackState();
    const nextFiles: Record<string, PersistedDirent> = { ...(localState.workspace.files ?? {}) };
    const conflicts: RemoteWorkspaceConflict[] = [];
    const warnings: string[] = [];
    let syncedFileCount = 0;
    let skippedFileCount = 0;

    for (const remoteFile of remoteFilesResponse.files) {
      if (remoteFile.type !== 'file') {
        continue;
      }

      const remotePath = normalizeWorkspacePath(remoteFile.path);

      if (remoteFile.isBinary || typeof remoteFile.content !== 'string') {
        skippedFileCount += 1;
        warnings.push(`Skipped remote binary or unreadable file: ${remotePath}`);
        continue;
      }

      const localPath = denormalizeWorkspacePath(remotePath, nextFiles);
      const localFile = nextFiles[localPath];

      if (isTextFile(localFile) && localFile.content !== remoteFile.content) {
        conflicts.push({
          path: remotePath,
          reason: 'Local IndexedDB copy differs from remote. Local copy kept.',
        });
        continue;
      }

      nextFiles[localPath] = {
        type: 'file',
        content: remoteFile.content,
        isBinary: false,
        isLocked: localFile?.isLocked ?? false,
        lockedByFolder: localFile?.lockedByFolder,
      };
      syncedFileCount += 1;
    }

    await saveAndroidFallbackWorkspace(nextFiles, localState.workspace.deletedPaths ?? []);

    updateSyncStatus({
      state: 'success',
      lastSyncAt: new Date().toISOString(),
      syncedFileCount,
      skippedFileCount,
      conflictCount: conflicts.length,
      warnings,
      conflicts,
    });
  } catch (error) {
    updateSyncStatus({
      state: 'error',
      lastError: error instanceof Error ? error.message : 'Remote workspace pull failed',
    });
  }

  return getSyncStatus();
}

export async function syncSingleFileToRemote(filePath?: string): Promise<RemoteWorkspaceSyncStatus> {
  updateSyncStatus({
    state: 'syncing',
    lastOperation: 'single-file',
    lastError: undefined,
    warnings: [],
    conflicts: [],
    conflictCount: 0,
    syncedFileCount: 0,
    skippedFileCount: 0,
  });

  try {
    const targetPath = filePath ?? workbenchStore.currentDocument.get()?.filePath ?? workbenchStore.selectedFile.get();

    if (!targetPath) {
      throw new Error('No current file is selected.');
    }

    await workbenchStore.saveFile(targetPath);

    const localState = await loadAndroidFallbackState();
    const localFile = localState.workspace.files[targetPath];
    const remotePath = normalizeWorkspacePath(targetPath);

    if (!isTextFile(localFile)) {
      updateSyncStatus({
        state: 'success',
        lastSyncAt: new Date().toISOString(),
        syncedFileCount: 0,
        skippedFileCount: 1,
        warnings: [`Skipped binary or non-text file: ${remotePath}`],
      });
      return getSyncStatus();
    }

    const client = createClient();
    await client.writeFile(remotePath, localFile.content);

    updateSyncStatus({
      state: 'success',
      lastSyncAt: new Date().toISOString(),
      syncedFileCount: 1,
      skippedFileCount: 0,
    });
  } catch (error) {
    updateSyncStatus({
      state: 'error',
      lastError: error instanceof Error ? error.message : 'Remote file sync failed',
    });
  }

  return getSyncStatus();
}
