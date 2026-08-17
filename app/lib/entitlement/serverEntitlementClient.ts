import type { EntitlementTier } from '~/lib/orchestrator/entitlement';

/**
 * Client for VELDRA's own backend GET /entitlement endpoint (supabase/functions/entitlement) --
 * see docs/architecture/ENTITLEMENT_AND_SECURITY.md §3.5 for the full contract and the
 * comparison that selected Supabase. Called from `stores/auth.ts` after a real sign-in, using
 * the Supabase session's access token; `stores/entitlement.ts` remains a UI-only cache that this
 * call keeps in sync, never the authorization boundary itself.
 *
 * Deliberately plain `fetch`, not the `@supabase/supabase-js` client SDK -- this needs exactly
 * one authenticated GET, not the SDK's realtime/storage/query-builder surface, and adding that
 * dependency to the main app bundle for one endpoint isn't justified.
 */

export interface ServerEntitlement {
  tier: EntitlementTier;
  expiresAt: string | null;
  capabilities: string[];
}

export interface ServerEntitlementConfig {
  /** e.g. VELDRA_BACKEND_URL -- the deployed Edge Function's base URL. */
  backendUrl: string;

  /** e.g. VELDRA_BACKEND_ANON_KEY -- safe to ship client-side; RLS is the real authorization. */
  anonKey: string;
}

export class ServerEntitlementError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ServerEntitlementError';
  }
}

const VALID_TIERS: ReadonlySet<string> = new Set<EntitlementTier>(['FREE', 'PREMIUM', 'PRO', 'DEVELOPER']);

function isServerEntitlement(value: unknown): value is ServerEntitlement {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.tier === 'string' &&
    VALID_TIERS.has(candidate.tier) &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'string') &&
    Array.isArray(candidate.capabilities) &&
    candidate.capabilities.every((c) => typeof c === 'string')
  );
}

/**
 * Fetches the caller's current entitlement from the server. Throws ServerEntitlementError on any
 * non-2xx response or an unexpected response shape -- callers should treat a thrown error as "we
 * don't know the real entitlement right now" (e.g. fall back to the last-cached UI-only tier),
 * never as "assume FREE" or "assume the previous tier still holds," since either guess could be
 * wrong in a way that matters once this is a real security boundary.
 */
export async function fetchServerEntitlement(
  config: ServerEntitlementConfig,
  userAccessToken: string,
): Promise<ServerEntitlement> {
  let response: Response;

  try {
    response = await fetch(`${config.backendUrl}/entitlement`, {
      method: 'GET',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${userAccessToken}`,
      },
    });
  } catch (error) {
    throw new ServerEntitlementError(
      `Failed to reach entitlement backend: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new ServerEntitlementError(`Server entitlement check failed (${response.status})`, response.status);
  }

  const data: unknown = await response.json();

  if (!isServerEntitlement(data)) {
    throw new ServerEntitlementError('Server returned an unexpected entitlement response shape');
  }

  return data;
}
