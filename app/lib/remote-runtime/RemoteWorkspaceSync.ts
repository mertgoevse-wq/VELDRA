import {
  getSyncBaseSnapshot,
  loadAndroidFallbackState,
  saveAndroidFallbackWorkspace,
  saveSyncBaseSnapshot,
  type PersistedDirent,
} from '~/lib/persistence/androidFallbackStorage';
import { computeThreeWaySyncPlan, type SyncClassification, type SyncFileMap } from '~/lib/sync/three-way-merge';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import { RemoteRuntimeClient, type RemoteFileItem } from './RemoteRuntimeClient';

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
  const textFiles: SyncFileMap = {};
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

function collectRemoteTextFiles(files: RemoteFileItem[]) {
  const textFiles: SyncFileMap = {};
  const warnings: string[] = [];
  let skippedFileCount = 0;

  for (const file of files) {
    if (file.type !== 'file') {
      continue;
    }

    const remotePath = normalizeWorkspacePath(file.path);

    if (file.isBinary || typeof file.content !== 'string') {
      skippedFileCount += 1;
      warnings.push(`Skipped remote binary or unreadable file: ${remotePath}`);
      continue;
    }

    textFiles[remotePath] = file.content;
  }

  return { textFiles, warnings, skippedFileCount };
}

const CONFLICT_REASONS: Record<SyncClassification, string> = {
  unchanged: '',
  'local-added': '',
  'local-modified': '',
  'local-deleted': '',
  'remote-added': '',
  'remote-modified': '',
  'remote-deleted': '',
  'both-converged': '',
  'both-deleted': '',
  'conflict-both-modified':
    'Both local and remote changed this file differently since the last sync. Neither side was overwritten.',
  'conflict-local-delete-remote-modify':
    'File was deleted locally but modified remotely since the last sync. Remote copy was not restored, and the local delete was not pushed.',
  'conflict-remote-delete-local-modify':
    'File was deleted remotely but modified locally since the last sync. Local copy was not deleted, and the remote delete was not pulled.',
  'conflict-both-added-different':
    'File was independently created on both sides with different content. Neither copy was overwritten.',
};

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

/**
 * Loads local/base/remote text-file state and computes the three-way plan shared by push and
 * pull. Both operations see the SAME classification -- they only differ in which actions
 * (`direction: 'push'` vs `'pull'`) they choose to apply, and both persist the same `nextBase`
 * once their side's writes succeed.
 */
async function buildSyncPlan(client: RemoteRuntimeClient) {
  const [localState, remoteFilesResponse, baseSnapshot] = await Promise.all([
    loadAndroidFallbackState(),
    client.listFiles({ includeContent: true }),
    getSyncBaseSnapshot(),
  ]);

  const local = collectLocalTextFiles(localState.workspace.files ?? {});
  const remote = collectRemoteTextFiles(remoteFilesResponse.files);
  const plan = computeThreeWaySyncPlan(local.textFiles, baseSnapshot, remote.textFiles);

  return {
    plan,
    localState,
    warnings: [...local.warnings, ...remote.warnings],
    skippedFileCount: local.skippedFileCount + remote.skippedFileCount,
  };
}

