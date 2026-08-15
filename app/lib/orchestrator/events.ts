/**
 * Workflow event model — the core's typed, append-only record of what a WorkflowRun
 * actually did. Portable like the rest of this directory (see
 * project/ARCHITECTURE-ORCHESTRATOR.md): no host, no LLM, no UI import.
 *
 * These events are the anti-fake-progress boundary for activity UI the same way
 * Evidence is the anti-hallucination boundary for task completion (D-007,
 * project/DECISIONS.md). A caller must only ever emit an event for something that
 * actually happened at the call site that emits it — never to make an activity
 * timeline look busier. If a UI wants a phase that has no corresponding emit call
 * anywhere, that phase does not exist yet; add the real instrumentation first.
 */

/** Every event type a WorkflowRun can emit. Keep this list matched to real call sites, not aspirational. */
export type WorkflowEventType =
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'tool.requested'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'file.read'
  | 'file.changed'
  | 'verification.started'
  | 'verification.completed'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied';

export interface WorkflowEvent<TData = Record<string, unknown>> {
  id: string;
  runId: string;
  type: WorkflowEventType;

  /** Task id this event is about, when it's about one specific task rather than the whole run. */
  taskId?: string;

  at: number;
  data: TData;
}

export type WorkflowEventListener = (event: WorkflowEvent) => void;

/**
 * Minimal in-memory pub/sub. Every host can share this same implementation — event
 * emission has no host-specific I/O, unlike ApprovalPort/PolicyGate/RunStore, so unlike
 * those this isn't a port a host implements differently.
 */
export interface WorkflowEventEmitter {
  emit(event: WorkflowEvent): void;

  /** Returns an unsubscribe function. */
  subscribe(listener: WorkflowEventListener): () => void;

  /** Every event emitted so far, in emission order. Bounded by the caller's own run lifetime. */
  history(): WorkflowEvent[];
}

export function createWorkflowEventEmitter(): WorkflowEventEmitter {
  const listeners = new Set<WorkflowEventListener>();
  const events: WorkflowEvent[] = [];

  return {
    emit(event) {
      events.push(event);

      for (const listener of listeners) {
        listener(event);
      }
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    history() {
      return [...events];
    },
  };
}

export function createWorkflowEvent<TData = Record<string, unknown>>(
  runId: string,
  type: WorkflowEventType,
  data: TData,
  taskId?: string,
  id: string = crypto.randomUUID(),
  at: number = Date.now(),
): WorkflowEvent<TData> {
  return { id, runId, type, taskId, at, data };
}
