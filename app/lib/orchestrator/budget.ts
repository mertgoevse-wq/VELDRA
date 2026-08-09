import type { Budget, BudgetUsage, FailureFingerprint } from './types';

/**
 * Budget enforcement. This is the mechanism behind "no unbounded autonomous
 * loops" -- without it that rule is only a comment.
 */

/** Limits that are checked against accumulated usage. maxConcurrency is enforced at dispatch instead. */
export type CheckedLimit = 'maxWallClockMs' | 'maxTokens' | 'maxCostMinor' | 'maxIterations';

export interface BudgetViolation {
  limit: CheckedLimit;
  used: number;
  allowed: number;
  message: string;
}

const USAGE_FOR_LIMIT: Record<CheckedLimit, keyof BudgetUsage> = {
  maxWallClockMs: 'elapsedMs',
  maxTokens: 'tokens',
  maxCostMinor: 'costMinor',
  maxIterations: 'iterations',
};

/**
 * Returns the first exceeded limit, or null when the run may continue.
 * Checked in a fixed order so a run that blows several limits at once always
 * reports the same one and stays reproducible.
 */
export function checkBudget(budget: Budget, usage: BudgetUsage): BudgetViolation | null {
  const order: CheckedLimit[] = ['maxWallClockMs', 'maxTokens', 'maxCostMinor', 'maxIterations'];

  for (const limit of order) {
    const allowed = budget[limit];
    const used = usage[USAGE_FOR_LIMIT[limit]];

    if (used >= allowed) {
      return {
        limit,
        used,
        allowed,
        message: `${limit} exhausted: ${used} of ${allowed}`,
      };
    }
  }

  return null;
}

/**
 * How often the identical failure may recur before the run halts. Three lets a
 * transient fault pass twice while still stopping a loop that has clearly
 * stopped making progress.
 */
export const MAX_IDENTICAL_FAILURES = 3;

export function recordFailure(failures: FailureFingerprint[], signature: string, now: number): FailureFingerprint[] {
  const existing = failures.find((failure) => failure.signature === signature);

  if (!existing) {
    return [...failures, { signature, occurrences: 1, firstSeenAt: now, lastSeenAt: now }];
  }

  return failures.map((failure) =>
    failure.signature === signature ? { ...failure, occurrences: failure.occurrences + 1, lastSeenAt: now } : failure,
  );
}

/**
 * A failure repeating at or beyond the threshold means the loop is retrying
 * something it cannot fix; the caller should halt and escalate rather than
 * spend the remaining budget on it.
 */
export function findRepeatingFailure(
  failures: FailureFingerprint[],
  threshold: number = MAX_IDENTICAL_FAILURES,
): FailureFingerprint | null {
  return failures.find((failure) => failure.occurrences >= threshold) ?? null;
}
