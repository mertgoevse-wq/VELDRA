/**
 * Android SPA Entry Point
 *
 * This is the React root for the Android build. It mounts the main app
 * without Remix routing — we use React Router v6 directly with BrowserRouter
 * (or MemoryRouter for WebView where history may be restricted).
 *
 * The full VELDRA UI is preserved; only the server-side routing layer is
 * replaced with a client-side equivalent. All stores, adapters, and components
 * work identically.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AndroidShell from '~/components/mobile/AndroidShell';

import 'virtual:uno.css';
import '~/styles/android.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('[Android] Root element #root not found');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <MemoryRouter initialEntries={['/']} initialIndex={0}>
      <AndroidShell />
    </MemoryRouter>
  </React.StrictMode>,
);
