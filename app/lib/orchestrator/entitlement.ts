import { MAX_IDENTICAL_FAILURES } from './budget';
import type { CheckedLimit } from './budget';
import type { Budget } from './types';

/**
 * Entitlement, Budget Policy and Developer Override.
 *
 * Pure and host-agnostic, like the rest of ./ -- no bundler global is read
 * here. The runtime environment (development/test/production) is a value the
 * caller supplies, not something this module discovers itself; the Vite
 * adapter that reads it lives at app/lib/dev/runtime-environment.ts, outside
 * the core, same separation as every other host port in ./adapters.
 */

/**
 * DEVELOPER changes what MAY be overridden (see resolveBudgetPolicy); by itself it is not a
 * bypass. PRO is the customer-facing top commercial tier -- distinct from DEVELOPER, which stays
 * an internal, non-production-only override tier (see ENVIRONMENTS_ALLOWING_OVERRIDE) and must
 * never be repurposed as a paid tier.
 */
export type EntitlementTier = 'FREE' | 'PREMIUM' | 'PRO' | 'DEVELOPER';

export type RuntimeEnvironment = 'development' | 'test' | 'production';

export type BudgetPolicyMode = 'STANDARD' | 'DEVELOPER_OVERRIDE' | 'LIMIT_SIMULATION';

/** The four budget limits plus the failure-repeat threshold -- everything a developer may deliberately reconfigure. */
export type OverridableLimit = CheckedLimit | 'maxIdenticalFailures';

/**
 * A developer's explicit, auditable request to change bounded-execution
 * enforcement. STANDARD carries no changes; DEVELOPER_OVERRIDE sets working
 * limits; LIMIT_SIMULATION deliberately sets small ones to make a workflow
 * hit its ceiling reproducibly. The two override modes differ only in intent
 * and in how diagnostics labels them -- both go through the same validation
 * and the same absolute ceiling.
 */
export interface DeveloperOverride {
  mode: BudgetPolicyMode;

  /** Limits to run without a practical ceiling. Still capped -- see ABSOLUTE_CEILING. */
  disabledLimits: OverridableLimit[];

  /** Explicit replacement value per limit. */
  limitValues: Partial<Record<OverridableLimit, number>>;
}

export const STANDARD_OVERRIDE: DeveloperOverride = { mode: 'STANDARD', disabledLimits: [], limitValues: {} };

export interface BudgetPolicyViolation {
  reason: string;
}

/** development and test may request an override; production may not, unconditionally. */
const ENVIRONMENTS_ALLOWING_OVERRIDE: RuntimeEnvironment[] = ['development', 'test'];

/**
 * Base limits per tier. DEVELOPER's own baseline equals PRO's, the highest customer-facing tier:
 * being a developer changes what you are allowed to override, not what you get by default, so
 * switching to DEVELOPER without an active override is never a silent limit change -- and it
 * matches what the top paying tier actually experiences, not an arbitrary developer-only number.
 */
const TIER_BUDGETS: Record<EntitlementTier, Budget> = {
  FREE: { maxWallClockMs: 2 * 60_000, maxTokens: 50_000, maxCostMinor: 0, maxIterations: 5, maxConcurrency: 1 },
  PREMIUM: {
    maxWallClockMs: 30 * 60_000,
    maxTokens: 2_000_000,
    maxCostMinor: 5_000,
    maxIterations: 50,
    maxConcurrency: 4,
  },
  PRO: {
    maxWallClockMs: 45 * 60_000,
    maxTokens: 8_000_000,
    maxCostMinor: 20_000,
    maxIterations: 150,
    maxConcurrency: 8,
  },
  DEVELOPER: {
    maxWallClockMs: 45 * 60_000,
    maxTokens: 8_000_000,
    maxCostMinor: 20_000,
    maxIterations: 150,
    maxConcurrency: 8,
  },
};

/**
 * Binary, all-or-nothing product features gated by tier -- distinct from the numeric Budget
 * ceilings above. Graduated differences ("more models," "more themes," "more local models") are
 * deliberately NOT modelled as capabilities here: those are filtered by the model catalog, theme
 * registry, and local-model count elsewhere, per tier, not by an on/off flag. A capability here is
 * something a user either has or does not have, no partial state.
 */
export type EntitlementCapability =
  | 'connectors'
  | 'mcp-servers'
  | 'custom-agents'
  | 'custom-skills'
  | 'custom-providers'
  | 'advanced-agent-swarms'
  | 'premium-transports';

