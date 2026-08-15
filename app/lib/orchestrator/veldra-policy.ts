import type { PolicyGate } from './types';
import type { EntitlementCapability, EntitlementTier } from './entitlement';
import { hasCapability } from './entitlement';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('veldra-policy');

const KNOWN_CAPABILITIES: ReadonlySet<string> = new Set<EntitlementCapability>([
  'connectors',
  'mcp-servers',
  'custom-agents',
  'custom-skills',
  'custom-providers',
  'advanced-agent-swarms',
  'premium-transports',
]);

/**
 * VELDRA-app's PolicyGate: real entitlement-tier gating via app/lib/orchestrator/
 * entitlement.ts's hasCapability(), not a stub that always allows.
 *
 * SECURITY: same limit entitlement.ts's own consumer (app/lib/stores/entitlement.ts)
 * already documents -- this is a client-side, UI-facing gate (gives the orchestrator an
 * honest "denied, here's why" instead of silently attempting something the user's tier
 * doesn't include). It is NOT a security boundary; a modified client could report any
 * tier it likes. Real enforcement of premium capabilities belongs server-side --
 * unbuilt today (see CLAUDE.md's Known Limitations and docs/ai-state/ROADMAP.md P2).
 * D-007 (project/DECISIONS.md) requires this limitation stay documented, not silently
 * assumed away by whoever next reads this file.
 *
 * A capability string this gate doesn't recognize (i.e. not one of
 * EntitlementCapability's values) is allowed by default -- this gate's only job is
 * entitlement-tier gating (see PolicyGate's own doc comment in types.ts: "premium
 * tiers, org policy, provider allow-lists"); it is not a general-purpose authorization
 * system, and a policy check for something outside that scope isn't this gate's call to
 * make.
 */
export function createVeldraPolicyGate(getTier: () => EntitlementTier): PolicyGate {
  return {
    async check(capability: string, context?: Record<string, unknown>): Promise<string | null> {
      if (!KNOWN_CAPABILITIES.has(capability)) {
        logger.debug('Policy check for an unrecognized capability, allowing by default', { capability, context });
        return null;
      }

      const tier = getTier();
      const allowed = hasCapability(tier, capability as EntitlementCapability);

      if (allowed) {
        logger.debug('Policy check allowed', { capability, tier, context });
        return null;
      }

      const reason = `'${capability}' requires a higher tier than your current plan (${tier}).`;
      logger.info('Policy check denied', { capability, tier, context });

      return reason;
    },
  };
}
