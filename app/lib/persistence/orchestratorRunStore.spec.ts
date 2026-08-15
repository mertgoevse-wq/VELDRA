import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunStore } from '~/lib/orchestrator/adapters';
import type { WorkflowRun } from '~/lib/orchestrator/types';
import {
  createIndexedDBRunStore,
  listResumableWorkflowRuns,
  loadWorkflowRun,
  saveWorkflowRun,
} from './orchestratorRunStore';
import * as db from './db';

vi.mock('./db', () => ({
  getOrchestratorRun: vi.fn(),
  setOrchestratorRun: vi.fn(),
  listOrchestratorRunIds: vi.fn(),
}));

const fakeDb = {} as IDBDatabase;

describe('createIndexedDBRunStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with a database', () => {
    const store = createIndexedDBRunStore(fakeDb);

    it('save() delegates to setOrchestratorRun', async () => {
      await store.save('run-1', '{"id":"run-1"}');
      expect(db.setOrchestratorRun).toHaveBeenCalledWith(fakeDb, 'run-1', '{"id":"run-1"}');
    });

    it('load() delegates to getOrchestratorRun and returns its result', async () => {
      vi.mocked(db.getOrchestratorRun).mockResolvedValue('{"id":"run-1"}');

      const result = await store.load('run-1');

      expect(db.getOrchestratorRun).toHaveBeenCalledWith(fakeDb, 'run-1');
      expect(result).toBe('{"id":"run-1"}');
    });

    it('load() returns null, not undefined, when nothing is stored -- matching the RunStore contract', async () => {
      vi.mocked(db.getOrchestratorRun).mockResolvedValue(undefined);

      const result = await store.load('missing-run');

      expect(result).toBeNull();
    });

    it('list() delegates to listOrchestratorRunIds', async () => {
      vi.mocked(db.listOrchestratorRunIds).mockResolvedValue(['run-1', 'run-2']);

      const result = await store.list();

      expect(db.listOrchestratorRunIds).toHaveBeenCalledWith(fakeDb);
      expect(result).toEqual(['run-1', 'run-2']);
    });
  });

  describe('without a database (persistence unavailable)', () => {
    const store = createIndexedDBRunStore(undefined);

    it('save() is a safe no-op, never throws', async () => {
      await expect(store.save('run-1', '{}')).resolves.toBeUndefined();
      expect(db.setOrchestratorRun).not.toHaveBeenCalled();
    });

    it('load() resolves to null rather than throwing', async () => {
      await expect(store.load('run-1')).resolves.toBeNull();
      expect(db.getOrchestratorRun).not.toHaveBeenCalled();
    });

    it('list() resolves to an empty array rather than throwing', async () => {
      await expect(store.list()).resolves.toEqual([]);
      expect(db.listOrchestratorRunIds).not.toHaveBeenCalled();
    });
  });
});

function inMemoryRunStore(): RunStore {
  const map = new Map<string, string>();

  return {
    save: async (runId, serialized) => {
      map.set(runId, serialized);
    },
    load: async (runId) => map.get(runId) ?? null,
    list: async () => Array.from(map.keys()),
  };
}

function exampleWorkflowRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 'run-1',
    goal: { id: 'goal-1', text: 'Build a music-recognition app', openQuestions: ['Which platforms?'] },
    state: 'planning',
    methodId: 'gauntlet',
    budget: { maxWallClockMs: 60_000, maxTokens: 10_000, maxCostMinor: 0, maxIterations: 5, maxConcurrency: 1 },
    usage: { elapsedMs: 0, tokens: 0, costMinor: 0, iterations: 0 },
    tasks: [],
    decisions: [],
    failures: [],
    ...overrides,
  };
}

describe('saveWorkflowRun / loadWorkflowRun', () => {
  it('round-trips a WorkflowRun through JSON exactly', async () => {
    const store = inMemoryRunStore();
    const run = exampleWorkflowRun();

    await saveWorkflowRun(store, run);

    const loaded = await loadWorkflowRun(store, 'run-1');

    expect(loaded).toEqual(run);
  });

  it('preserves openQuestions and task/decision/failure arrays through the round-trip', async () => {
    const store = inMemoryRunStore();
    const run = exampleWorkflowRun({
      tasks: [
        { id: 'task-1', goalId: 'goal-1', title: 'Scaffold project', dependsOn: [], state: 'pending', evidence: [] },
      ],
      decisions: [
        { router: 'model', chosen: 'claude-sonnet-5', rejected: [], rationale: 'best coding score', decidedAt: 1 },
      ],
    });

    await saveWorkflowRun(store, run);

    const loaded = await loadWorkflowRun(store, 'run-1');

    expect(loaded?.tasks).toHaveLength(1);
    expect(loaded?.decisions).toHaveLength(1);
    expect(loaded?.goal.openQuestions).toEqual(['Which platforms?']);
  });

  it('returns null for a run that was never saved, matching load()s own null contract', async () => {
    const store = inMemoryRunStore();
    expect(await loadWorkflowRun(store, 'never-saved')).toBeNull();
  });
});

describe('listResumableWorkflowRuns', () => {
  it('returns an empty array when nothing is persisted', async () => {
    const store = inMemoryRunStore();
    expect(await listResumableWorkflowRuns(store)).toEqual([]);
  });

  it('excludes completed and cancelled runs but keeps every other WorkflowState', async () => {
    const store = inMemoryRunStore();
    const states = [
      'idle',
      'planning',
      'queued',
      'running',
      'awaiting-approval',
      'failed',
      'completed',
      'cancelled',
    ] as const;

    for (const state of states) {
      await saveWorkflowRun(store, exampleWorkflowRun({ id: `run-${state}`, state }));
    }

    const resumable = await listResumableWorkflowRuns(store);

    expect(resumable.map((run) => run.state).sort()).toEqual([
      'awaiting-approval',
      'failed',
      'idle',
      'planning',
      'queued',
      'running',
    ]);
    expect(resumable.find((run) => run.state === 'completed')).toBeUndefined();
    expect(resumable.find((run) => run.state === 'cancelled')).toBeUndefined();
  });

  it('preserves the full run, not just its state, for each resumable entry', async () => {
    const store = inMemoryRunStore();
    const run = exampleWorkflowRun({ id: 'run-1', state: 'awaiting-approval' });
    await saveWorkflowRun(store, run);

    const [resumed] = await listResumableWorkflowRuns(store);

    expect(resumed).toEqual(run);
  });
});
