/**
 * Android WebView Entry Point
 *
 * This is the main entry point for VELDRA when running inside the Android WebView via Capacitor.
 * It's served from build/client/index.html after the Remix web build completes.
 *
 * This route ensures that the app mounts correctly and displays the proper UI components
 * for the Android runtime environment.
 */

import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import App from './_index';

export default function AndroidEntry() {
  const runtime = useStore(runtimeModeStore);

  useEffect(() => {
    // Log Android platform detection for debugging
    if (runtime.isAndroid) {
      console.log('[Android] Platform detected:', {
        isAndroid: runtime.isAndroid,
        mode: runtime.mode,
        webContainerAvailable: runtime.webContainerAvailable,
      });
    }
  }, [runtime]);

  // On Android, render the same app but with fallback UI context
  return <App />;
}