const TIER_CAPABILITIES: Record<EntitlementTier, ReadonlySet<EntitlementCapability>> = {
  FREE: new Set(),
  PREMIUM: new Set(['connectors', 'premium-transports']),
  PRO: new Set([
    'connectors',
    'premium-transports',
    'mcp-servers',
    'custom-agents',
    'custom-skills',
    'custom-providers',
    'advanced-agent-swarms',
  ]),
  DEVELOPER: new Set([
    'connectors',
    'premium-transports',
    'mcp-servers',
    'custom-agents',
    'custom-skills',
    'custom-providers',
    'advanced-agent-swarms',
  ]),
};

/** Pure, host-agnostic capability check -- no UI should hardcode a tier comparison itself. */
export function hasCapability(tier: EntitlementTier, capability: EntitlementCapability): boolean {
  return TIER_CAPABILITIES[tier].has(capability);
}

/** All capabilities a tier currently has, for a settings UI to render without repeated lookups. */
export function listCapabilities(tier: EntitlementTier): EntitlementCapability[] {
  return Array.from(TIER_CAPABILITIES[tier]);
}

/**
 * Absolute host/runtime ceiling. No tier, override, or "disabled" limit may
 * ever exceed this -- it is what keeps "unlimited" from meaning "no
 * protection against a runaway loop, unbounded cost, or a hung process."
 * maxConcurrency is deliberately not part of OverridableLimit (concurrency is
 * a resource-fanout control, not a workflow limit a test needs to simulate)
 * and is kept here only for reference alongside the other ceilings.
 */
export const ABSOLUTE_CEILING: Record<OverridableLimit, number> = {
  maxWallClockMs: 60 * 60_000,
  maxTokens: 20_000_000,
  maxCostMinor: 100_000,
  maxIterations: 500,
  maxIdenticalFailures: 20,
};

const BUDGET_FIELD_FOR_LIMIT: Record<CheckedLimit, keyof Budget> = {
  maxWallClockMs: 'maxWallClockMs',
  maxTokens: 'maxTokens',
  maxCostMinor: 'maxCostMinor',
  maxIterations: 'maxIterations',
};

export interface BudgetPolicyLimitDiagnostic {
  limit: OverridableLimit;
  value: number;

  /** True when 'disabled' was requested for this limit -- value is still ABSOLUTE_CEILING[limit], never Infinity. */
  displayUnlimited: boolean;

  source: 'tier-default' | 'developer-override' | 'limit-simulation';
}

export interface BudgetPolicyDiagnostics {
  tier: EntitlementTier;
  environment: RuntimeEnvironment;
  mode: BudgetPolicyMode;
  overrideActive: boolean;
  limits: BudgetPolicyLimitDiagnostic[];
}

export interface BudgetPolicyResult {
  budget: Budget;
  maxIdenticalFailures: number;
  diagnostics: BudgetPolicyDiagnostics;
}

/**
 * Checks a proposed override before it is ever applied. Returns the reason it
 * would be rejected, or null when it may proceed. Never throws -- callers
 * that want a hard failure (resolveBudgetPolicy) do that themselves so the
 * check itself stays usable for a UI that wants to explain *why* a control is
 * disabled, not just that it is.
 */
export function validateDeveloperOverride(
  tier: EntitlementTier,
  environment: RuntimeEnvironment,
  override: DeveloperOverride,
): BudgetPolicyViolation | null {
  if (override.mode === 'STANDARD') {
    if (override.disabledLimits.length > 0 || Object.keys(override.limitValues).length > 0) {
      return { reason: "mode 'STANDARD' must not carry disabled limits or overridden values" };
    }

    return null;
  }

  if (tier !== 'DEVELOPER') {
    return { reason: `developer override requires tier DEVELOPER, got ${tier}` };
  }

  if (!ENVIRONMENTS_ALLOWING_OVERRIDE.includes(environment)) {
    return { reason: `developer override is not permitted in the '${environment}' runtime environment` };
  }

  if (override.disabledLimits.length === 0 && Object.keys(override.limitValues).length === 0) {
    return { reason: `mode '${override.mode}' requires at least one disabled limit or overridden value` };
  }

  for (const limit of override.disabledLimits) {
    if (Object.prototype.hasOwnProperty.call(override.limitValues, limit)) {
      return { reason: `limit '${limit}' cannot be both disabled and set to an explicit value` };
    }
  }

  for (const [limit, value] of Object.entries(override.limitValues) as Array<[OverridableLimit, number]>) {
    if (!Number.isFinite(value) || value <= 0) {
      return { reason: `limit '${limit}' must be a positive finite number, got ${value}` };
    }

    if (value > ABSOLUTE_CEILING[limit]) {
      return { reason: `limit '${limit}' value ${value} exceeds the absolute ceiling ${ABSOLUTE_CEILING[limit]}` };
    }
  }

  return null;
}

