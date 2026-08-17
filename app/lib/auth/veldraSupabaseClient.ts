import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Auth-only client for VELDRA's OWN backend project (see
 * docs/architecture/ENTITLEMENT_AND_SECURITY.md). Distinct from `~/lib/stores/supabase.ts`,
 * which manages a user's OWN Supabase project connection for apps they're building -- an
 * unrelated feature. This client is used solely for Supabase Auth (sign in/up/out, session
 * persistence); the entitlement read itself still goes through `serverEntitlementClient.ts`'s
 * plain `fetch`, not this SDK.
 */

let client: SupabaseClient | null | undefined;

export function getVeldraSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) {
    return client;
  }

  const url = import.meta.env?.VITE_VELDRA_BACKEND_URL as string | undefined;
  const anonKey = import.meta.env?.VITE_VELDRA_BACKEND_ANON_KEY as string | undefined;

  client = url && anonKey ? createClient(url, anonKey) : null;

  return client;
}

export function isVeldraAuthConfigured(): boolean {
  return getVeldraSupabaseClient() !== null;
}
