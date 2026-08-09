import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';
import { isWebContainerSupported, isCapacitor, getPlatformInfo } from '~/lib/adapters/platform';
import { registerWebContainerProvider } from '~/lib/execution/webcontainer';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

/**
 * On Android (Capacitor WebView) or browsers without SharedArrayBuffer,
 * WebContainer is NOT available. We export a rejected promise so that
 * dependent stores catch the error and fall back gracefully.
 *
 * The AndroidAdapter in app/lib/adapters/ provides the actual fallback
 * implementation for file system, terminal, and preview functionality.
 */
export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  const wcSupported = isWebContainerSupported();
  const isAndroid = isCapacitor() || getPlatformInfo().isAndroid;

  if (wcSupported && !isAndroid) {
    // Full WebContainer support — desktop browser or Electron
    webcontainer =
      import.meta.hot?.data.webcontainer ??
      Promise.resolve()
        .then(() => {
          return WebContainer.boot({
            coep: 'credentialless',
            workdirName: WORK_DIR_NAME,
            forwardPreviewErrors: true, // Enable error forwarding from iframes
          });
        })
        .then(async (webcontainer) => {
          webcontainerContext.loaded = true;

          const { workbenchStore } = await import('~/lib/stores/workbench');

          const response = await fetch('/inspector-script.js');
          const inspectorScript = await response.text();
          await webcontainer.setPreviewScript(inspectorScript);

          // Listen for preview errors
          webcontainer.on('preview-message', (message) => {
            console.log('WebContainer preview message:', message);

            // Handle both uncaught exceptions and unhandled promise rejections
            if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
              const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
              const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
              workbenchStore.actionAlert.set({
                type: 'preview',
                title,
                description: 'message' in message ? message.message : 'Unknown error',
                content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
                source: 'preview',
              });
            }
          });

          return webcontainer;
        });

    if (import.meta.hot) {
      import.meta.hot.data.webcontainer = webcontainer;
    }

    // Keep the original promise for existing consumers while marking boot failures handled.
    void webcontainer.catch(() => undefined);

    // Expose the already-booted runtime through the provider-neutral execution registry.
    registerWebContainerProvider(webcontainer);
  } else {
    /*
     * Android / fallback mode — no WebContainer
     * Export a rejected promise that stores can catch
     */
    console.log(
      `[WebContainer] Not available on this platform (${isAndroid ? 'Android/Capacitor' : 'no SharedArrayBuffer'}). ` +
        'Using fallback adapter. Chat and code generation still work.',
    );

    webcontainer = Promise.reject(new Error('WebContainer is not available on this platform. Using fallback mode.'));

    // Mark context as "loaded" so stores don't hang waiting
    webcontainerContext.loaded = true;

    // Suppress unhandled rejection warnings
    webcontainer.catch(() => {
      // already handled by stores
    });
  }
}

/**
 * Check if WebContainer is available in the current environment.
 */
export function isWebContainerAvailable(): boolean {
  return !import.meta.env.SSR && isWebContainerSupported() && !isCapacitor() && !getPlatformInfo().isAndroid;
}
