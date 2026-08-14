/**
 * Entitlement Store
 *
 * Exposes the current user tier and capability checks to UI components.
 * The authoritative enforcement lives server-side; this store is for
 * UI state only (show/hide features, display upgrade prompts).
 *
 * SECURITY: Never use this as a final authorization gate. Premium features
 * must be enforced on the backend. Client-side entitlement state is informational only.
 */

import { atom, computed } from 'nanostores';
import type { EntitlementTier, EntitlementCapability } from '~/lib/orchestrator/entitlement';
import { hasCapability, listCapabilities } from '~/lib/orchestrator/entitlement';

const ENTITLEMENT_STORAGE_KEY = 'veldra_entitlement_tier';

function loadTier(): EntitlementTier {
  try {
    const stored = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);

    if (stored === 'FREE' || stored === 'PREMIUM' || stored === 'PRO' || stored === 'DEVELOPER') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 'FREE';
}

export const entitlementTierStore = atom<EntitlementTier>(loadTier());

export function setEntitlementTier(tier: EntitlementTier): void {
  entitlementTierStore.set(tier);

  try {
    localStorage.setItem(ENTITLEMENT_STORAGE_KEY, tier);
  } catch {
    // ignore
  }
}

/** Check if the current tier has a specific capability */
export const entitlementCapabilitiesStore = computed(entitlementTierStore, (tier) => listCapabilities(tier));

export function checkCapability(capability: EntitlementCapability): boolean {
  return hasCapability(entitlementTierStore.get(), capability);
}

export function isFreeTier(): boolean {
  return entitlementTierStore.get() === 'FREE';
}

export function isPremiumOrAbove(): boolean {
  const tier = entitlementTierStore.get();
  return tier === 'PREMIUM' || tier === 'PRO' || tier === 'DEVELOPER';
}
