import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockOnAuthStateChange, mockSignInWithPassword, mockSignUp, mockSignOut, state } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
    mockSignInWithPassword: vi.fn(),
    mockSignUp: vi.fn(),
    mockSignOut: vi.fn(),
    state: { configured: true },
  }),
);

vi.mock('~/lib/auth/veldraSupabaseClient', () => ({
  getVeldraSupabaseClient: () =>
    state.configured
      ? {
          auth: {
            getSession: mockGetSession,
            onAuthStateChange: mockOnAuthStateChange,
            signInWithPassword: mockSignInWithPassword,
            signUp: mockSignUp,
            signOut: mockSignOut,
          },
        }
      : null,
  isVeldraAuthConfigured: () => state.configured,
}));

const mockFetchServerEntitlement = vi.fn();

vi.mock('~/lib/entitlement/serverEntitlementClient', () => ({
  fetchServerEntitlement: (...args: unknown[]) => mockFetchServerEntitlement(...args),
  ServerEntitlementError: class ServerEntitlementError extends Error {},
}));

import { authStore, initVeldraAuth, signInWithPassword, signOut } from './auth';
import { entitlementTierStore } from './entitlement';

const SESSION = { access_token: 'jwt-abc', user: { id: 'u1', email: 'a@example.com' } } as any;

describe('auth store', () => {
  beforeEach(() => {
    state.configured = true;
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } });
    mockFetchServerEntitlement.mockResolvedValue({ tier: 'PRO', expiresAt: null, capabilities: [] });
    authStore.set({ status: 'loading', user: null, session: null, error: null });
  });

  it('reports unconfigured status when no backend env is set', () => {
    state.configured = false;
    initVeldraAuth();
    expect(authStore.get().status).toBe('unconfigured');
  });

  it('signs in, stores the session, and refreshes server entitlement', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: SESSION }, error: null });

    await signInWithPassword('a@example.com', 'pw');

    expect(authStore.get().status).toBe('signed-in');
    expect(authStore.get().user?.email).toBe('a@example.com');
    expect(mockFetchServerEntitlement).toHaveBeenCalledWith(expect.anything(), 'jwt-abc');
    expect(entitlementTierStore.get()).toBe('PRO');
  });

  it('surfaces a sign-in error without touching entitlement', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'bad creds' } });

    await signInWithPassword('a@example.com', 'wrong');

    expect(authStore.get().status).toBe('signed-out');
    expect(authStore.get().error).toBe('bad creds');
    expect(mockFetchServerEntitlement).not.toHaveBeenCalled();
  });

  it('resets to signed-out and FREE tier on sign out', async () => {
    entitlementTierStore.set('PRO');
    await signOut();

    expect(mockSignOut).toHaveBeenCalled();
    expect(authStore.get().status).toBe('signed-out');
    expect(entitlementTierStore.get()).toBe('FREE');
  });
});
