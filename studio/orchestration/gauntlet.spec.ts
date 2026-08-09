import { describe, expect, it } from 'vitest';
import { createGauntletRun, hasBudgetRemaining, recordUsage, transitionGauntlet } from './gauntlet';

describe('gauntlet budget boundaries (D-13: limit reached counts as exhausted)', () => {
  it('fails a transition once the time budget is exactly reached', () => {
    const run = createGauntletRun({
      runId: 'r1',
      goal: 'g',
      maxIterations: 5,
      timeBudgetMs: 1000,
      contextBudget: 100,
      costBudget: 10,
      startedAt: '2026-08-09T00:00:00.000Z',
    });
    const result = transitionGauntlet(run, 'RESEARCHING', undefined, '2026-08-09T00:00:01.000Z');
    expect(result.status).toBe('FAILED');
  });

  it('still allows a transition just under the time budget', () => {
    const run = createGauntletRun({
      runId: 'r2',
      goal: 'g',
      maxIterations: 5,
      timeBudgetMs: 1000,
      contextBudget: 100,
      costBudget: 10,
      startedAt: '2026-08-09T00:00:00.000Z',
    });
    const result = transitionGauntlet(run, 'RESEARCHING', undefined, '2026-08-09T00:00:00.999Z');
    expect(result.status).toBe('RESEARCHING');
  });

  it('fails a transition once the iteration budget is exactly reached', () => {
    const base = createGauntletRun({
      runId: 'r3',
      goal: 'g',
      maxIterations: 2,
      timeBudgetMs: 60000,
      contextBudget: 100,
      costBudget: 10,
      startedAt: '2026-08-09T00:00:00.000Z',
    });
    const run = { ...base, iteration: 2 };
    const result = transitionGauntlet(run, 'RESEARCHING', undefined, '2026-08-09T00:00:00.100Z');
    expect(result.status).toBe('FAILED');
  });

  it('treats context/cost budget as exhausted once usage reaches the limit', () => {
    let run = createGauntletRun({
      runId: 'r4',
      goal: 'g',
      maxIterations: 5,
      timeBudgetMs: 60000,
      contextBudget: 100,
      costBudget: 10,
      startedAt: '2026-08-09T00:00:00.000Z',
    });
    expect(hasBudgetRemaining(run)).toBe(true);
    run = recordUsage(run, { context: 100, cost: 0 });
    expect(hasBudgetRemaining(run)).toBe(false);
  });
});
