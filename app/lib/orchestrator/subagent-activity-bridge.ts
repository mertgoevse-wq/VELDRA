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
 * This bridge itself only watches SubagentTask's status field, so it only ever produces
 * agent.started/agent.completed/agent.failed. tool.completed/tool.failed and
 * file.read/file.changed ARE now real (subagentService.ts's generateText() onStepFinish
 * callback emits them directly into recordActivityEvent() below, bypassing this bridge
 * since they happen at sub-task granularity this store's status field can't represent --
 * see subagent-tool-events.ts for the real classification logic and
 * docs/ai-state/DECISIONS.md's 2026-08-15 Block 1 entry for what is/isn't covered
 * (verification.*, retry, and cancellation still have no real signal to instrument).
 *
 * runId is the fixed sentinel 'ambient-subagents' rather than a real WorkflowRun id --
 * these events aren't produced by runWorkflow(), so there's no real run to attribute
 * them to. Using a sentinel is more honest than inventing one.
 */
export const AMBIENT_SUBAGENT_RUN_ID = 'ambient-subagents';

const MAX_RECENT_EVENTS = 200;

/**
 * Bounded, most-recent-last log of real activity events this session -- both this
 * bridge's own agent.* events (from subagentsStore, flag-independent) and, when the
 * orchestrator path actually runs (integration.ts, VELDRA_USE_ORCHESTRATOR=true), the
 * run.* and approval.* events runWorkflow() itself emits. One shared store rather than
 * two, so a real activity UI has a single place to read from instead of merging sources.
 */
export const recentAgentActivityStore = atom<WorkflowEvent[]>([]);

/** Records one real event into the shared activity log. Exported for integration.ts to reuse -- see the module doc comment above. */
export function recordActivityEvent(event: WorkflowEvent): void {
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
      recordActivityEvent(event);
    } else if (task.status === 'completed') {
      const event = createWorkflowEvent(
        AMBIENT_SUBAGENT_RUN_ID,
        'agent.completed',
        { result: task.result },
        changedKey,
      );
      emitter.emit(event);
      recordActivityEvent(event);
    } else if (task.status === 'failed') {
      const event = createWorkflowEvent(AMBIENT_SUBAGENT_RUN_ID, 'agent.failed', { error: task.error }, changedKey);
      emitter.emit(event);
      recordActivityEvent(event);
    }
  });

  return { emitter, stop: unsubscribe };
}
