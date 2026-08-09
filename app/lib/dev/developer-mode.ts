import { atom } from 'nanostores';
import {
  resolveBudgetPolicy,
  STANDARD_OVERRIDE,
  type BudgetPolicyDiagnostics,
  type DeveloperOverride,
  type EntitlementTier,
} from '~/lib/orchestrator/entitlement';
import { getRuntimeEnvironment } from './runtime-environment';

/**
 * App-level wiring between the orchestrator's pure entitlement/budget-policy
 * contract and this host's runtime environment. This is deliberately the
 * "kleiner Developer-Diagnostics-Punkt" the product owner asked for, not a
 * developer console -- a future console reads getBudgetPolicyDiagnostics()
 * and calls the setters below, nothing more is needed here yet.
 */

export const entitlementTierStore = atom<EntitlementTier>('FREE');
export const developerOverrideStore = atom<DeveloperOverride>(STANDARD_OVERRIDE);

/**
 * Switching tiers away from DEVELOPER always drops any active override --
 * a leftover override must never keep affecting a FREE or PREMIUM session.
 * Switching *to* DEVELOPER in production is rejected outright: even though
 * DEVELOPER's own base budget equals PREMIUM's (see entitlement.ts), nothing
 * in this host should be able to even hold that tier value in production.
 */
export function setEntitlementTier(tier: EntitlementTier): void {
  if (tier === 'DEVELOPER' && getRuntimeEnvironment() === 'production') {
    throw new Error("entitlement tier 'DEVELOPER' is not permitted in the production runtime environment");
  }

  if (tier !== 'DEVELOPER' && developerOverrideStore.get().mode !== 'STANDARD') {
    developerOverrideStore.set(STANDARD_OVERRIDE);
  }

  entitlementTierStore.set(tier);
}

/**
 * Validates the override against the current tier and runtime environment
 * before committing it to the store -- resolveBudgetPolicy throws on an
 * invalid or disallowed combination, so an override never reaches the store
 * unvalidated.
 */
export function setDeveloperOverride(override: DeveloperOverride): void {
  resolveBudgetPolicy(entitlementTierStore.get(), getRuntimeEnvironment(), override);
  developerOverrideStore.set(override);
}

export function resetDeveloperOverride(): void {
  developerOverrideStore.set(STANDARD_OVERRIDE);
}

export function getBudgetPolicyDiagnostics(): BudgetPolicyDiagnostics {
  return resolveBudgetPolicy(entitlementTierStore.get(), getRuntimeEnvironment(), developerOverrideStore.get())
    .diagnostics;
}
