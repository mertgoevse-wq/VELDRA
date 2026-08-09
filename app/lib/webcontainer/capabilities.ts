import { Capacitor } from '@capacitor/core';

export interface WebContainerSupport {
  supported: boolean;
  reason?: 'native-runtime' | 'cross-origin-isolation' | 'shared-array-buffer';
}

/**
 * WebContainer is a browser capability, not a generic JavaScript runtime.
 * Native Capacitor WebViews and pages without cross-origin isolation must use
 * a different execution provider instead of attempting to boot it.
 */
export function detectWebContainerSupport(): WebContainerSupport {
  if (Capacitor.isNativePlatform()) {
    return { supported: false, reason: 'native-runtime' };
  }

  if (globalThis.crossOriginIsolated !== true) {
    return { supported: false, reason: 'cross-origin-isolation' };
  }

  if (typeof SharedArrayBuffer === 'undefined') {
    return { supported: false, reason: 'shared-array-buffer' };
  }

  return { supported: true };
}
