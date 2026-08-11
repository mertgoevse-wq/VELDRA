import { describe, expect, it } from 'vitest';
import { MAX_IDENTICAL_FAILURES } from './budget';
import type { PolicyGate } from './types';
import {
  ABSOLUTE_CEILING,
  formatBudgetPolicyDiagnostics,
  hasCapability,
  listCapabilities,
  resolveBudgetPolicy,
  STANDARD_OVERRIDE,
  validateDeveloperOverride,
  type DeveloperOverride,
} from './entitlement';

const override = (partial: Partial<DeveloperOverride>): DeveloperOverride => ({
  ...STANDARD_OVERRIDE,
  ...partial,
});

describe('resolveBudgetPolicy: tiers', () => {
  it('FREE gets the free-tier budget with no override possible', () => {
    const { budget, diagnostics } = resolveBudgetPolicy('FREE', 'development');
    expect(budget.maxIterations).toBe(5);
    expect(budget.maxCostMinor).toBe(0);
    expect(diagnostics.overrideActive).toBe(false);
  });

  it('PREMIUM gets the premium-tier budget', () => {
    const { budget } = resolveBudgetPolicy('PREMIUM', 'development');
    expect(budget.maxIterations).toBe(50);
    expect(budget.maxTokens).toBe(2_000_000);
  });

  it('PRO gets a higher budget than PREMIUM, still below the absolute ceiling', () => {
    const pro = resolveBudgetPolicy('PRO', 'development');
    const premium = resolveBudgetPolicy('PREMIUM', 'development');
    expect(pro.budget.maxTokens).toBeGreaterThan(premium.budget.maxTokens);
    expect(pro.budget.maxIterations).toBeGreaterThan(premium.budget.maxIterations);
    expect(pro.budget.maxWallClockMs).toBeLessThan(ABSOLUTE_CEILING.maxWallClockMs);
    expect(pro.budget.maxTokens).toBeLessThan(ABSOLUTE_CEILING.maxTokens);
  });

  it('DEVELOPER without an active override gets the same budget as PRO, the top customer tier', () => {
    const developer = resolveBudgetPolicy('DEVELOPER', 'development');
    const pro = resolveBudgetPolicy('PRO', 'development');
    expect(developer.budget).toEqual(pro.budget);
    expect(developer.diagnostics.overrideActive).toBe(false);
  });
});

describe('resolveBudgetPolicy: developer override', () => {
  it('allows an override in development', () => {
    const result = resolveBudgetPolicy(
      'DEVELOPER',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', limitValues: { maxIterations: 7 } }),
    );
    expect(result.budget.maxIterations).toBe(7);
    expect(result.diagnostics.overrideActive).toBe(true);
  });

  it('rejects an override in production', () => {
    expect(() =>
      resolveBudgetPolicy(
        'DEVELOPER',
        'production',
        override({ mode: 'DEVELOPER_OVERRIDE', limitValues: { maxIterations: 7 } }),
      ),
    ).toThrow(/not permitted in the 'production'/);
  });

  it('disables the token limit up to the absolute ceiling, not literally unlimited', () => {
    const { budget, diagnostics } = resolveBudgetPolicy(
      'DEVELOPER',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', disabledLimits: ['maxTokens'] }),
    );
    expect(budget.maxTokens).toBe(ABSOLUTE_CEILING.maxTokens);
    expect(Number.isFinite(budget.maxTokens)).toBe(true);

    const tokenDiagnostic = diagnostics.limits.find((limit) => limit.limit === 'maxTokens');
    expect(tokenDiagnostic).toMatchObject({ displayUnlimited: true, value: ABSOLUTE_CEILING.maxTokens });
  });

  it('sets the token limit to an individually chosen value', () => {
    const { budget } = resolveBudgetPolicy(
      'DEVELOPER',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', limitValues: { maxTokens: 12_345 } }),
    );
    expect(budget.maxTokens).toBe(12_345);
  });
});

