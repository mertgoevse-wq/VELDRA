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
