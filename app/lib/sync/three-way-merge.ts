/**
 * Deterministic three-way merge classification for workspace sync: LOCAL vs REMOTE vs the
 * last-known-common BASE snapshot (the state both sides agreed on after the previous
 * successful sync). Pure and I/O-free by design -- callers own how local/base/remote state is
 * loaded and how the resulting actions get applied, which is what makes this unit-testable
 * without IndexedDB or a network client.
 *
 * Without a base, a two-way diff can only ever ask "does local differ from remote?" -- it can't
 * tell a safe fast-forward (only one side changed) from a real conflict (both sides changed,
 * differently), so it either overwrites blindly or treats every divergence as a conflict. A
 * base snapshot answers "did local change since we last agreed?" and "did remote change since
 * we last agreed?" independently, which is what makes real automatic-merge-when-safe possible.
 */

export type SyncFileMap = Record<string, string>;

export type SyncClassification =
  | 'unchanged'
  | 'local-added'
  | 'local-modified'
  | 'local-deleted'
  | 'remote-added'
  | 'remote-modified'
  | 'remote-deleted'
  | 'both-converged'
  | 'both-deleted'
  | 'conflict-both-modified'
  | 'conflict-local-delete-remote-modify'
  | 'conflict-remote-delete-local-modify'
  | 'conflict-both-added-different';

export interface SyncAction {
  path: string;
  classification: SyncClassification;

  /** Which side the caller should apply the change to. 'none' when nothing needs writing. */
  direction: 'push' | 'pull' | 'none';

  /** Content to write on the target side. null means "delete this path". Absent for direction 'none'. */
  content?: string | null;
}

export interface SyncConflict {
  path: string;
  classification: SyncClassification;
  local: string | null;
  base: string | null;
  remote: string | null;
}

export interface ThreeWaySyncPlan {
  actions: SyncAction[];
  conflicts: SyncConflict[];

  /**
   * The base snapshot to persist once `actions` have been applied. Conflicted paths are
   * deliberately omitted/left at their prior value -- re-running the plan before a conflict is
   * resolved must reclassify it as the same conflict, not silently pick a side.
   */
  nextBase: SyncFileMap;
}

function classifyPath(
  local: string | undefined,
  base: string | undefined,
  remote: string | undefined,
): { classification: SyncClassification; direction: SyncAction['direction']; content?: string | null } {
  const localPresent = local !== undefined;
  const basePresent = base !== undefined;
  const remotePresent = remote !== undefined;

  if (!basePresent) {
    if (localPresent && !remotePresent) {
      return { classification: 'local-added', direction: 'push', content: local };
    }

    if (!localPresent && remotePresent) {
      return { classification: 'remote-added', direction: 'pull', content: remote };
    }

    // Both present, neither known to base: created independently on both sides.
    if (local === remote) {
      return { classification: 'both-converged', direction: 'none' };
    }

    return { classification: 'conflict-both-added-different', direction: 'none' };
  }

  const localChanged = localPresent ? local !== base : true;
  const remoteChanged = remotePresent ? remote !== base : true;

  if (!localChanged && !remoteChanged) {
    return { classification: 'unchanged', direction: 'none' };
  }

  if (localChanged && !remoteChanged) {
    return localPresent
      ? { classification: 'local-modified', direction: 'push', content: local }
      : { classification: 'local-deleted', direction: 'push', content: null };
  }

  if (!localChanged && remoteChanged) {
    return remotePresent
      ? { classification: 'remote-modified', direction: 'pull', content: remote }
      : { classification: 'remote-deleted', direction: 'pull', content: null };
  }

  // Both changed since base.
  if (!localPresent && !remotePresent) {
    return { classification: 'both-deleted', direction: 'none' };
  }

  if (!localPresent && remotePresent) {
    return { classification: 'conflict-local-delete-remote-modify', direction: 'none' };
  }

  if (localPresent && !remotePresent) {
    return { classification: 'conflict-remote-delete-local-modify', direction: 'none' };
  }

  if (local === remote) {
    return { classification: 'both-converged', direction: 'none' };
  }

  return { classification: 'conflict-both-modified', direction: 'none' };
}

const CONFLICT_CLASSIFICATIONS = new Set<SyncClassification>([
  'conflict-both-modified',
  'conflict-local-delete-remote-modify',
  'conflict-remote-delete-local-modify',
  'conflict-both-added-different',
]);

export function isConflict(classification: SyncClassification): boolean {
  return CONFLICT_CLASSIFICATIONS.has(classification);
}

export function computeThreeWaySyncPlan(local: SyncFileMap, base: SyncFileMap, remote: SyncFileMap): ThreeWaySyncPlan {
  const allPaths = new Set<string>([...Object.keys(local), ...Object.keys(base), ...Object.keys(remote)]);
  const actions: SyncAction[] = [];
  const conflicts: SyncConflict[] = [];
  const nextBase: SyncFileMap = {};

  for (const path of Array.from(allPaths).sort()) {
    const localVal = local[path];
    const baseVal = base[path];
    const remoteVal = remote[path];
    const result = classifyPath(localVal, baseVal, remoteVal);

    if (isConflict(result.classification)) {
      conflicts.push({
        path,
        classification: result.classification,
        local: localVal ?? null,
        base: baseVal ?? null,
        remote: remoteVal ?? null,
      });

      /*
       * Leave the path's base entry exactly as it was -- omit if it never existed, carry
       * forward otherwise -- so an unresolved conflict reclassifies identically next time.
       */
      if (baseVal !== undefined) {
        nextBase[path] = baseVal;
      }

      continue;
    }

    actions.push({ path, classification: result.classification, direction: result.direction, content: result.content });

    // Converged/no-op paths that were deleted on both sides simply don't appear in nextBase.
    if (result.classification === 'both-deleted') {
      continue;
    }

    const mergedContent = result.direction === 'push' ? localVal : result.direction === 'pull' ? remoteVal : localVal;

    if (mergedContent !== undefined) {
      nextBase[path] = mergedContent;
    }
  }

  return { actions, conflicts, nextBase };
}
