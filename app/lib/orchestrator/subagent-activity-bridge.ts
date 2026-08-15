import { atom } from 'nanostores';
import { subagentsStore, type SubagentTask } from '~/lib/stores/subagents';
import {
  createWorkflowEvent,
  createWorkflowEventEmitter,
  type WorkflowEvent,
  type WorkflowEventEmitter,
} from './events';

/**
 * Bridges subagentsStore's real state changes into the typed WorkflowEvent model, so
 * "Was macht VELDRA gerade?" activity UI can be built on real events per the mandate,
 * without needing every subagent spawn to go through the orchestrator's runWorkflow()
 * driver (most don't -- see integration.ts: the default, non-flagged path calls
 * SubagentService.spawnSubagent() directly, and VeldraAgentRunner's own polling in
 * _waitForCompletion also reads this same store, so this one bridge covers both the
 * legacy and orchestrator execution paths rather than needing two).
 *
 * Deliberately only agent.started/agent.completed/agent.failed: SubagentTask's status
 * field is exactly {running, completed, failed} (see subagents.ts) -- there is no real
 * per-tool-call or per-file granularity available from this store to honestly report
 * tool.* or file.* events. That would need onStepFinish-style instrumentation inside
 * subagentService.ts's generateText() call itself, which is a separate, higher-risk
 * change to an already-working execution path -- not done here, see
 * docs/ai-state/DECISIONS.md's 2026-08-15 entry for why.
 *
 * runId is the fixed sentinel 'ambient-subagents' rather than a real WorkflowRun id --
 * these events aren't produced by runWorkflow(), so there's no real run to attribute
 * them to. Using a sentinel is more honest than inventing one.
 */
export const AMBIENT_SUBAGENT_RUN_ID = 'ambient-subagents';

const MAX_RECENT_EVENTS = 200;

/** Bounded, most-recent-last log of every agent.* event the bridge has produced this session. */
export const recentAgentActivityStore = atom<WorkflowEvent[]>([]);

function pushRecent(event: WorkflowEvent): void {
  const next = [...recentAgentActivityStore.get(), event];
  recentAgentActivityStore.set(next.length > MAX_RECENT_EVENTS ? next.slice(next.length - MAX_RECENT_EVENTS) : next);
}

/**
 * Starts watching subagentsStore. Call once (e.g. at app init); returns a stop function
 * for tests or a future teardown path. Safe to call more than once -- each call is an
 * independent subscription with its own status-tracking, so prefer calling it exactly
 * once in production and treat multiple calls as a test-only convenience.
 */
export function startSubagentActivityBridge(emitter: WorkflowEventEmitter = createWorkflowEventEmitter()): {
  emitter: WorkflowEventEmitter;
  stop: () => void;
} {
  const previousStatus = new Map<string, SubagentTask['status']>();

  const unsubscribe = subagentsStore.listen((tasks, _previousTasks, changedKey) => {
    if (!changedKey) {
      return;
    }

    const task = tasks[changedKey];

    if (!task) {
      previousStatus.delete(changedKey);
      return;
    }

    const previous = previousStatus.get(changedKey);

    if (previous === task.status) {
      return;
    }

    previousStatus.set(changedKey, task.status);

    if (previous === undefined && task.status === 'running') {
      const event = createWorkflowEvent(
        AMBIENT_SUBAGENT_RUN_ID,
        'agent.started',
        { role: task.task, model: task.model },
        changedKey,
      );
      emitter.emit(event);
      pushRecent(event);
    } else if (task.status === 'completed') {
      const event = createWorkflowEvent(
        AMBIENT_SUBAGENT_RUN_ID,
        'agent.completed',
        { result: task.result },
        changedKey,
      );
      emitter.emit(event);
      pushRecent(event);
    } else if (task.status === 'failed') {
      const event = createWorkflowEvent(AMBIENT_SUBAGENT_RUN_ID, 'agent.failed', { error: task.error }, changedKey);
      emitter.emit(event);
      pushRecent(event);
    }
  });

  return { emitter, stop: unsubscribe };
}
