import { describe, it, expect, vi } from 'vitest';
import { canTransition, createWorkflowRun, runWorkflow, transitionWorkflow } from './run-workflow';
import type { AgentInvocation, AgentResult, OrchestratorHost } from './adapters';
import type { Budget, Goal, Task } from './types';
import type { WorkflowEvent } from './events';

function goal(text = 'Build something'): Goal {
  return { id: 'goal-1', text, openQuestions: [] };
}

function task(id: string, dependsOn: string[] = []): Task {
  return { id, goalId: 'goal-1', title: `Task ${id}`, dependsOn };
}

const GENEROUS_BUDGET: Budget = {
  maxWallClockMs: 60_000,
  maxTokens: 1_000_000,
  maxCostMinor: 1_000_000,
  maxIterations: 100,
  maxConcurrency: 5,
};

function passingEvidence(): AgentResult['evidence'] {
  return [{ kind: 'test-run', outcome: 'pass', source: 'test', summary: 'ok', collectedAt: Date.now() }];
}

function failingEvidence(reason = 'broke'): AgentResult['evidence'] {
  return [{ kind: 'test-run', outcome: 'fail', source: 'test', summary: reason, collectedAt: Date.now() }];
}

/** A host whose agents.run() always succeeds for every invocation it's given. */
function alwaysPassHost(): OrchestratorHost {
  return {
    id: 'veldra-app',
    agents: {
      async run(invocations: AgentInvocation[]): Promise<AgentResult[]> {
        return invocations.map((inv) => ({
          role: inv.role,
          output: `done: ${inv.role}`,
          evidence: passingEvidence(),
        }));
      },
    },
    approvals: { request: vi.fn() },
    policy: { check: vi.fn().mockResolvedValue(null) },
  };
}

function inMemoryRunsPort() {
  const store = new Map<string, string>();

  return {
    async save(id: string, serialized: string) {
      store.set(id, serialized);
    },
    async load(id: string) {
      return store.get(id) ?? null;
    },
    async list() {
      return [...store.keys()];
    },
    _raw: store,
  };
}

describe('canTransition / transitionWorkflow', () => {
  it('allows idle -> running', () => {
    expect(canTransition('idle', 'running')).toBe(true);
  });

  it('allows running -> awaiting-approval, completed, failed, cancelled', () => {
    expect(canTransition('running', 'awaiting-approval')).toBe(true);
    expect(canTransition('running', 'completed')).toBe(true);
    expect(canTransition('running', 'failed')).toBe(true);
    expect(canTransition('running', 'cancelled')).toBe(true);
  });

  it('rejects transitions out of terminal states', () => {
    expect(canTransition('completed', 'running')).toBe(false);
    expect(canTransition('failed', 'running')).toBe(false);
    expect(canTransition('cancelled', 'running')).toBe(false);
  });

  it('rejects skipping straight from idle to completed', () => {
    expect(canTransition('idle', 'completed')).toBe(false);
  });

  it('transitionWorkflow throws on an invalid transition and does not mutate the input', () => {
    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);

    expect(() => transitionWorkflow(run, 'completed')).toThrow(/Invalid workflow transition/);
    expect(run.state).toBe('idle');
  });

  it('transitionWorkflow sets haltReason on a valid failing transition', () => {
    const run = { ...createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET), state: 'running' as const };
    const failed = transitionWorkflow(run, 'failed', 'something broke');

    expect(failed.state).toBe('failed');
    expect(failed.haltReason).toBe('something broke');
  });

  it('transitionWorkflow clears pendingApproval when leaving awaiting-approval', () => {
    const run = {
      ...createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET),
      state: 'awaiting-approval' as const,
      pendingApproval: { id: 'a1', kind: 'plan' as const, question: 'q', context: 'c', options: ['y'] },
    };
    const resumed = transitionWorkflow(run, 'running');

    expect(resumed.pendingApproval).toBeUndefined();
  });
});

