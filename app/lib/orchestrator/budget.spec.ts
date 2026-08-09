import { describe, expect, it } from 'vitest';
import { MAX_IDENTICAL_FAILURES, checkBudget, findRepeatingFailure, recordFailure } from './budget';
import type { Budget, BudgetUsage } from './types';

const BUDGET: Budget = {
  maxWallClockMs: 60_000,
  maxTokens: 100_000,
  maxCostMinor: 500,
  maxIterations: 10,
  maxConcurrency: 4,
};

const NO_USAGE: BudgetUsage = { elapsedMs: 0, tokens: 0, costMinor: 0, iterations: 0 };

describe('checkBudget', () => {
  it('allows a run that is within every limit', () => {
    expect(checkBudget(BUDGET, NO_USAGE)).toBeNull();
  });

  it.each([
    ['maxWallClockMs', { ...NO_USAGE, elapsedMs: 60_000 }],
    ['maxTokens', { ...NO_USAGE, tokens: 100_000 }],
    ['maxCostMinor', { ...NO_USAGE, costMinor: 500 }],
    ['maxIterations', { ...NO_USAGE, iterations: 10 }],
  ] as const)('halts on %s once usage reaches the limit', (limit, usage) => {
    expect(checkBudget(BUDGET, usage)?.limit).toBe(limit);
  });

  it('treats reaching the limit as exhausted, not only exceeding it', () => {
    // An off-by-one here would allow one extra iteration past the ceiling.
    expect(checkBudget(BUDGET, { ...NO_USAGE, iterations: 9 })).toBeNull();
    expect(checkBudget(BUDGET, { ...NO_USAGE, iterations: 10 })).not.toBeNull();
  });

  it('reports the same limit regardless of which others also blew', () => {
    const everything: BudgetUsage = { elapsedMs: 99_999, tokens: 999_999, costMinor: 9_999, iterations: 99 };

    expect(checkBudget(BUDGET, everything)?.limit).toBe('maxWallClockMs');
  });

  it('reports how far past the limit the run got', () => {
    const violation = checkBudget(BUDGET, { ...NO_USAGE, tokens: 150_000 });

    expect(violation).toMatchObject({ used: 150_000, allowed: 100_000 });
  });
});

describe('failure fingerprints', () => {
  it('records an unseen failure once', () => {
    const failures = recordFailure([], 'build-failed', 1000);

    expect(failures).toEqual([{ signature: 'build-failed', occurrences: 1, firstSeenAt: 1000, lastSeenAt: 1000 }]);
  });

  it('counts a repeat without losing when it first appeared', () => {
    const failures = recordFailure(recordFailure([], 'build-failed', 1000), 'build-failed', 2000);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ occurrences: 2, firstSeenAt: 1000, lastSeenAt: 2000 });
  });

  it('keeps distinct failures apart', () => {
    const failures = recordFailure(recordFailure([], 'build-failed', 1000), 'test-failed', 2000);

    expect(failures.map((f) => f.signature)).toEqual(['build-failed', 'test-failed']);
  });

  it('does not flag a failure below the threshold', () => {
    let failures: ReturnType<typeof recordFailure> = [];

    for (let i = 0; i < MAX_IDENTICAL_FAILURES - 1; i++) {
      failures = recordFailure(failures, 'flaky', i);
    }

    expect(findRepeatingFailure(failures)).toBeNull();
  });

  it('flags a failure that hits the threshold, so the loop can be stopped', () => {
    let failures: ReturnType<typeof recordFailure> = [];

    for (let i = 0; i < MAX_IDENTICAL_FAILURES; i++) {
      failures = recordFailure(failures, 'stuck', i);
    }

    expect(findRepeatingFailure(failures)?.signature).toBe('stuck');
  });
});
