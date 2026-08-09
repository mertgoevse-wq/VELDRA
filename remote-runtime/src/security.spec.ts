import { describe, expect, it } from 'vitest';
import { getConfiguredToken, MIN_RUNTIME_TOKEN_LENGTH, validateToken } from './auth.js';
import { isAllowedCorsOrigin } from './security.js';

describe('Remote Runtime security policy', () => {
  it('does not accept a fallback or weak token when authentication is unconfigured', () => {
    expect(getConfiguredToken({})).toBeUndefined();
    expect(getConfiguredToken({ REMOTE_RUNTIME_TOKEN: 'change-me' })).toBeUndefined();
    expect(getConfiguredToken({ REMOTE_RUNTIME_TOKEN: 'x'.repeat(MIN_RUNTIME_TOKEN_LENGTH) })).toBe(
      'x'.repeat(MIN_RUNTIME_TOKEN_LENGTH),
    );
    expect(validateToken('change-me', undefined)).toBe(false);
  });

  it('compares configured tokens and rejects mismatches', () => {
    const configuredToken = 'r'.repeat(MIN_RUNTIME_TOKEN_LENGTH);

    expect(validateToken(configuredToken, configuredToken)).toBe(true);
    expect(validateToken('wrong-secret', configuredToken)).toBe(false);
    expect(validateToken(configuredToken, ` ${configuredToken} `)).toBe(false);
  });

  it('allows native and explicitly configured origins while denying unknown production origins', () => {
    const production = {
      NODE_ENV: 'production',
      REMOTE_RUNTIME_ALLOWED_ORIGINS: 'https://veldra.example, capacitor://trusted',
    };

    expect(isAllowedCorsOrigin(undefined, production)).toBe(true);
    expect(isAllowedCorsOrigin('capacitor://trusted', production)).toBe(true);
    expect(isAllowedCorsOrigin('https://veldra.example', production)).toBe(true);
    expect(isAllowedCorsOrigin('https://malicious.example', production)).toBe(false);
  });

  it('allows localhost origins only outside production', () => {
    expect(isAllowedCorsOrigin('http://localhost:5173', { NODE_ENV: 'development' })).toBe(true);
    expect(isAllowedCorsOrigin('capacitor://localhost', { NODE_ENV: 'development' })).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:5173', { NODE_ENV: 'production' })).toBe(false);
  });
});
