// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ANDROID_API_BACKEND_TOKEN_KEY,
  ANDROID_API_BACKEND_URL_KEY,
  getAndroidApiBackendConfig,
  getAndroidEnhanceRequest,
  getAndroidModelsRequest,
} from './backend-config';

describe('getAndroidApiBackendConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when no backend URL is configured', () => {
    expect(getAndroidApiBackendConfig()).toBeNull();
  });

  it('returns null when the stored URL is only whitespace', () => {
    localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, '   ');
    expect(getAndroidApiBackendConfig()).toBeNull();
  });

  it('reads and trims the configured URL and token', () => {
    localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, '  https://api.example.test/android/  ');
    localStorage.setItem(ANDROID_API_BACKEND_TOKEN_KEY, '  secret-token  ');

    expect(getAndroidApiBackendConfig()).toEqual({
      url: 'https://api.example.test/android',
      token: 'secret-token',
    });
  });

  it('defaults the token to an empty string when not set', () => {
    localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, 'https://api.example.test');
    expect(getAndroidApiBackendConfig()).toEqual({ url: 'https://api.example.test', token: '' });
  });
});

describe('getAndroidModelsRequest', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when no backend is configured', () => {
    expect(getAndroidModelsRequest()).toBeNull();
  });

  it('builds the bridge URL with an Authorization header when a token is set', () => {
    localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, 'https://api.example.test');
    localStorage.setItem(ANDROID_API_BACKEND_TOKEN_KEY, 'secret-token');

    expect(getAndroidModelsRequest()).toEqual({
      url: 'https://api.example.test/api/android/models',
      headers: { Authorization: 'Bearer secret-token' },
    });
  });

  it('omits the Authorization header when no token is configured', () => {
    localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, 'https://api.example.test');

    expect(getAndroidModelsRequest()).toEqual({
      url: 'https://api.example.test/api/android/models',
      headers: {},
    });
  });

  it('adds a provider query parameter when requesting a single provider', () => {
    localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, 'https://api.example.test');

    expect(getAndroidModelsRequest('Anthropic')).toEqual({
      url: 'https://api.example.test/api/android/models?provider=Anthropic',
      headers: {},
    });
  });
});

describe('getAndroidEnhanceRequest', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when no backend is configured', () => {
    expect(getAndroidEnhanceRequest()).toBeNull();
  });

  it('builds the bridge URL with an Authorization header when a token is set', () => {
    localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, 'https://api.example.test');
    localStorage.setItem(ANDROID_API_BACKEND_TOKEN_KEY, 'secret-token');

    expect(getAndroidEnhanceRequest()).toEqual({
      url: 'https://api.example.test/api/android/enhance',
      headers: { Authorization: 'Bearer secret-token' },
    });
  });
});
