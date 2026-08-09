import { MAX_IDENTICAL_FAILURES } from '~/lib/orchestrator/budget';

export const GAUNTLET_STATUSES = [
  'PLANNED',
  'RESEARCHING',
  'IMPLEMENTING',
  'TESTING',
  'REVIEWING',
  'VERIFYING',
  'BLOCKED',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type GauntletStatus = (typeof GAUNTLET_STATUSES)[number];

export type ReviewGateName = 'ARCHITECTURE' | 'SECURITY' | 'LICENSE' | 'TESTS' | 'VERIFICATION' | 'DOCUMENTATION';
export type ReviewGateStatus = 'pending' | 'passed' | 'failed' | 'blocked';

export interface FailureFingerprint {
  id: string;
  kind: string;
  message: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ReviewGate {
  name: ReviewGateName;
  status: ReviewGateStatus;
  evidence: string[];
}

export interface GauntletRun {
  runId: string;
  goal: string;
  startedAt: string;
  iteration: number;
  maxIterations: number;
  timeBudgetMs: number;
  contextBudget: number;
  contextUsed: number;
  costBudget: number;
  costUsed: number;
  failureFingerprints: FailureFingerprint[];
  history: Array<{ status: GauntletStatus; at: string; detail?: string }>;
  selectedCapabilities: string[];
  artifacts: string[];
  tests: string[];
  reviews: ReviewGate[];
  verification: string[];
  approvalState: 'not_required' | 'pending' | 'approved' | 'rejected';
  status: GauntletStatus;
}

export function createGauntletRun(input: {
  runId: string;
  goal: string;
  maxIterations: number;
  timeBudgetMs: number;
  contextBudget: number;
  costBudget: number;
  startedAt?: string;
}): GauntletRun {
  if (!input.runId.trim() || !input.goal.trim()) {
    throw new Error('runId and goal are required');
  }

  if (
    ![input.maxIterations, input.timeBudgetMs, input.contextBudget, input.costBudget].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    throw new Error('Gauntlet budgets must be positive finite numbers');
  }

  const at = input.startedAt ?? new Date().toISOString();
  const reviewNames: ReviewGateName[] = [
    'ARCHITECTURE',
    'SECURITY',
    'LICENSE',
    'TESTS',
    'VERIFICATION',
    'DOCUMENTATION',
  ];

  return {
    runId: input.runId,
    goal: input.goal,
    startedAt: at,
    iteration: 1,
    maxIterations: input.maxIterations,
    timeBudgetMs: input.timeBudgetMs,
    contextBudget: input.contextBudget,
    contextUsed: 0,
    costBudget: input.costBudget,
    costUsed: 0,
    failureFingerprints: [],
    history: [{ status: 'PLANNED', at }],
    selectedCapabilities: [],
    artifacts: [],
    tests: [],
    reviews: reviewNames.map((name) => ({ name, status: 'pending', evidence: [] })),
    verification: [],
    approvalState: 'not_required',
    status: 'PLANNED',
  };
}

const ALLOWED_GAUNTLET_TRANSITIONS: Record<GauntletStatus, GauntletStatus[]> = {
  PLANNED: ['RESEARCHING', 'CANCELLED'],
  RESEARCHING: ['IMPLEMENTING', 'BLOCKED', 'AWAITING_APPROVAL', 'CANCELLED'],
  IMPLEMENTING: ['TESTING', 'BLOCKED', 'AWAITING_APPROVAL', 'CANCELLED'],
  TESTING: ['REVIEWING', 'IMPLEMENTING', 'BLOCKED', 'CANCELLED'],
  REVIEWING: ['VERIFYING', 'IMPLEMENTING', 'BLOCKED', 'AWAITING_APPROVAL', 'CANCELLED'],
  VERIFYING: ['COMPLETED', 'IMPLEMENTING', 'BLOCKED', 'AWAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  BLOCKED: ['RESEARCHING', 'AWAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  AWAITING_APPROVAL: ['RESEARCHING', 'IMPLEMENTING', 'BLOCKED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function transitionGauntlet(
  run: GauntletRun,
  status: GauntletStatus,
  detail?: string,
  now = new Date().toISOString(),
): GauntletRun {
  if (!ALLOWED_GAUNTLET_TRANSITIONS[run.status].includes(status)) {
    throw new Error(`Invalid gauntlet transition ${run.status} -> ${status}`);
  }

  const elapsed = Math.max(0, Date.parse(now) - Date.parse(run.startedAt));

  if (elapsed >= run.timeBudgetMs) {
    return {
      ...run,
      status: 'FAILED',
      history: [...run.history, { status: 'FAILED', at: now, detail: 'time budget exhausted' }],
    };
  }

  if (run.iteration >= run.maxIterations || !hasBudgetRemaining(run)) {
    return {
      ...run,
      status: 'FAILED',
      history: [
        ...run.history,
        {
          status: 'FAILED',
          at: now,
          detail: run.iteration >= run.maxIterations ? 'iteration budget exhausted' : 'usage budget exhausted',
        },
      ],
    };
  }

  return { ...run, status, history: [...run.history, { status, at: now, detail }] };
}

export function recordUsage(run: GauntletRun, usage: { context: number; cost: number }): GauntletRun {
  if (!Number.isFinite(usage.context) || usage.context < 0 || !Number.isFinite(usage.cost) || usage.cost < 0) {
    throw new Error('Usage must be non-negative finite numbers');
  }

  return {
    ...run,
    contextUsed: run.contextUsed + usage.context,
    costUsed: run.costUsed + usage.cost,
  };
}

/** Limit reached counts as exhausted (D-13), not just limit exceeded. */
export function hasBudgetRemaining(run: GauntletRun): boolean {
  return run.contextUsed < run.contextBudget && run.costUsed < run.costBudget;
}

export function recordFailure(
  run: GauntletRun,
  input: { id: string; kind: string; message: string; at?: string },
): GauntletRun {
  const at = input.at ?? new Date().toISOString();
  const existing = run.failureFingerprints.find((failure) => failure.id === input.id);
  const failureFingerprints = existing
    ? run.failureFingerprints.map((failure) =>
        failure.id === input.id
          ? { ...failure, count: failure.count + 1, lastSeenAt: at, message: input.message }
          : failure,
      )
    : [...run.failureFingerprints, { ...input, count: 1, firstSeenAt: at, lastSeenAt: at }];

  const repeated = failureFingerprints.find(
    (failure) => failure.id === input.id && failure.count >= MAX_IDENTICAL_FAILURES,
  );

  return {
    ...run,
    failureFingerprints,
    status: repeated ? 'BLOCKED' : run.status,
    approvalState: repeated ? 'pending' : run.approvalState,
    history: repeated
      ? [...run.history, { status: 'BLOCKED', at, detail: `non-converging failure: ${input.id}` }]
      : run.history,
  };
}

export function hasNonConvergingFailure(run: GauntletRun, maxRepeats = MAX_IDENTICAL_FAILURES): boolean {
  return run.failureFingerprints.some((failure) => failure.count >= maxRepeats);
}

export function updateReviewGate(
  run: GauntletRun,
  name: ReviewGateName,
  status: ReviewGateStatus,
  evidence: string[],
): GauntletRun {
  return {
    ...run,
    reviews: run.reviews.map((gate) => (gate.name === name ? { ...gate, status, evidence: [...evidence] } : gate)),
  };
}

export function canCompleteGauntlet(run: GauntletRun): boolean {
  if (run.status !== 'VERIFYING' || run.iteration > run.maxIterations) {
    return false;
  }

  return (
    (run.approvalState === 'not_required' || run.approvalState === 'approved') &&
    run.reviews.every((gate) => gate.status === 'passed') &&
    run.verification.length > 0 &&
    !hasNonConvergingFailure(run)
  );
}
