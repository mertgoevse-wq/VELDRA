import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchServerEntitlement, ServerEntitlementError } from './serverEntitlementClient';

const CONFIG = { backendUrl: 'https://example.supabase.co/functions/v1', anonKey: 'test-anon-key' };

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

describe('fetchServerEntitlement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed entitlement on a valid 200 response', async () => {
    mockFetchOnce(200, { tier: 'PRO', expiresAt: '2027-01-01T00:00:00Z', capabilities: ['spawn-subagent'] });

    const result = await fetchServerEntitlement(CONFIG, 'user-jwt');

    expect(result).toEqual({ tier: 'PRO', expiresAt: '2027-01-01T00:00:00Z', capabilities: ['spawn-subagent'] });
  });

  it('sends both the anon apikey header and the caller bearer token', async () => {
    mockFetchOnce(200, { tier: 'FREE', expiresAt: null, capabilities: [] });

    await fetchServerEntitlement(CONFIG, 'user-jwt-abc');

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.backendUrl}/entitlement`,
      expect.objectContaining({
        headers: { apikey: CONFIG.anonKey, Authorization: 'Bearer user-jwt-abc' },
      }),
    );
  });

  it('throws ServerEntitlementError on a non-2xx response, without guessing a tier', async () => {
    mockFetchOnce(401, { error: 'Invalid or expired session' });

    await expect(fetchServerEntitlement(CONFIG, 'expired-jwt')).rejects.toThrow(ServerEntitlementError);
  });

  it('throws ServerEntitlementError when the response shape is not a valid entitlement', async () => {
    mockFetchOnce(200, { unexpected: 'shape' });

    await expect(fetchServerEntitlement(CONFIG, 'user-jwt')).rejects.toThrow(ServerEntitlementError);
  });

  it('throws ServerEntitlementError with an invalid tier value rather than passing it through', async () => {
    mockFetchOnce(200, { tier: 'GOLD', expiresAt: null, capabilities: [] });

    await expect(fetchServerEntitlement(CONFIG, 'user-jwt')).rejects.toThrow(ServerEntitlementError);
  });

  it('throws ServerEntitlementError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchServerEntitlement(CONFIG, 'user-jwt')).rejects.toThrow(ServerEntitlementError);
  });
});
