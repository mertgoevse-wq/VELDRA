/**
 * Veldra Orchestration Core — workflow spine.
 *
 * The core must run unchanged inside Claude Code, inside Freebuff, and later
 * inside the Veldra app itself. It therefore depends on no host, no LLM and no
 * execution provider: everything it needs from the outside arrives through the
 * ports in ./adapters.
 *
 * Rationale and what is deliberately NOT modelled yet:
 * project/ARCHITECTURE-ORCHESTRATOR.md
 */

/** What the user actually wants, before any decomposition. */
export interface Goal {
  id: string;
  text: string;

  /** Requirements the analyzer could not infer and must ask about before planning. */
  openQuestions: string[];
}

export interface Task {
  id: string;
  goalId: string;
  title: string;

  /** Task ids that must reach 'verified' before this one may start. */
  dependsOn: string[];
}

export type TaskState = 'pending' | 'running' | 'awaiting-approval' | 'verified' | 'failed' | 'abandoned';

/**
 * Hard ceilings on a workflow. Every field is a stop condition, not a hint --
 * the product owner's requirement is explicitly "no unbounded autonomous
 * loops", so a workflow that cannot prove it is inside these limits must halt
 * rather than continue. Enforcement: ./budget.ts
 */
export interface Budget {
  maxWallClockMs: number;
  maxTokens: number;

  /** In whole currency minor units (e.g. cents) to avoid float drift on money. */
  maxCostMinor: number;

  maxIterations: number;

  /** Upper bound on subagents running at once. */
  maxConcurrency: number;
}

export interface BudgetUsage {
  elapsedMs: number;
  tokens: number;
  costMinor: number;
  iterations: number;
}

/**
 * Why a router picked what it picked. Recorded for every decision because an
 * automatic choice the user cannot inspect is one they cannot trust or debug --
 * and because a rejected-alternatives list is what makes a bad routing rule
 * findable after the fact.
 */
export interface RoutingDecision<T = string> {
  /** Which router made this call, e.g. 'model', 'execution', 'agent', 'method'. */
  router: string;

  chosen: T;

  /** Candidates considered and why each lost. Empty when only one was eligible. */
  rejected: Array<{ candidate: T; reason: string }>;

  /** Human-readable justification, shown in the UI when the user asks "why this?". */
  rationale: string;

  decidedAt: number;
}

/**
 * Proof that something actually happened. The orchestrator may not report a
 * task as verified on an agent's say-so; it needs an artifact that a human or a
 * later step can re-inspect. This is the anti-hallucination boundary.
 */
export interface Evidence {
  kind: 'test-run' | 'build' | 'lint' | 'typecheck' | 'diff' | 'command-output' | 'external-check';

  /** Whether the evidence supports success. Unknown results are not success. */
  outcome: 'pass' | 'fail' | 'inconclusive';

  /** Exact command or action that produced this, so it can be re-run. */
  source: string;

  summary: string;

  /** Full output, kept out of the model context unless explicitly requested. */
  detail?: string;

  collectedAt: number;
}

/**
 * What a method demands before a task counts as done. A method with an empty
 * requirement list is allowed, but then 'verified' means nothing stronger than
 * 'nobody objected' -- callers should treat that as a weaker claim.
 */
export interface VerificationRequirement {
  kind: Evidence['kind'];
  description: string;
}

export type ApprovalKind =
  | 'plan'
  | 'destructive-action'
  | 'budget-exceeded'
  | 'external-side-effect'
  | 'low-confidence';

/**
 * A point where the workflow stops and waits for a human. Never auto-resolved
 * by the core: the whole purpose is that something outside the loop decides.
 */
export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  question: string;

  /** Enough context to decide without reading the whole transcript. */
  context: string;

  options: string[];
}

export interface ApprovalResponse {
  requestId: string;
  chosen: string;
  note?: string;
  respondedAt: number;
}

/**
 * Stable signature of a failure, so the orchestrator can notice it is failing
 * the same way repeatedly instead of burning the iteration budget on it.
 * Retrying an identical fingerprint is the classic unbounded-loop failure mode.
 */
export interface FailureFingerprint {
  /** Stable hash over normalised error text + failing step, not the raw message. */
  signature: string;

  occurrences: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

/**
 * 'idle' -> not yet dispatched. 'queued' -> waiting for a concurrency slot (a multi-run
 * scheduler managing several WorkflowRuns at once is not built yet; single-run callers can
 * transition straight past it). 'failed' and 'cancelled' are deliberately distinct terminal
 * states (added 2026-08-15, replacing the previous single 'halted' catch-all): a run a human
 * chose to stop is a different outcome than one that broke, exactly the same distinction
 * TaskState already draws between 'abandoned' and 'failed'. See run-workflow.ts for the state
 * machine that enforces valid transitions between these.
 */
export type WorkflowState =
  | 'idle'
  | 'planning'
  | 'queued'
  | 'running'
  | 'awaiting-approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowRun {
  id: string;
  goal: Goal;
  state: WorkflowState;

  /** Chosen engineering method id; see MethodDefinition in ./registries. */
  methodId: string;

  budget: Budget;
  usage: BudgetUsage;

  tasks: Array<Task & { state: TaskState; evidence: Evidence[] }>;
  decisions: RoutingDecision[];
  failures: FailureFingerprint[];

  pendingApproval?: ApprovalRequest;

  /** Set when state is 'failed' or 'cancelled', so a stop is never silent. */
  haltReason?: string;
}

/**
 * Gate for anything the product may restrict (premium tiers, org policy,
 * provider allow-lists). The core asks; something above decides.
 *
 * Billing must never be imported by the core -- it implements this port
 * instead. That keeps the free/premium split a policy concern rather than a
 * fork of the architecture (project/DECISIONS.md D-007; see also
 * project/ARCHITECTURE-ORCHESTRATOR.md).
 */
export interface PolicyGate {
  /**
   * Resolves to a denial reason, or null when allowed. Returning a reason
   * rather than a boolean lets the UI explain the restriction instead of
   * silently hiding capability.
   */
  check(capability: string, context?: Record<string, unknown>): Promise<string | null>;
}
