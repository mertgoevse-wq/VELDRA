/**
 * Base URL for this app's own `/api/*` routes.
 *
 * Empty by default, so every existing target (web, Electron) keeps making
 * plain relative requests exactly as before. Only builds with no local
 * server to call -- currently the Capacitor/Android SPA build, see
 * project/DECISIONS.md D-9 -- set VITE_API_BASE_URL at build time to the
 * deployed backend's origin.
 */
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
