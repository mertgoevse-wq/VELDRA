// VELDRA backend: GET /entitlement -- the server-side source of truth described in
// docs/architecture/ENTITLEMENT_AND_SECURITY.md §2.4/§3.5.
//
// Not deployed by this commit. Runs on Supabase's Deno Edge Function runtime, a separately
// deployed artifact -- importing @supabase/supabase-js via an ESM URL here does NOT add it as a
// dependency of the main app's package.json/pnpm-lock.
//
// Deno's `serve` and `Deno.env` are runtime globals provided by the Supabase Edge Functions
// environment, not resolvable by this repo's own tsc/eslint config -- this file is intentionally
// excluded from both (see tsconfig.json/eslint config) the same way remote-runtime/ already is
// for its own separately-run Node process.

// @ts-nocheck -- Deno runtime globals (serve, Deno.env) are not typed in this repo's Node/TS setup.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface EntitlementResponse {
  tier: 'FREE' | 'PREMIUM' | 'PRO' | 'DEVELOPER';
  expiresAt: string | null;
  capabilities: string[];
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  /*
   * Created per-request with the caller's own JWT (not the service role key) so every query
   * this client makes runs AS that user -- RLS (0001_entitlements.sql's "entitlements_select_own"
   * policy) is what actually enforces "only your own row," not this function's own logic. Even a
   * bug here that queried by the wrong id, or omitted a WHERE clause entirely, could not leak
   * another user's row.
   */
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { data, error } = await supabase
    .from('entitlements')
    .select('tier, expires_at, capabilities')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to load entitlement' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // No row yet (e.g. a brand-new sign-up) is a real, expected state -- FREE tier, not an error.
  const body: EntitlementResponse = data
    ? { tier: data.tier, expiresAt: data.expires_at, capabilities: data.capabilities ?? [] }
    : { tier: 'FREE', expiresAt: null, capabilities: [] };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