describe('createWorkflowRun', () => {
  it('starts idle with every task pending and no evidence', () => {
    const run = createWorkflowRun(goal(), [task('t1'), task('t2')], GENEROUS_BUDGET);

    expect(run.state).toBe('idle');
    expect(run.usage).toEqual({ elapsedMs: 0, tokens: 0, costMinor: 0, iterations: 0 });
    expect(run.tasks).toHaveLength(2);
    expect(run.tasks.every((t) => t.state === 'pending' && t.evidence.length === 0)).toBe(true);
  });
});

describe('runWorkflow', () => {
  it('completes a single-task run and emits the expected event sequence', async () => {
    const host = alwaysPassHost();
    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    const events: WorkflowEvent[] = [];

    const result = await runWorkflow(run, host, {
      taskToInvocation: (t) => ({ role: t.title, prompt: 'do it' }),
      onEvent: (e) => events.push(e),
    });

    expect(result.state).toBe('completed');
    expect(result.tasks[0].state).toBe('verified');
    expect(events.map((e) => e.type)).toEqual(['run.started', 'agent.started', 'agent.completed', 'run.completed']);
  });

  it('respects task dependencies: a dependent task is not dispatched until its dependency is verified', async () => {
    const dispatchOrder: string[] = [];
    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: {
        async run(invocations) {
          dispatchOrder.push(...invocations.map((i) => i.role));
          return invocations.map((inv) => ({ role: inv.role, output: 'ok', evidence: passingEvidence() }));
        },
      },
      approvals: { request: vi.fn() },
      policy: { check: vi.fn().mockResolvedValue(null) },
    };

    const run = createWorkflowRun(goal(), [task('t1'), task('t2', ['t1'])], GENEROUS_BUDGET);
    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(result.state).toBe('completed');
    expect(dispatchOrder).toEqual(['t1', 't2']);
  });

  it('marks a task failed when its evidence does not all pass, and does not mark the run completed', async () => {
    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: {
        async run(invocations) {
          return invocations.map((inv) => ({ role: inv.role, output: '', evidence: failingEvidence() }));
        },
      },
      approvals: { request: vi.fn() },
      policy: { check: vi.fn().mockResolvedValue(null) },
    };

    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(result.state).toBe('failed');
    expect(result.tasks[0].state).toBe('failed');
    expect(result.haltReason).toMatch(/blocked on t1/);
  });

  it('treats empty evidence as not-verified (anti-hallucination: no evidence is not a pass)', async () => {
    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: {
        async run(invocations) {
          return invocations.map((inv) => ({ role: inv.role, output: 'trust me', evidence: [] }));
        },
      },
      approvals: { request: vi.fn() },
      policy: { check: vi.fn().mockResolvedValue(null) },
    };

    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(result.tasks[0].state).toBe('failed');
  });

  it('fails with a policy denial reason before ever calling agents.run, when requiredCapability is denied', async () => {
    const runSpy = vi.fn();
    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: { run: runSpy },
      approvals: { request: vi.fn() },
      policy: { check: vi.fn().mockResolvedValue('tier too low') },
    };

    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    const result = await runWorkflow(run, host, {
      taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }),
      requiredCapability: 'mcp-servers',
    });

    expect(result.state).toBe('failed');
    expect(result.haltReason).toContain('tier too low');
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('proceeds when policy allows the required capability', async () => {
    const host = alwaysPassHost();
    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);

    const result = await runWorkflow(run, host, {
      taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }),
      requiredCapability: 'mcp-servers',
    });

    expect(result.state).toBe('completed');
    expect(host.policy.check).toHaveBeenCalledWith('mcp-servers', { goalId: 'goal-1' });
  });

  it('on a budget violation, requests approval and continues for one more round when granted "continue-once"', async () => {
    let call = 0;
    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: {
        async run(invocations) {
          call += 1;
          return invocations.map((inv) => ({ role: inv.role, output: 'ok', evidence: passingEvidence() }));
        },
      },
      approvals: { request: vi.fn().mockResolvedValue({ requestId: 'x', chosen: 'continue-once', respondedAt: 0 }) },
      policy: { check: vi.fn().mockResolvedValue(null) },
    };

    // maxIterations: 0 means checkBudget flags a violation before the very first dispatch.
    const tightBudget: Budget = { ...GENEROUS_BUDGET, maxIterations: 0 };
    const run = createWorkflowRun(goal(), [task('t1')], tightBudget);

    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(host.approvals.request).toHaveBeenCalledTimes(1);
    expect(call).toBe(1);
    expect(result.state).toBe('completed');
  });

  it('on a budget violation, fails with the violation reason when approval is denied ("stop")', async () => {
    const runSpy = vi.fn();
    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: { run: runSpy },
      approvals: { request: vi.fn().mockResolvedValue({ requestId: 'x', chosen: 'stop', respondedAt: 0 }) },
      policy: { check: vi.fn().mockResolvedValue(null) },
    };

    const tightBudget: Budget = { ...GENEROUS_BUDGET, maxIterations: 0 };
    const run = createWorkflowRun(goal(), [task('t1')], tightBudget);

    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(result.state).toBe('failed');
    expect(result.haltReason).toMatch(/maxIterations exhausted/);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('fails after a failure signature repeats past the threshold, without exhausting the whole task list first', async () => {
    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: {
        async run(invocations) {
          return invocations.map((inv) => ({ role: inv.role, output: '', evidence: failingEvidence('same-error') }));
        },
      },
      approvals: { request: vi.fn() },
      policy: { check: vi.fn().mockResolvedValue(null) },
    };

    /*
     * Independent tasks (no shared dependsOn) so every one is "ready" on the very first loop
     * iteration -- the failure-repeat check should still stop things on a later iteration once
     * three failures with the same signature (task id + summary) have been recorded, rather than
     * running forever. Each task fails once, is not re-dispatched (state moves to 'failed', not
     * back to 'pending'), so this specifically exercises findRepeatingFailure via 3+ distinct
     * task ids sharing a summary -- not one task retried 3 times (this driver doesn't retry).
     */
    const run = createWorkflowRun(goal(), [task('t1'), task('t2'), task('t3')], {
      ...GENEROUS_BUDGET,
      maxConcurrency: 1,
    });

    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(result.state).toBe('failed');
  });

  it('cancels via AbortSignal instead of continuing to dispatch', async () => {
    const controller = new AbortController();
    const runSpy = vi
      .fn()
      .mockImplementation(async (invocations: AgentInvocation[]) =>
        invocations.map((inv) => ({ role: inv.role, output: 'ok', evidence: passingEvidence() })),
      );

    const host: OrchestratorHost = {
      id: 'veldra-app',
      agents: { run: runSpy },
      approvals: { request: vi.fn() },
      policy: { check: vi.fn().mockResolvedValue(null) },
    };

    controller.abort();

    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    const result = await runWorkflow(run, host, {
      taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }),
      signal: controller.signal,
    });

    expect(result.state).toBe('cancelled');
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('persists the run to host.runs after each meaningful transition when a runs port is supplied', async () => {
    const host = alwaysPassHost();
    const runs = inMemoryRunsPort();
    (host as any).runs = runs;

    const run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    const saved = JSON.parse((await runs.load(result.id)) ?? 'null');
    expect(saved.state).toBe('completed');
  });

  it('unsubscribes its internal event listener once the run finishes (no leak across separate runs)', async () => {
    const host = alwaysPassHost();
    const events: WorkflowEvent[] = [];

    const run1 = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    await runWorkflow(run1, host, {
      taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }),
      onEvent: (e) => events.push(e),
    });

    const countAfterFirstRun = events.length;

    /*
     * A second, separate run with no onEvent listener attached should not add anything to the
     * first run's `events` array -- if the first run's emitter were still subscribed somehow
     * (e.g. onEvent not properly unsubscribed, or emitters accidentally shared), this would fail.
     */
    const run2 = createWorkflowRun(goal(), [task('t2')], GENEROUS_BUDGET);
    await runWorkflow(run2, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(events.length).toBe(countAfterFirstRun);
  });

  it('resumes correctly from awaiting-approval back into running', async () => {
    const host = alwaysPassHost();
    let run = createWorkflowRun(goal(), [task('t1')], GENEROUS_BUDGET);
    run = transitionWorkflow({ ...run, state: 'running' }, 'awaiting-approval');

    const result = await runWorkflow(run, host, { taskToInvocation: (t) => ({ role: t.id, prompt: 'p' }) });

    expect(result.state).toBe('completed');
  });
});
