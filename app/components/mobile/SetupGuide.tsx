/**
 * SetupGuide
 *
 * First-run onboarding card shown on the Android welcome screen when no
 * backend URL is configured. Guides users to Settings to connect VELDRA
 * to a running backend instance.
 */

import { useState, useEffect } from 'react';
import { getAndroidApiBackendConfig } from '~/lib/android-api/backend-config';

export function SetupGuide() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const config = getAndroidApiBackendConfig();
    setShow(!config);
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="setup-guide-card">
      <div className="setup-guide-header">
        <span className="i-ph:rocket-launch setup-guide-icon" />
        <span className="setup-guide-title">Connect VELDRA</span>
      </div>
      <p className="setup-guide-body">
        To generate code and run AI, connect VELDRA to a backend instance that holds your API keys securely.
      </p>
      <ol className="setup-guide-steps">
        <li>Run the VELDRA backend on your computer</li>
        <li>Enter its URL in Settings</li>
        <li>Start building</li>
      </ol>
      <button
        className="setup-guide-btn"
        onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-tab', { detail: 'settings' }))}
      >
        <span className="i-ph:gear" />
        Open Settings
      </button>
    </div>
  );
}
