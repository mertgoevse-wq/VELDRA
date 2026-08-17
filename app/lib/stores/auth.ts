/**
 * VELDRA Account Auth Store
 *
 * Wraps Supabase Auth (sign in/up/out, session persistence) for VELDRA's own backend project --
 * see docs/architecture/ENTITLEMENT_AND_SECURITY.md. On a real session, fetches the
 * server-authoritative entitlement (`serverEntitlementClient.ts`) and pushes it into
 * `entitlementTierStore`; that store remains UI-only, the server call is the real check.
 *
 * Distinct from `~/lib/stores/supabase.ts` (a user's own project connection, unrelated feature).
 */

import { atom } from 'nanostores';
import type { Session, User } from '@supabase/supabase-js';
import { getVeldraSupabaseClient, isVeldraAuthConfigured } from '~/lib/auth/veldraSupabaseClient';
import { fetchServerEntitlement, ServerEntitlementError } from '~/lib/entitlement/serverEntitlementClient';
import { setEntitlementTier } from '~/lib/stores/entitlement';

export type AuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  error: string | null;
}

export const authStore = atom<AuthState>({
  status: isVeldraAuthConfigured() ? 'loading' : 'unconfigured',
  user: null,
  session: null,
  error: null,
});

function functionsUrl(projectUrl: string): string {
  return `${projectUrl.replace(/\/$/, '')}/functions/v1`;
}

async function refreshServerEntitlement(session: Session): Promise<void> {
  const backendUrl = import.meta.env?.VITE_VELDRA_BACKEND_URL as string | undefined;
  const anonKey = import.meta.env?.VITE_VELDRA_BACKEND_ANON_KEY as string | undefined;

  if (!backendUrl || !anonKey) {
    return;
  }

  try {
    const entitlement = await fetchServerEntitlement(
      { backendUrl: functionsUrl(backendUrl), anonKey },
      session.access_token,
    );
    setEntitlementTier(entitlement.tier);
  } catch (error) {
    /*
     * Server entitlement is unreachable/stale -- leave the last-known local tier as-is rather
     * than guessing FREE or PREMIUM (see serverEntitlementClient.ts's own contract).
     */
    console.warn('[auth] failed to refresh server entitlement', error);
  }
}

function applySession(session: Session | null): void {
  if (!session) {
    authStore.set({ status: 'signed-out', user: null, session: null, error: null });
    setEntitlementTier('FREE');

    return;
  }

  authStore.set({ status: 'signed-in', user: session.user, session, error: null });
  void refreshServerEntitlement(session);
}

let initialized = false;

/** Call once at app startup (client-only) to restore any persisted session and subscribe to changes. */
export function initVeldraAuth(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const client = getVeldraSupabaseClient();

  if (!client) {
    authStore.set({ status: 'unconfigured', user: null, session: null, error: null });
    return;
  }

  client.auth.getSession().then(({ data }) => applySession(data.session));
  client.auth.onAuthStateChange((_event, session) => applySession(session));
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = getVeldraSupabaseClient();

  if (!client) {
    authStore.set({ ...authStore.get(), error: 'VELDRA account backend is not configured.' });
    return;
  }

  authStore.set({ ...authStore.get(), status: 'loading', error: null });

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    authStore.set({ status: 'signed-out', user: null, session: null, error: error.message });
    return;
  }

  applySession(data.session);
}

export async function signUpWithPassword(email: string, password: string): Promise<void> {
  const client = getVeldraSupabaseClient();

  if (!client) {
    authStore.set({ ...authStore.get(), error: 'VELDRA account backend is not configured.' });
    return;
  }

  authStore.set({ ...authStore.get(), status: 'loading', error: null });

  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    authStore.set({ status: 'signed-out', user: null, session: null, error: error.message });
    return;
  }

  /*
   * Email confirmation may be required -- signUp returns a session only once confirmed (or if
   * confirmation is disabled project-side); applySession handles either case honestly.
   */
  applySession(data.session);

  if (!data.session) {
    authStore.set({
      status: 'signed-out',
      user: null,
      session: null,
      error: 'Check your email to confirm your account, then sign in.',
    });
  }
}

export async function signOut(): Promise<void> {
  const client = getVeldraSupabaseClient();

  if (!client) {
    return;
  }

  await client.auth.signOut();
  applySession(null);
}

export function isServerEntitlementError(error: unknown): error is ServerEntitlementError {
  return error instanceof ServerEntitlementError;
}