function buildDiagnostics(
  tier: EntitlementTier,
  environment: RuntimeEnvironment,
  budget: Budget,
  maxIdenticalFailures: number,
  mode: BudgetPolicyMode,
  disabled: ReadonlySet<OverridableLimit>,
  changed: ReadonlySet<OverridableLimit>,
): BudgetPolicyDiagnostics {
  const limitOf = (limit: OverridableLimit): number =>
    limit === 'maxIdenticalFailures' ? maxIdenticalFailures : budget[BUDGET_FIELD_FOR_LIMIT[limit]];

  const allLimits: OverridableLimit[] = [
    'maxWallClockMs',
    'maxTokens',
    'maxCostMinor',
    'maxIterations',
    'maxIdenticalFailures',
  ];

  return {
    tier,
    environment,
    mode,
    overrideActive: mode !== 'STANDARD',
    limits: allLimits.map((limit) => ({
      limit,
      value: limitOf(limit),
      displayUnlimited: disabled.has(limit),
      source:
        disabled.has(limit) || changed.has(limit)
          ? mode === 'LIMIT_SIMULATION'
            ? 'limit-simulation'
            : 'developer-override'
          : 'tier-default',
    })),
  };
}

/**
 * Resolves what actually governs a run: tier defaults, optionally replaced by
 * a validated developer override. Throws on an invalid or disallowed
 * override rather than silently falling back to tier defaults -- an override
 * request that cannot be honoured must be visible as a rejection, not
 * absorbed quietly.
 */
export function resolveBudgetPolicy(
  tier: EntitlementTier,
  environment: RuntimeEnvironment,
  override: DeveloperOverride = STANDARD_OVERRIDE,
): BudgetPolicyResult {
  const base = TIER_BUDGETS[tier];

  if (override.mode === 'STANDARD') {
    return {
      budget: base,
      maxIdenticalFailures: MAX_IDENTICAL_FAILURES,
      diagnostics: buildDiagnostics(tier, environment, base, MAX_IDENTICAL_FAILURES, 'STANDARD', new Set(), new Set()),
    };
  }

  const violation = validateDeveloperOverride(tier, environment, override);

  if (violation) {
    throw new Error(`invalid developer override: ${violation.reason}`);
  }

  const budget = { ...base };
  let maxIdenticalFailures = MAX_IDENTICAL_FAILURES;
  const disabled = new Set(override.disabledLimits);
  const changed = new Set(Object.keys(override.limitValues) as OverridableLimit[]);

  const applyValue = (limit: OverridableLimit, value: number): void => {
    if (limit === 'maxIdenticalFailures') {
      maxIdenticalFailures = value;
    } else {
      budget[BUDGET_FIELD_FOR_LIMIT[limit]] = value;
    }
  };

  for (const limit of override.disabledLimits) {
    applyValue(limit, ABSOLUTE_CEILING[limit]);
  }

  for (const [limit, value] of Object.entries(override.limitValues) as Array<[OverridableLimit, number]>) {
    applyValue(limit, value);
  }

  return {
    budget,
    maxIdenticalFailures,
    diagnostics: buildDiagnostics(tier, environment, budget, maxIdenticalFailures, override.mode, disabled, changed),
  };
}

/** Renders diagnostics as short human-readable lines, e.g. for a future developer console. */
export function formatBudgetPolicyDiagnostics(diagnostics: BudgetPolicyDiagnostics): string[] {
  const label = (limit: BudgetPolicyLimitDiagnostic): string =>
    limit.displayUnlimited ? `UNLIMITED (capped at ${limit.value})` : String(limit.value);

  return [
    `Tier: ${diagnostics.tier}`,
    `Budget override: ${diagnostics.overrideActive ? `ENABLED (${diagnostics.mode})` : 'DISABLED'}`,
    ...diagnostics.limits.map((limit) => `${limit.limit}: ${label(limit)}`),
  ];
}