function conflictsFromPlan(plan: ReturnType<typeof computeThreeWaySyncPlan>): RemoteWorkspaceConflict[] {
  return plan.conflicts.map((conflict) => ({
    path: conflict.path,
    reason: CONFLICT_REASONS[conflict.classification] || 'Local and remote diverged since the last sync.',
  }));
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

    const client = createClient();
    const { plan, localState, warnings, skippedFileCount } = await buildSyncPlan(client);

    const writes: Record<string, string> = {};
    const deletedPaths: string[] = [];

    for (const action of plan.actions) {
      if (action.direction !== 'push') {
        continue;
      }

      if (action.content === null) {
        deletedPaths.push(action.path);
      } else if (action.content !== undefined) {
        writes[action.path] = action.content;
      }
    }

    /*
     * The plan only reasons about paths it has seen in local/base/remote. A path the user
     * explicitly deleted locally but that was never part of a base snapshot (e.g. this
     * project's very first sync) and that remote also doesn't currently have won't appear in
     * the plan at all -- still tell the server about it, same as before three-way tracking
     * existed, as long as it isn't a path the plan flagged as a real conflict (which must not
     * be auto-resolved by an unconditional delete).
     */
    const conflictPaths = new Set(plan.conflicts.map((conflict) => conflict.path));

    for (const rawDeletedPath of localState.workspace.deletedPaths ?? []) {
      const normalized = normalizeWorkspacePath(rawDeletedPath);

      if (normalized && !conflictPaths.has(normalized) && !deletedPaths.includes(normalized)) {
        deletedPaths.push(normalized);
      }
    }

    let syncedFileCount = 0;

    if (Object.keys(writes).length > 0 || deletedPaths.length > 0) {
      const result = await client.syncFiles(writes, deletedPaths);
      syncedFileCount = result.writtenFileCount ?? Object.keys(writes).length;
    }

    await saveSyncBaseSnapshot(plan.nextBase);

    updateSyncStatus({
      state: 'success',
      lastSyncAt: new Date().toISOString(),
      syncedFileCount,
      skippedFileCount,
      conflictCount: plan.conflicts.length,
      warnings,
      conflicts: conflictsFromPlan(plan),
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
    const { plan, localState, warnings, skippedFileCount } = await buildSyncPlan(client);

    const nextFiles: Record<string, PersistedDirent> = { ...(localState.workspace.files ?? {}) };
    const nextDeletedPaths = new Set(localState.workspace.deletedPaths ?? []);
    const nextBase = { ...plan.nextBase };
    const extraConflicts: RemoteWorkspaceConflict[] = [];
    let syncedFileCount = 0;

    /*
     * Same rationale as the push side's explicit-deletedPaths merge, mirrored for pull: a path
     * with no base history yet (this project's first sync) that the user already deleted
     * locally would otherwise classify as a plain "remote-added" and get silently resurrected.
     * The explicit local delete list is authoritative here regardless of base/remote history.
     */
    const explicitlyDeletedLocally = new Set(
      (localState.workspace.deletedPaths ?? []).map(normalizeWorkspacePath).filter(Boolean),
    );

    for (const action of plan.actions) {
      if (action.direction !== 'pull') {
        continue;
      }

      if (explicitlyDeletedLocally.has(action.path)) {
        extraConflicts.push({ path: action.path, reason: 'File was deleted locally. Remote copy was not restored.' });
        delete nextBase[action.path];
        continue;
      }

      const localPath = denormalizeWorkspacePath(action.path, nextFiles);

      if (action.content === null) {
        delete nextFiles[localPath];
        nextDeletedPaths.add(normalizeWorkspacePath(localPath));
        syncedFileCount += 1;
        continue;
      }

      if (action.content === undefined) {
        continue;
      }

      const existing = nextFiles[localPath];
      nextFiles[localPath] = {
        type: 'file',
        content: action.content,
        isBinary: false,
        isLocked: existing?.isLocked ?? false,
        lockedByFolder: existing?.lockedByFolder,
      };
      nextDeletedPaths.delete(normalizeWorkspacePath(localPath));
      syncedFileCount += 1;
    }

    await saveAndroidFallbackWorkspace(nextFiles, Array.from(nextDeletedPaths));
    await saveSyncBaseSnapshot(nextBase);

    updateSyncStatus({
      state: 'success',
      lastSyncAt: new Date().toISOString(),
      syncedFileCount,
      skippedFileCount,
      conflictCount: plan.conflicts.length + extraConflicts.length,
      warnings,
      conflicts: [...conflictsFromPlan(plan), ...extraConflicts],
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

    /*
     * Single-file syncs bypass the full three-way plan, but must still keep the base snapshot
     * consistent -- otherwise the next full push/pull would see this path as diverged from a
     * stale base and misreport it as a conflict even though both sides now agree.
     */
    const baseSnapshot = await getSyncBaseSnapshot();
    await saveSyncBaseSnapshot({ ...baseSnapshot, [remotePath]: localFile.content });

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
