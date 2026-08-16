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

/*
 * `npx cap sync` writes a single capacitor.config.json consumed at app runtime by the
 * Capacitor Bridge -- it has no notion of debug vs release build type on its own (unlike
 * AndroidManifest.xml / network_security_config.xml, which get a real per-variant override
 * via the android/app/src/debug source set). scripts/build-apk.mjs sets this env var before
 * invoking `npm run android:sync`, true only for `--release` omitted (i.e. debug/dev
 * builds); it is unset for `--release` and for any direct/manual `npx cap sync` call, so the
 * safe values are what ships unless a debug build explicitly opted in.
 */
const isDebugBuild = process.env.VELDRA_ANDROID_DEBUG_BUILD === 'true';

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
    cleartext: isDebugBuild, // allow http for dev server -- debug builds only, see isDebugBuild above
  },
  android: {
    // Allow mixed content so the WebView can load local assets alongside any http
    // resources -- debug builds only; a release build must not silently downgrade TLS.
    allowMixedContent: isDebugBuild,
    // Enable remote Chrome DevTools inspection of the WebView -- debug builds only. Left on
    // for a release build, this exposes the full JS/storage/network context to anyone with
    // adb/USB access to an installed device.
    webContentsDebuggingEnabled: isDebugBuild,
  },
  // Preserve the Capacitor bridge in all contexts
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#0B3146',
      showSpinner: false,
    },
  },
};

export default config;
