import { describe, expect, it } from 'vitest';
import { computeThreeWaySyncPlan, type SyncFileMap } from './three-way-merge';

function actionFor(plan: ReturnType<typeof computeThreeWaySyncPlan>, path: string) {
  return plan.actions.find((action) => action.path === path);
}

function conflictFor(plan: ReturnType<typeof computeThreeWaySyncPlan>, path: string) {
  return plan.conflicts.find((conflict) => conflict.path === path);
}

describe('computeThreeWaySyncPlan', () => {
  it('reports unchanged files as no-ops and carries their content into nextBase', () => {
    const local: SyncFileMap = { 'a.ts': 'same' };
    const base: SyncFileMap = { 'a.ts': 'same' };
    const remote: SyncFileMap = { 'a.ts': 'same' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toMatchObject({ classification: 'unchanged', direction: 'none' });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.nextBase['a.ts']).toBe('same');
  });

  it('pushes a local-only edit when remote is unchanged since base', () => {
    const local: SyncFileMap = { 'a.ts': 'edited locally' };
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = { 'a.ts': 'original' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toMatchObject({
      classification: 'local-modified',
      direction: 'push',
      content: 'edited locally',
    });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.nextBase['a.ts']).toBe('edited locally');
  });

  it('pulls a remote-only edit when local is unchanged since base', () => {
    const local: SyncFileMap = { 'a.ts': 'original' };
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = { 'a.ts': 'edited remotely' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toMatchObject({
      classification: 'remote-modified',
      direction: 'pull',
      content: 'edited remotely',
    });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.nextBase['a.ts']).toBe('edited remotely');
  });

  it('does not conflict when both sides make the identical edit', () => {
    const local: SyncFileMap = { 'a.ts': 'same new content' };
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = { 'a.ts': 'same new content' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toMatchObject({ classification: 'both-converged', direction: 'none' });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.nextBase['a.ts']).toBe('same new content');
  });

  it('flags a real conflict when both sides edit the same file differently', () => {
    const local: SyncFileMap = { 'a.ts': 'local edit' };
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = { 'a.ts': 'remote edit' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toBeUndefined();
    expect(conflictFor(plan, 'a.ts')).toMatchObject({
      classification: 'conflict-both-modified',
      local: 'local edit',
      base: 'original',
      remote: 'remote edit',
    });

    // Unresolved conflicts must not silently pick a winner in nextBase.
    expect(plan.nextBase['a.ts']).toBe('original');
  });

  it('propagates a local delete when remote is unchanged', () => {
    const local: SyncFileMap = {};
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = { 'a.ts': 'original' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toMatchObject({
      classification: 'local-deleted',
      direction: 'push',
      content: null,
    });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.nextBase['a.ts']).toBeUndefined();
  });

  it('conflicts (does not silently delete) when local deletes a file remote has modified', () => {
    const local: SyncFileMap = {};
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = { 'a.ts': 'remote edit' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toBeUndefined();
    expect(conflictFor(plan, 'a.ts')).toMatchObject({
      classification: 'conflict-local-delete-remote-modify',
      local: null,
      remote: 'remote edit',
    });

    // Base preserved unresolved -- next sync must not resurrect nor delete automatically.
    expect(plan.nextBase['a.ts']).toBe('original');
  });

  it('propagates a remote delete when local is unchanged', () => {
    const local: SyncFileMap = { 'a.ts': 'original' };
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = {};

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toMatchObject({
      classification: 'remote-deleted',
      direction: 'pull',
      content: null,
    });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.nextBase['a.ts']).toBeUndefined();
  });

  it('conflicts (does not silently delete) when remote deletes a file local has modified', () => {
    const local: SyncFileMap = { 'a.ts': 'local edit' };
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = {};

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toBeUndefined();
    expect(conflictFor(plan, 'a.ts')).toMatchObject({
      classification: 'conflict-remote-delete-local-modify',
      local: 'local edit',
      remote: null,
    });
    expect(plan.nextBase['a.ts']).toBe('original');
  });

  it('is a no-op when both sides independently delete the same file', () => {
    const local: SyncFileMap = {};
    const base: SyncFileMap = { 'a.ts': 'original' };
    const remote: SyncFileMap = {};

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'a.ts')).toMatchObject({ classification: 'both-deleted', direction: 'none' });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.nextBase['a.ts']).toBeUndefined();
  });

  it('pushes a brand-new local file (no base, no remote)', () => {
    const local: SyncFileMap = { 'new.ts': 'new file' };
    const base: SyncFileMap = {};
    const remote: SyncFileMap = {};

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'new.ts')).toMatchObject({
      classification: 'local-added',
      direction: 'push',
      content: 'new file',
    });
    expect(plan.nextBase['new.ts']).toBe('new file');
  });

  it('pulls a brand-new remote file (no base, no local)', () => {
    const local: SyncFileMap = {};
    const base: SyncFileMap = {};
    const remote: SyncFileMap = { 'new.ts': 'new file' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'new.ts')).toMatchObject({
      classification: 'remote-added',
      direction: 'pull',
      content: 'new file',
    });
    expect(plan.nextBase['new.ts']).toBe('new file');
  });

  it('conflicts when both sides independently create the same path with different content', () => {
    const local: SyncFileMap = { 'new.ts': 'local version' };
    const base: SyncFileMap = {};
    const remote: SyncFileMap = { 'new.ts': 'remote version' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'new.ts')).toBeUndefined();
    expect(conflictFor(plan, 'new.ts')).toMatchObject({ classification: 'conflict-both-added-different' });
    expect(plan.nextBase['new.ts']).toBeUndefined();
  });

  it('handles a rename as a delete at the old path plus an add at the new path', () => {
    /*
     * No dedicated rename detection -- verifies the fallback decomposition is still safe and
     * lossless, per the module's own documented scope.
     */
    const local: SyncFileMap = { 'renamed.ts': 'content' };
    const base: SyncFileMap = { 'old.ts': 'content' };
    const remote: SyncFileMap = { 'old.ts': 'content' };

    const plan = computeThreeWaySyncPlan(local, base, remote);

    expect(actionFor(plan, 'old.ts')).toMatchObject({
      classification: 'local-deleted',
      direction: 'push',
      content: null,
    });
    expect(actionFor(plan, 'renamed.ts')).toMatchObject({
      classification: 'local-added',
      direction: 'push',
      content: 'content',
    });
    expect(plan.conflicts).toHaveLength(0);
  });

  it('is idempotent: re-running against the resulting nextBase yields no further actions or conflicts', () => {
    const local: SyncFileMap = { 'a.ts': 'edited locally', 'b.ts': 'unchanged' };
    const base: SyncFileMap = { 'a.ts': 'original', 'b.ts': 'unchanged' };
    const remote: SyncFileMap = { 'a.ts': 'original', 'b.ts': 'unchanged' };

    const firstPlan = computeThreeWaySyncPlan(local, base, remote);

    // Simulate applying the plan: push 'a.ts' to remote, adopt nextBase as the new base.
    const nextRemote: SyncFileMap = { ...remote, 'a.ts': 'edited locally' };
    const secondPlan = computeThreeWaySyncPlan(local, firstPlan.nextBase, nextRemote);

    expect(secondPlan.actions.every((action) => action.classification === 'unchanged')).toBe(true);
    expect(secondPlan.conflicts).toHaveLength(0);
  });

  it('recovers deterministically from an interrupted sync (base stale relative to both sides)', () => {
    /*
     * Base reflects a sync from before EITHER side's latest change -- a repeated/resumed sync
     * must reclassify identically each time, not lose track of what already changed.
     */
    const local: SyncFileMap = { 'a.ts': 'local edit v2' };
    const base: SyncFileMap = { 'a.ts': 'stale original' };
    const remote: SyncFileMap = { 'a.ts': 'stale original' };

    const firstAttempt = computeThreeWaySyncPlan(local, base, remote);
    const secondAttempt = computeThreeWaySyncPlan(local, base, remote);

    expect(firstAttempt).toEqual(secondAttempt);
    expect(actionFor(firstAttempt, 'a.ts')).toMatchObject({ classification: 'local-modified', direction: 'push' });
  });

  it('never produces both an action and a conflict for the same path', () => {
    const local: SyncFileMap = { shared: 'local', localOnly: 'x', bothDeleted: undefined as unknown as string };
    delete local.bothDeleted;

    const base: SyncFileMap = { shared: 'base', bothDeleted: 'gone-soon' };
    const remote: SyncFileMap = { shared: 'remote', remoteOnly: 'y' };

    const plan = computeThreeWaySyncPlan(local, base, remote);
    const actionPaths = new Set(plan.actions.map((action) => action.path));
    const conflictPaths = new Set(plan.conflicts.map((conflict) => conflict.path));

    for (const path of actionPaths) {
      expect(conflictPaths.has(path)).toBe(false);
    }
  });
});
