import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  developerOverrideStore,
  entitlementTierStore,
  getBudgetPolicyDiagnostics,
  resetDeveloperOverride,
  setDeveloperOverride,
  setEntitlementTier,
} from './developer-mode';
import { STANDARD_OVERRIDE } from '~/lib/orchestrator/entitlement';

beforeEach(() => {
  entitlementTierStore.set('FREE');
  developerOverrideStore.set(STANDARD_OVERRIDE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('developer-mode host wiring (Vite MODE -> RuntimeEnvironment)', () => {
  it('allows a developer override under the default test environment', () => {
    setEntitlementTier('DEVELOPER');
    setDeveloperOverride({
      mode: 'LIMIT_SIMULATION',
      disabledLimits: [],
      limitValues: { maxIterations: 2, maxIdenticalFailures: 2 },
    });

    const diagnostics = getBudgetPolicyDiagnostics();
    expect(diagnostics.overrideActive).toBe(true);
    expect(diagnostics.limits.find((limit) => limit.limit === 'maxIterations')?.value).toBe(2);
  });

  it('rejects setting the DEVELOPER tier itself in production', () => {
    vi.stubEnv('MODE', 'production');
    expect(() => setEntitlementTier('DEVELOPER')).toThrow(/not permitted in the production/);
    expect(entitlementTierStore.get()).toBe('FREE');
  });

  it('rejects a developer override once running in production, even if DEVELOPER was already set', () => {
    setEntitlementTier('DEVELOPER');
    vi.stubEnv('MODE', 'production');

    expect(() =>
      setDeveloperOverride({ mode: 'DEVELOPER_OVERRIDE', disabledLimits: [], limitValues: { maxIterations: 3 } }),
    ).toThrow(/not permitted in the 'production'/);
    expect(developerOverrideStore.get()).toEqual(STANDARD_OVERRIDE);
  });

  it('drops an active override when the tier is switched away from DEVELOPER', () => {
    setEntitlementTier('DEVELOPER');
    setDeveloperOverride({ mode: 'DEVELOPER_OVERRIDE', disabledLimits: [], limitValues: { maxIterations: 3 } });
    expect(developerOverrideStore.get().mode).toBe('DEVELOPER_OVERRIDE');

    setEntitlementTier('FREE');
    expect(developerOverrideStore.get()).toEqual(STANDARD_OVERRIDE);
  });

  it('resets an override back to STANDARD on request', () => {
    setEntitlementTier('DEVELOPER');
    setDeveloperOverride({ mode: 'DEVELOPER_OVERRIDE', disabledLimits: ['maxTokens'], limitValues: {} });
    expect(getBudgetPolicyDiagnostics().overrideActive).toBe(true);

    resetDeveloperOverride();
    expect(getBudgetPolicyDiagnostics().overrideActive).toBe(false);
  });

  it('diagnostics report FREE tier with no override outside DEVELOPER', () => {
    const diagnostics = getBudgetPolicyDiagnostics();
    expect(diagnostics.tier).toBe('FREE');
    expect(diagnostics.overrideActive).toBe(false);
  });
});
