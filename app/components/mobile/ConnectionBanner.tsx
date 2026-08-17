import { useState, useEffect } from 'react';
import { getAndroidApiBackendConfig } from '~/lib/android-api/backend-config';

type ConnectionState = 'unconfigured' | 'checking' | 'connected' | 'error';

/*
 * AndroidSettingsPanel writes the backend config straight to localStorage with no change event
 * or store, so a one-shot mount check would leave this banner showing a stale
 * unconfigured/unreachable status forever, even after the user fixes it in Settings. Re-check
 * periodically and whenever the app regains focus so the banner can recover on its own.
 */
const RECHECK_INTERVAL_MS = 30_000;

export function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>('checking');

  useEffect(() => {
    let cancelled = false;

    function checkConnection() {
      const config = getAndroidApiBackendConfig();

      if (!config) {
        if (!cancelled) {
          setState('unconfigured');
        }

        return;
      }

      fetch(`${config.url}/api/android/health`, {
        headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
        signal: AbortSignal.timeout(5000),
      })
        .then((res) => {
          if (!cancelled) {
            setState(res.ok ? 'connected' : 'error');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState('error');
          }
        });
    }

    checkConnection();

    const interval = window.setInterval(checkConnection, RECHECK_INTERVAL_MS);
    window.addEventListener('focus', checkConnection);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkConnection);
    };
  }, []);

  if (state === 'connected' || state === 'checking') {
    return null;
  }

  return (
    <div className="android-connection-banner" role="status">
      <div className={state === 'unconfigured' ? 'i-ph:plug' : 'i-ph:wifi-slash'} />
      <span>
        {state === 'unconfigured' ? 'No backend configured' : 'Backend unreachable'}
        {' — '}
        <button className="android-connection-banner-link" onClick={() => dispatchOpenSettings()}>
          Settings
        </button>
      </span>
    </div>
  );
}

function dispatchOpenSettings() {
  window.dispatchEvent(new CustomEvent<string>('open-mobile-tab', { detail: 'settings' }));
}
