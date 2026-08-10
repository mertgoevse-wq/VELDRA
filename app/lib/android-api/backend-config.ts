/**
 * Shared with app/components/mobile/AndroidSettingsPanel.tsx, which owns the
 * Save/Test UI for these same localStorage keys -- kept here too so the chat
 * transport (Chat.client.tsx) doesn't need to import a settings component.
 */
export const ANDROID_API_BACKEND_URL_KEY = 'bolt_android_api_backend_url';
export const ANDROID_API_BACKEND_TOKEN_KEY = 'bolt_android_api_backend_token';

export interface AndroidApiBackendConfig {
  url: string;
  token: string;
}

/** Returns null when no backend URL is configured -- callers must show a "not configured" state, never silently fall back. */
export function getAndroidApiBackendConfig(): AndroidApiBackendConfig | null {
  try {
    const url = localStorage.getItem(ANDROID_API_BACKEND_URL_KEY)?.trim();

    if (!url) {
      return null;
    }

    return { url: url.replace(/\/$/, ''), token: localStorage.getItem(ANDROID_API_BACKEND_TOKEN_KEY)?.trim() ?? '' };
  } catch {
    return null;
  }
}

export interface AndroidApiRequest {
  url: string;
  headers: HeadersInit;
}

function buildAndroidApiRequest(routePath: string, query?: Record<string, string>): AndroidApiRequest | null {
  const backend = getAndroidApiBackendConfig();

  if (!backend) {
    return null;
  }

  const url = new URL(`${backend.url}${routePath}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  return {
    url: url.toString(),
    headers: backend.token ? { Authorization: `Bearer ${backend.token}` } : {},
  };
}

/**
 * Resolves the Android bridge's model-list endpoint (see app/routes/api.android.models.ts).
 * Returns null when no backend is configured -- callers must not fall back to the relative
 * '/api/models' route, which does not exist inside the Android WebView (no server process).
 */
export function getAndroidModelsRequest(provider?: string): AndroidApiRequest | null {
  return buildAndroidApiRequest('/api/android/models', provider ? { provider } : undefined);
}

/**
 * Resolves the Android bridge's prompt-enhancement endpoint (see
 * app/routes/api.android.enhance.ts). Returns null when no backend is configured -- callers
 * must not fall back to the relative '/api/enhancer' route, which does not exist inside the
 * Android WebView.
 */
export function getAndroidEnhanceRequest(): AndroidApiRequest | null {
  return buildAndroidApiRequest('/api/android/enhance');
}
