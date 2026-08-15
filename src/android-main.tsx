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
import { MotionConfig } from 'framer-motion';
import AndroidShell from '~/components/mobile/AndroidShell';

import 'virtual:uno.css';

/*
 * index.scss defines --header-height/--workbench-left/--workbench-inner-width/.z-workbench and
 * the terminal/code/editor/resize-handle component styles that Workbench.client.tsx and its
 * children (EditorPanel, DiffView, CodeMirrorEditor, TerminalTabs) depend on. It also carries
 * mobile.scss's touch-target/drawer/safe-area rules -- written explicitly for "bolt.diy on
 * Android WebView" (see mobile.scss's own header comment, which names the Galaxy A56) but never
 * previously loaded here. Without this, mounting Workbench on Android relies on undefined CSS
 * custom properties and unstyled drawer/terminal overlays. android.css (below) still owns
 * everything Android-shell-specific and loads after, so its rules win where both touch the same
 * selector (see the .android-shell-scoped override for the Workbench bottom-nav clearance).
 */
import '~/styles/index.scss';
import '~/styles/android.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('[Android] Root element #root not found');
}

// Remove inline splash screen once React is ready to paint
const splash = document.getElementById('splash');

if (splash) {
  splash.remove();
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <MemoryRouter initialEntries={['/']} initialIndex={0}>
        <AndroidShell />
      </MemoryRouter>
    </MotionConfig>
  </React.StrictMode>,
);