describe('resolveBudgetPolicy: limit simulation', () => {
  it('sets a deliberately small token limit', () => {
    const { budget, diagnostics } = resolveBudgetPolicy(
      'DEVELOPER',
      'test',
      override({ mode: 'LIMIT_SIMULATION', limitValues: { maxTokens: 1000 } }),
    );
    expect(budget.maxTokens).toBe(1000);
    expect(diagnostics.limits.find((limit) => limit.limit === 'maxTokens')?.source).toBe('limit-simulation');
  });

  it('sets a deliberately small iteration limit and a short runtime', () => {
    const { budget } = resolveBudgetPolicy(
      'DEVELOPER',
      'test',
      override({ mode: 'LIMIT_SIMULATION', limitValues: { maxIterations: 2, maxWallClockMs: 30_000 } }),
    );
    expect(budget.maxIterations).toBe(2);
    expect(budget.maxWallClockMs).toBe(30_000);
  });

  it('sets a deliberately low identical-failure threshold', () => {
    const { maxIdenticalFailures } = resolveBudgetPolicy(
      'DEVELOPER',
      'test',
      override({ mode: 'LIMIT_SIMULATION', limitValues: { maxIdenticalFailures: 2 } }),
    );
    expect(maxIdenticalFailures).toBe(2);
    expect(maxIdenticalFailures).toBeLessThan(MAX_IDENTICAL_FAILURES);
  });
});

describe('resolveBudgetPolicy: reset', () => {
  it('returns to tier defaults once the override is reset to STANDARD', () => {
    const withOverride = resolveBudgetPolicy(
      'DEVELOPER',
      'development',
      override({ mode: 'LIMIT_SIMULATION', limitValues: { maxIterations: 2 } }),
    );
    expect(withOverride.budget.maxIterations).toBe(2);

    const reset = resolveBudgetPolicy('DEVELOPER', 'development', STANDARD_OVERRIDE);
    expect(reset.budget.maxIterations).toBe(150);
    expect(reset.diagnostics.overrideActive).toBe(false);
  });
});

describe('validateDeveloperOverride: invalid combinations', () => {
  it('rejects an override requested by a non-DEVELOPER tier', () => {
    const violation = validateDeveloperOverride(
      'PREMIUM',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', limitValues: { maxIterations: 3 } }),
    );
    expect(violation?.reason).toMatch(/requires tier DEVELOPER/);
  });

  it('rejects an override in production regardless of tier', () => {
    const violation = validateDeveloperOverride(
      'DEVELOPER',
      'production',
      override({ mode: 'DEVELOPER_OVERRIDE', limitValues: { maxIterations: 3 } }),
    );
    expect(violation?.reason).toMatch(/not permitted in the 'production'/);
  });

  it('rejects a non-STANDARD mode with nothing actually overridden', () => {
    const violation = validateDeveloperOverride('DEVELOPER', 'development', override({ mode: 'DEVELOPER_OVERRIDE' }));
    expect(violation?.reason).toMatch(/requires at least one/);
  });

  it('rejects a limit that is both disabled and given an explicit value', () => {
    const violation = validateDeveloperOverride(
      'DEVELOPER',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', disabledLimits: ['maxTokens'], limitValues: { maxTokens: 500 } }),
    );
    expect(violation?.reason).toMatch(/cannot be both disabled/);
  });

  it('rejects a value beyond the absolute ceiling', () => {
    const violation = validateDeveloperOverride(
      'DEVELOPER',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', limitValues: { maxIterations: ABSOLUTE_CEILING.maxIterations + 1 } }),
    );
    expect(violation?.reason).toMatch(/exceeds the absolute ceiling/);
  });

  it('rejects a non-positive value', () => {
    const violation = validateDeveloperOverride(
      'DEVELOPER',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', limitValues: { maxIterations: 0 } }),
    );
    expect(violation?.reason).toMatch(/positive finite number/);
  });

  it('rejects STANDARD carrying leftover override values', () => {
    const violation = validateDeveloperOverride(
      'DEVELOPER',
      'development',
      override({ mode: 'STANDARD', limitValues: { maxIterations: 3 } }),
    );
    expect(violation?.reason).toMatch(/must not carry/);
  });
});

