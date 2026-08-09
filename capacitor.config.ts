import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the VELDRA Android workbench.
 *
 * The web build output (Remix Vite → build/client/) is served inside
 * a native Android WebView. This is the "shell" phase — the existing
 * web app runs unchanged inside the WebView, and we progressively
 * replace unsupported desktop-only features (WebContainer, terminal,
 * preview) with Android-compatible adapters.
 *
 * Build flow:
 *   1. pnpm build          → Remix Vite builds to build/client/
 *   2. pnpm android:sync   → copies build/client/ into VELDRA Android
 *   3. pnpm android:open   → opens Android Studio
 *   4. pnpm android:build  → builds the APK via Gradle
 */
const config: CapacitorConfig = {
  appId: 'com.veldra.app',
  appName: 'VELDRA',
  webDir: 'build/client',
  // Don't mix server build into the Android assets
  server: {
    androidScheme: 'https',
    // During development you can point this at your dev server:
    //   url: 'http://192.168.1.100:5173',
    // Leave commented out for production builds (uses bundled assets).
    cleartext: true, // allow http for dev server
  },
  android: {
    // Allow mixed content so the WebView can load local assets
    // alongside any http resources during development
    allowMixedContent: true,
    // Enable WebView debugging on debug builds
    webContentsDebuggingEnabled: true,
  },
  // Preserve the Capacitor bridge in all contexts
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#0c0c0c',
      showSpinner: false,
    },
  },
};

export default config;
