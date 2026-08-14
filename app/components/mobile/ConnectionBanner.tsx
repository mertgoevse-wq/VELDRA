import { useState, useEffect } from 'react';
import { getAndroidApiBackendConfig } from '~/lib/android-api/backend-config';

type ConnectionState = 'unconfigured' | 'checking' | 'connected' | 'error';

export function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>('checking');

  useEffect(() => {
    const config = getAndroidApiBackendConfig();

    if (!config) {
      setState('unconfigured');
      return;
    }

    fetch(`${config.url}/api/android/health`, {
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => setState(res.ok ? 'connected' : 'error'))
      .catch(() => setState('error'));
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
