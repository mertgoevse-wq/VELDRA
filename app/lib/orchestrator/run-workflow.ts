import type { AgentInvocation, AgentResult, OrchestratorHost } from './adapters';
import type { Budget, Goal, Task, TaskState, WorkflowRun, WorkflowState } from './types';
import { checkBudget, findRepeatingFailure, recordFailure } from './budget';
import { createWorkflowEvent, createWorkflowEventEmitter, type WorkflowEventListener } from './events';

/**
 * WorkflowRun driver — the piece project/ARCHITECTURE-ORCHESTRATOR.md's "What is
 * deliberately NOT modelled here yet" section flagged as the real gap: "nothing outside
 * this orchestrator code and its own persistence layer currently creates a WorkflowRun."
 * This is that missing piece: takes a Goal + a pre-built Task graph (task DECOMPOSITION
 * from a goal -- i.e. planning -- is a separate, much larger, LLM-driven feature and is
 * out of scope here; see runWorkflow's `tasks` param) and actually drives it through
 * WorkflowState via the host's ports, honouring budget, policy, and approval the way
 * VeldraAgentRunner already honours concurrency.
 *
 * Portable core: no host, no LLM, no UI import. Every side effect crosses through the
 * OrchestratorHost ports passed in by the caller.
 */

const WORKFLOW_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  idle: ['queued', 'running', 'failed', 'cancelled'],
  planning: ['queued', 'running', 'failed', 'cancelled'],
  queued: ['running', 'cancelled'],
  running: ['awaiting-approval', 'completed', 'failed', 'cancelled'],
  'awaiting-approval': ['running', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws on an invalid transition rather than silently allowing it -- an inconsistent WorkflowRun.state is worse than a loud failure. */
export function transitionWorkflow(run: WorkflowRun, to: WorkflowState, haltReason?: string): WorkflowRun {
  if (!canTransition(run.state, to)) {
    throw new Error(`Invalid workflow transition: '${run.state}' -> '${to}' (run ${run.id})`);
  }

  const next: WorkflowRun = { ...run, state: to };

  if (haltReason !== undefined) {
    next.haltReason = haltReason;
  }

  if (to !== 'awaiting-approval') {
    delete next.pendingApproval;
  }

  return next;
}

export function createWorkflowRun(
  goal: Goal,
  tasks: Task[],
  budget: Budget,
  methodId: string = 'default',
  id: string = crypto.randomUUID(),
): WorkflowRun {
  return {
    id,
    goal,
    state: 'idle',
    methodId,
    budget,
    usage: { elapsedMs: 0, tokens: 0, costMinor: 0, iterations: 0 },
    tasks: tasks.map((task) => ({ ...task, state: 'pending' as TaskState, evidence: [] })),
    decisions: [],
    failures: [],
  };
}

function readyTasks(run: WorkflowRun): WorkflowRun['tasks'] {
  const verifiedIds = new Set(run.tasks.filter((task) => task.state === 'verified').map((task) => task.id));

  return run.tasks.filter(
    (task) => task.state === 'pending' && task.dependsOn.every((depId) => verifiedIds.has(depId)),
  );
}

/**
 * A task is only 'verified' when every piece of evidence it produced passed. Empty
 * evidence or any inconclusive/failed entry does not count -- matching Evidence's own
 * doc comment ("an ambiguous result is not a passing one by default"), applied per-task
 * the same way it applies to the run as a whole.
 */
function taskOutcomeFromEvidence(result: AgentResult): TaskState {
  if (result.evidence.length === 0) {
    return 'failed';
  }

  return result.evidence.every((evidence) => evidence.outcome === 'pass') ? 'verified' : 'failed';
}

export interface RunWorkflowOptions {
  /** Builds the invocation for a task -- prompt construction is host/product-specific, not the core's concern. */
  taskToInvocation: (task: Task, run: WorkflowRun) => AgentInvocation;

  /** Checked once via host.policy before execution starts. Omit when the caller has nothing to gate. */
  requiredCapability?: string;

  maxConcurrency?: number;

  /** Real cancellation: check controller.abort() at any point to stop a running workflow mid-flight. */
  signal?: AbortSignal;

  onEvent?: WorkflowEventListener;

  /** Safety backstop independent of the budget's own maxIterations, in case a caller passes an unreasonable budget. */
  maxLoopIterations?: number;
}

const DEFAULT_MAX_LOOP_ITERATIONS = 10_000;

/**
 * Drives a WorkflowRun from its current state to a terminal one (completed/failed/
 * cancelled), or pauses it at 'awaiting-approval' and returns -- callers resume by
 * calling this again with the same run object once host.approvals has a decision
 * recorded (see veldra-host.ts's approval port for how a decision actually arrives).
 */
export async function runWorkflow(
  initialRun: WorkflowRun,
  host: OrchestratorHost,
  options: RunWorkflowOptions,
): Promise<WorkflowRun> {
  const emitter = createWorkflowEventEmitter();
  const unsubscribe = options.onEvent ? emitter.subscribe(options.onEvent) : undefined;

  const emit = (type: Parameters<typeof createWorkflowEvent>[1], data: Record<string, unknown>, taskId?: string) => {
    emitter.emit(createWorkflowEvent(run.id, type, data, taskId));
  };

  const persist = async (toSave: WorkflowRun) => {
    if (host.runs) {
      await host.runs.save(toSave.id, JSON.stringify(toSave));
    }
  };

  let run = initialRun;
  const startedAt = Date.now();

  try {
    if (run.state === 'idle' || run.state === 'planning') {
      if (options.requiredCapability) {
        const denialReason = await host.policy.check(options.requiredCapability, { goalId: run.goal.id });

        if (denialReason) {
          run = transitionWorkflow(run, 'failed', `Policy denied '${options.requiredCapability}': ${denialReason}`);
          emit('run.failed', { reason: run.haltReason });
          await persist(run);

          return run;
        }
      }

      run = transitionWorkflow(run, 'running');
      emit('run.started', { goalId: run.goal.id, taskCount: run.tasks.length });
      await persist(run);
    } else if (run.state === 'awaiting-approval') {
      // Resuming after a caller already recorded a decision on run.pendingApproval elsewhere.
      run = transitionWorkflow(run, 'running');
      await persist(run);
    }

    const maxLoopIterations = options.maxLoopIterations ?? DEFAULT_MAX_LOOP_ITERATIONS;
    let loopGuard = 0;

    while (run.state === 'running') {
      loopGuard += 1;

      if (loopGuard > maxLoopIterations) {
        run = transitionWorkflow(
          run,
          'failed',
          `Exceeded internal loop safety limit (${maxLoopIterations} iterations)`,
        );
        emit('run.failed', { reason: run.haltReason });
        break;
      }

      if (options.signal?.aborted) {
        run = transitionWorkflow(run, 'cancelled', 'Cancelled via AbortSignal');
        emit('run.cancelled', { reason: run.haltReason });
        break;
      }

      /*
       * Check "is there actually more work to do" BEFORE budget/repeating-failure -- both of
       * those exist to gate the NEXT dispatch, so evaluating them when there's nothing left to
       * dispatch would ask for an approval nobody needs to grant (a real bug caught by this
       * file's own test suite: a tight budget re-triggered a second, pointless approval request
       * on the loop iteration where the run had already finished all its work).
       */
      const ready = readyTasks(run);

      if (ready.length === 0) {
        const allVerified = run.tasks.every((task) => task.state === 'verified');

        if (allVerified) {
          run = transitionWorkflow(run, 'completed');
          emit('run.completed', { taskCount: run.tasks.length });
        } else {
          const blockers = run.tasks.filter((task) => task.state !== 'verified').map((task) => task.id);
          run = transitionWorkflow(
            run,
            'failed',
            `No runnable tasks and not all verified: blocked on ${blockers.join(', ')}`,
          );
          emit('run.failed', { reason: run.haltReason });
        }

        break;
      }

      const usage = { ...run.usage, elapsedMs: Date.now() - startedAt };
      const violation = checkBudget(run.budget, usage);

      if (violation) {
        const request = {
          id: crypto.randomUUID(),
          kind: 'budget-exceeded' as const,
          question: `This run has hit its ${violation.limit} limit (${violation.used}/${violation.allowed}). Allow one more iteration, or stop here?`,
          context: violation.message,
          options: ['continue-once', 'stop'],
        };

        emit('approval.requested', { kind: request.kind, question: request.question });

        const response = await host.approvals.request(request);

        if (response.chosen === 'continue-once') {
          emit('approval.granted', { requestId: request.id, chosen: response.chosen });

          // Falls through to the dispatch below for exactly one more round; re-checked next loop.
        } else {
          emit('approval.denied', { requestId: request.id, chosen: response.chosen });
          run = transitionWorkflow(run, 'failed', violation.message);
          emit('run.failed', { reason: run.haltReason });
          break;
        }
      }

      const repeating = findRepeatingFailure(run.failures);

      if (repeating) {
        run = transitionWorkflow(
          run,
          'failed',
          `Failure '${repeating.signature}' repeated ${repeating.occurrences} times without progress`,
        );
        emit('run.failed', { reason: run.haltReason });
        break;
      }

      const invocations = ready.map((task) => options.taskToInvocation(task, run));

      for (const task of ready) {
        emit('agent.started', { role: task.title }, task.id);
      }

      const results = await host.agents.run(invocations, options.maxConcurrency ?? run.budget.maxConcurrency);

      let updatedTasks = run.tasks;
      let updatedFailures = run.failures;
      const now = Date.now();

      results.forEach((result, index) => {
        const task = ready[index];

        if (!task) {
          return;
        }

        const outcome = taskOutcomeFromEvidence(result);
        updatedTasks = updatedTasks.map((t) =>
          t.id === task.id ? { ...t, state: outcome, evidence: [...t.evidence, ...result.evidence] } : t,
        );

        if (outcome === 'verified') {
          emit('agent.completed', { output: result.output, usedModel: result.usedModel }, task.id);
        } else {
          emit('agent.failed', { output: result.output }, task.id);

          const failingEvidence = result.evidence.find((e) => e.outcome !== 'pass');
          const signature = `${task.id}:${failingEvidence?.summary ?? 'no-evidence'}`;
          updatedFailures = recordFailure(updatedFailures, signature, now);
        }
      });

      run = {
        ...run,
        tasks: updatedTasks,
        failures: updatedFailures,
        usage: {
          elapsedMs: Date.now() - startedAt,
          tokens: run.usage.tokens + results.reduce((sum, r) => sum + (r.tokensIn ?? 0) + (r.tokensOut ?? 0), 0),
          costMinor: run.usage.costMinor + results.reduce((sum, r) => sum + (r.costMinor ?? 0), 0),
          iterations: run.usage.iterations + 1,
        },
      };

      await persist(run);
    }

    await persist(run);

    return run;
  } finally {
    unsubscribe?.();
  }
}
