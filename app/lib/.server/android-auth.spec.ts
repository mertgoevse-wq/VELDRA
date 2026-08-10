import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAndroidApiAuth, extractBearerToken } from './android-auth';

const CONFIGURED_TOKEN = 'a-long-random-backend-secret-1234567890';

function requestWithAuth(header?: string): Request {
  const headers = new Headers();

  if (header !== undefined) {
    headers.set('Authorization', header);
  }

  return new Request('https://example.test/api/android/models', { headers });
}

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed Authorization header', () => {
    expect(extractBearerToken(requestWithAuth('Bearer abc123'))).toBe('abc123');
  });

  it('returns undefined when the header is missing', () => {
    expect(extractBearerToken(requestWithAuth())).toBeUndefined();
  });

  it('returns undefined when the header does not use the Bearer scheme', () => {
    expect(extractBearerToken(requestWithAuth('Basic abc123'))).toBeUndefined();
  });
});

describe('checkAndroidApiAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed with 500 when no backend token is configured', async () => {
    const result = checkAndroidApiAuth(requestWithAuth(`Bearer ${CONFIGURED_TOKEN}`), { cloudflare: { env: {} } });
    expect(result).not.toBeNull();
    expect(result?.status).toBe(500);

    const body = await result?.json();
    expect(body).toMatchObject({ ok: false });
  });

  it('rejects a request with no Authorization header', async () => {
    const result = checkAndroidApiAuth(requestWithAuth(), {
      cloudflare: { env: { ANDROID_API_BACKEND_TOKEN: CONFIGURED_TOKEN } },
    });
    expect(result?.status).toBe(401);
  });

  it('rejects a request with the wrong token', () => {
    const result = checkAndroidApiAuth(requestWithAuth('Bearer wrong-token'), {
      cloudflare: { env: { ANDROID_API_BACKEND_TOKEN: CONFIGURED_TOKEN } },
    });
    expect(result?.status).toBe(401);
  });

  it('rejects a token that is a prefix or superset of the configured token', () => {
    const short = checkAndroidApiAuth(requestWithAuth(`Bearer ${CONFIGURED_TOKEN.slice(0, -1)}`), {
      cloudflare: { env: { ANDROID_API_BACKEND_TOKEN: CONFIGURED_TOKEN } },
    });
    const long = checkAndroidApiAuth(requestWithAuth(`Bearer ${CONFIGURED_TOKEN}x`), {
      cloudflare: { env: { ANDROID_API_BACKEND_TOKEN: CONFIGURED_TOKEN } },
    });
    expect(short?.status).toBe(401);
    expect(long?.status).toBe(401);
  });

  it('authorizes a request with the correct token', () => {
    const result = checkAndroidApiAuth(requestWithAuth(`Bearer ${CONFIGURED_TOKEN}`), {
      cloudflare: { env: { ANDROID_API_BACKEND_TOKEN: CONFIGURED_TOKEN } },
    });
    expect(result).toBeNull();
  });

  it('reads the token from process.env when no cloudflare context is present', () => {
    vi.stubEnv('ANDROID_API_BACKEND_TOKEN', CONFIGURED_TOKEN);

    const result = checkAndroidApiAuth(requestWithAuth(`Bearer ${CONFIGURED_TOKEN}`), {});
    expect(result).toBeNull();
  });
});