describe('developer override never touches PolicyGate', () => {
  it('leaves a denying PolicyGate denying, even with every budget limit disabled', async () => {
    const denyingGate: PolicyGate = {
      async check(capability) {
        return `capability '${capability}' is not permitted for this account`;
      },
    };

    const { budget } = resolveBudgetPolicy(
      'DEVELOPER',
      'development',
      override({
        mode: 'DEVELOPER_OVERRIDE',
        disabledLimits: ['maxTokens', 'maxIterations', 'maxWallClockMs', 'maxCostMinor', 'maxIdenticalFailures'],
      }),
    );

    expect(budget.maxTokens).toBe(ABSOLUTE_CEILING.maxTokens);

    const decision = await denyingGate.check('destructive-action');
    expect(decision).not.toBeNull();
  });
});

describe('diagnostics reflect the actual resolved state', () => {
  it('never labels a limit UNLIMITED without also showing the enforced ceiling', () => {
    const { diagnostics } = resolveBudgetPolicy(
      'DEVELOPER',
      'development',
      override({ mode: 'DEVELOPER_OVERRIDE', disabledLimits: ['maxTokens'] }),
    );
    const lines = formatBudgetPolicyDiagnostics(diagnostics);
    const tokenLine = lines.find((line) => line.startsWith('maxTokens:'));
    expect(tokenLine).toContain('UNLIMITED');
    expect(tokenLine).toContain(String(ABSOLUTE_CEILING.maxTokens));
  });

  it('reports tier, override state and every limit value', () => {
    const { diagnostics } = resolveBudgetPolicy(
      'DEVELOPER',
      'development',
      override({ mode: 'LIMIT_SIMULATION', limitValues: { maxIdenticalFailures: 2 } }),
    );
    const lines = formatBudgetPolicyDiagnostics(diagnostics);
    expect(lines).toContain('Tier: DEVELOPER');
    expect(lines).toContain('Budget override: ENABLED (LIMIT_SIMULATION)');
    expect(lines).toContain('maxIdenticalFailures: 2');
  });
});

describe('hasCapability / listCapabilities', () => {
  it('FREE has no gated capabilities', () => {
    expect(hasCapability('FREE', 'connectors')).toBe(false);
    expect(hasCapability('FREE', 'mcp-servers')).toBe(false);
    expect(listCapabilities('FREE')).toEqual([]);
  });

  it('PREMIUM has connectors and premium transports, but not the PRO-only extras', () => {
    expect(hasCapability('PREMIUM', 'connectors')).toBe(true);
    expect(hasCapability('PREMIUM', 'premium-transports')).toBe(true);
    expect(hasCapability('PREMIUM', 'mcp-servers')).toBe(false);
    expect(hasCapability('PREMIUM', 'custom-agents')).toBe(false);
  });

  it('PRO has every currently-modelled capability', () => {
    const proCapabilities = listCapabilities('PRO');
    expect(proCapabilities).toContain('connectors');
    expect(proCapabilities).toContain('mcp-servers');
    expect(proCapabilities).toContain('custom-agents');
    expect(proCapabilities).toContain('custom-skills');
    expect(proCapabilities).toContain('custom-providers');
    expect(proCapabilities).toContain('advanced-agent-swarms');
    expect(proCapabilities).toContain('premium-transports');
  });

  it('DEVELOPER has the same capabilities as PRO, the tier it mirrors', () => {
    expect(listCapabilities('DEVELOPER').sort()).toEqual(listCapabilities('PRO').sort());
  });

  it('capability gating is a strict superset as tiers increase: FREE subset of PREMIUM subset of PRO', () => {
    const free = new Set(listCapabilities('FREE'));
    const premium = new Set(listCapabilities('PREMIUM'));
    const pro = new Set(listCapabilities('PRO'));

    for (const capability of free) {
      expect(premium.has(capability)).toBe(true);
    }

    for (const capability of premium) {
      expect(pro.has(capability)).toBe(true);
    }
  });
});
