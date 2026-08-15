import { describe, it, expect, beforeEach } from 'vitest';
import { subagentsStore, type SubagentTask } from '~/lib/stores/subagents';
import {
  AMBIENT_SUBAGENT_RUN_ID,
  recentAgentActivityStore,
  startSubagentActivityBridge,
} from './subagent-activity-bridge';
import { createWorkflowEventEmitter } from './events';

function baseTask(overrides: Partial<SubagentTask> = {}): SubagentTask {
  return {
    taskId: 'subagent-1',
    model: 'Google:gemini-1.5-pro',
    systemPrompt: 'You are a test agent',
    task: 'Do the thing',
    status: 'running',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('startSubagentActivityBridge', () => {
  beforeEach(() => {
    subagentsStore.set({});
    recentAgentActivityStore.set([]);
  });

  it('emits agent.started the first time a task appears as running', () => {
    const emitter = createWorkflowEventEmitter();
    const { stop } = startSubagentActivityBridge(emitter);

    subagentsStore.setKey('subagent-1', baseTask());

    const events = emitter.history();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('agent.started');
    expect(events[0].taskId).toBe('subagent-1');
    expect(events[0].runId).toBe(AMBIENT_SUBAGENT_RUN_ID);

    stop();
  });

  it('emits agent.completed when a running task transitions to completed', () => {
    const emitter = createWorkflowEventEmitter();
    const { stop } = startSubagentActivityBridge(emitter);

    subagentsStore.setKey('subagent-1', baseTask());
    subagentsStore.setKey('subagent-1', {
      ...subagentsStore.get()['subagent-1'],
      status: 'completed',
      result: 'done',
      completedAt: Date.now(),
    });

    const types = emitter.history().map((e) => e.type);
    expect(types).toEqual(['agent.started', 'agent.completed']);

    stop();
  });

  it('emits agent.failed when a running task transitions to failed', () => {
    const emitter = createWorkflowEventEmitter();
    const { stop } = startSubagentActivityBridge(emitter);

    subagentsStore.setKey('subagent-1', baseTask());
    subagentsStore.setKey('subagent-1', {
      ...subagentsStore.get()['subagent-1'],
      status: 'failed',
      error: 'boom',
      completedAt: Date.now(),
    });

    const types = emitter.history().map((e) => e.type);
    expect(types).toEqual(['agent.started', 'agent.failed']);

    stop();
  });

  it('does not re-emit when a field other than status changes', () => {
    const emitter = createWorkflowEventEmitter();
    const { stop } = startSubagentActivityBridge(emitter);

    subagentsStore.setKey('subagent-1', baseTask());

    // Same status, different field (e.g. a hypothetical progress note) -- must not double-emit 'started'.
    subagentsStore.setKey('subagent-1', { ...subagentsStore.get()['subagent-1'], task: 'Do the thing (updated)' });

    expect(emitter.history().map((e) => e.type)).toEqual(['agent.started']);

    stop();
  });

  it('tracks multiple independent tasks separately', () => {
    const emitter = createWorkflowEventEmitter();
    const { stop } = startSubagentActivityBridge(emitter);

    subagentsStore.setKey('subagent-1', baseTask({ taskId: 'subagent-1' }));
    subagentsStore.setKey('subagent-2', baseTask({ taskId: 'subagent-2' }));
    subagentsStore.setKey('subagent-1', { ...subagentsStore.get()['subagent-1'], status: 'completed' });

    const byTask = emitter.history().map((e) => [e.taskId, e.type]);
    expect(byTask).toEqual([
      ['subagent-1', 'agent.started'],
      ['subagent-2', 'agent.started'],
      ['subagent-1', 'agent.completed'],
    ]);

    stop();
  });

  it('populates recentAgentActivityStore as a side effect, bounded to the most recent entries', () => {
    const { stop } = startSubagentActivityBridge();

    for (let i = 0; i < 3; i += 1) {
      subagentsStore.setKey(`subagent-${i}`, baseTask({ taskId: `subagent-${i}` }));
    }

    expect(recentAgentActivityStore.get()).toHaveLength(3);
    expect(recentAgentActivityStore.get().map((e) => e.taskId)).toEqual(['subagent-0', 'subagent-1', 'subagent-2']);

    stop();
  });

  it('stop() unsubscribes so further store changes are not observed', () => {
    const emitter = createWorkflowEventEmitter();
    const { stop } = startSubagentActivityBridge(emitter);

    stop();
    subagentsStore.setKey('subagent-1', baseTask());

    expect(emitter.history()).toHaveLength(0);
  });
});
