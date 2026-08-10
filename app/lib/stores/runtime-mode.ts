/**
 * Runtime Mode Store
 *
 * Tracks the current runtime mode (WebContainer, Android Fallback, or
 * Remote Runtime) and persists the user's preference + remote URL.
 *
 * On Android/Capacitor, the mode is forced to 'android-fallback' and
 * cannot be overridden to 'webcontainer' (since WebContainer is not
 * available). The user can optionally configure a Remote Runtime URL
 * to enable command execution / dev server / preview via a remote
 * sandbox (not yet implemented — the input is saved for future use).
 */

import { atom } from 'nanostores';
import { isWebContainerSupported, isCapacitor, getPlatformInfo } from '~/lib/adapters/platform';

/*
 * ---------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------
 */

export type RuntimeMode = 'webcontainer' | 'android-fallback' | 'remote';

export interface RuntimeModeState {
  /** Currently active runtime mode */
  mode: RuntimeMode;

  /** Whether WebContainer is available on this platform */
  webContainerAvailable: boolean;

  /** Whether the app is running inside a Capacitor Android WebView */
  isAndroid: boolean;

  /** Remote runtime URL (saved by user, used when mode = 'remote') */
  remoteRuntimeUrl: string;

  /** Remote runtime authorization token */
  remoteAuthToken: string;

  /** Remote runtime workspace ID */
  remoteWorkspaceId: string;

  /** Capabilities of the active mode */
  capabilities: {
    fileSystem: boolean;
    terminal: boolean;
    commandExecution: boolean;
    packageInstall: boolean;
    devServer: boolean;
    preview: boolean;
    persistentFileSystem: boolean;
  };

  /** Whether the runtime mode was set automatically (platform-detected) */
  autoDetected: boolean;
}

/*
 * ---------------------------------------------------------------------------
 * Detection logic
 * ---------------------------------------------------------------------------
 */

function detectPlatform(): {
  isAndroid: boolean;
  webContainerAvailable: boolean;
  defaultMode: RuntimeMode;
} {
  if (typeof window === 'undefined') {
    return { isAndroid: false, webContainerAvailable: false, defaultMode: 'android-fallback' };
  }

  const isAndroid = isCapacitor() || getPlatformInfo().isAndroid;
  const webContainerAvailable = isWebContainerSupported() && !isAndroid;

  let defaultMode: RuntimeMode = 'webcontainer';

  if (isAndroid) {
    defaultMode = 'android-fallback';
  } else if (!webContainerAvailable) {
    defaultMode = 'android-fallback';
  }

  return { isAndroid, webContainerAvailable, defaultMode };
}

function getCapabilitiesForMode(mode: RuntimeMode, webContainerAvailable: boolean): RuntimeModeState['capabilities'] {
  if (mode === 'webcontainer' && webContainerAvailable) {
    return {
      fileSystem: true,
      terminal: true,
      commandExecution: true,
      packageInstall: true,
      devServer: true,
      preview: true,
      persistentFileSystem: true,
    };
  }

  if (mode === 'remote') {
    /*
     * File sync, the manual RemoteCommandPanel (safe predefined command profiles), and preview
     * status genuinely work end-to-end against a configured Remote Runtime server today. Agent-
     * issued shell/build/start actions do not: ActionRunner has no code path that routes them to
     * RemoteRuntimeClient -- ActionRunner only knows how to talk to the WebContainer-backed
     * BoltShell terminal, which doesn't exist on Android. commandExecution must stay false until
     * that session bridge exists, or ActionRunner's capability gate (action-runner.ts) lets
     * agent-issued commands fall through to a terminal that was never there, failing without even
     * the graceful onAlert path the gate itself provides for genuinely unsupported runtimes.
     */
    return {
      fileSystem: true,
      terminal: true,
      commandExecution: false,
      packageInstall: true,
      devServer: true,
      preview: true,
      persistentFileSystem: false, // local files are in-memory
    };
  }

  // android-fallback
  return {
    fileSystem: true, // in-memory
    terminal: false,
    commandExecution: false,
    packageInstall: false,
    devServer: false,
    preview: false,
    persistentFileSystem: false,
  };
}

/*
 * ---------------------------------------------------------------------------
 * Store
 * ---------------------------------------------------------------------------
 */

const STORAGE_KEY_REMOTE_URL = 'bolt_remote_runtime_url';
const STORAGE_KEY_REMOTE_TOKEN = 'bolt_remote_runtime_auth_token';
const STORAGE_KEY_REMOTE_WORKSPACE = 'bolt_remote_runtime_workspace_id';
const STORAGE_KEY_MODE_OVERRIDE = 'bolt_runtime_mode_override';

function loadSavedRemoteUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_REMOTE_URL) || '';
  } catch {
    return '';
  }
}

function loadSavedRemoteToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_REMOTE_TOKEN) || '';
  } catch {
    return '';
  }
}

function loadSavedRemoteWorkspace(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_REMOTE_WORKSPACE) || '';
  } catch {
    return '';
  }
}

function loadModeOverride(): RuntimeMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODE_OVERRIDE);

    if (saved === 'webcontainer' || saved === 'android-fallback' || saved === 'remote') {
      return saved;
    }
  } catch {
    // ignore
  }
  return null;
}

function resolveMode(
  detected: { isAndroid: boolean; webContainerAvailable: boolean; defaultMode: RuntimeMode },
  override: RuntimeMode | null,
): RuntimeMode {
  if (!override) {
    return detected.defaultMode;
  }

  // On Android, user cannot force WebContainer mode
  if (detected.isAndroid && override === 'webcontainer') {
    return 'android-fallback';
  }

  // On desktop without WebContainer, user cannot force WebContainer mode
  if (!detected.webContainerAvailable && override === 'webcontainer') {
    return 'android-fallback';
  }

  return override;
}

function createInitialState(): RuntimeModeState {
  const detected = detectPlatform();
  const override = loadModeOverride();
  const mode = resolveMode(detected, override);

  return {
    mode,
    webContainerAvailable: detected.webContainerAvailable,
    isAndroid: detected.isAndroid,
    remoteRuntimeUrl: loadSavedRemoteUrl(),
    remoteAuthToken: loadSavedRemoteToken(),
    remoteWorkspaceId: loadSavedRemoteWorkspace(),
    capabilities: getCapabilitiesForMode(mode, detected.webContainerAvailable),
    autoDetected: override === null,
  };
}

export const runtimeModeStore = atom<RuntimeModeState>(createInitialState());

/*
 * ---------------------------------------------------------------------------
 * Actions
 * ---------------------------------------------------------------------------
 */

/**
 * Set the runtime mode. On Android, 'webcontainer' is rejected.
 * The choice is persisted to localStorage.
 */
export function setRuntimeMode(mode: RuntimeMode): void {
  const current = runtimeModeStore.get();

  // Prevent switching to webcontainer on unsupported platforms
  if (mode === 'webcontainer' && !current.webContainerAvailable) {
    console.warn('[RuntimeMode] Cannot switch to WebContainer mode on this platform');
    return;
  }

  // Persist override
  try {
    localStorage.setItem(STORAGE_KEY_MODE_OVERRIDE, mode);
  } catch {
    // ignore
  }

  runtimeModeStore.set({
    ...current,
    mode,
    capabilities: getCapabilitiesForMode(mode, current.webContainerAvailable),
    autoDetected: false,
  });
}

/**
 * Set the remote runtime URL. Persisted to localStorage.
 */
export function setRemoteRuntimeUrl(url: string): void {
  const current = runtimeModeStore.get();

  try {
    localStorage.setItem(STORAGE_KEY_REMOTE_URL, url);
  } catch {
    // ignore
  }

  runtimeModeStore.set({
    ...current,
    remoteRuntimeUrl: url,
  });
}

/**
 * Set the remote runtime authentication token. Persisted to localStorage.
 */
export function setRemoteAuthToken(token: string): void {
  const current = runtimeModeStore.get();

  try {
    localStorage.setItem(STORAGE_KEY_REMOTE_TOKEN, token);
  } catch {
    // ignore
  }

  runtimeModeStore.set({
    ...current,
    remoteAuthToken: token,
  });
}

/**
 * Set the remote runtime workspace ID. Persisted to localStorage.
 */
export function setRemoteWorkspaceId(workspaceId: string): void {
  const current = runtimeModeStore.get();

  try {
    localStorage.setItem(STORAGE_KEY_REMOTE_WORKSPACE, workspaceId);
  } catch {
    // ignore
  }

  runtimeModeStore.set({
    ...current,
    remoteWorkspaceId: workspaceId,
  });
}

/**
 * Reset to auto-detected mode (clears user override).
 */
export function resetRuntimeMode(): void {
  const detected = detectPlatform();

  try {
    localStorage.removeItem(STORAGE_KEY_MODE_OVERRIDE);
  } catch {
    // ignore
  }

  runtimeModeStore.set({
    ...runtimeModeStore.get(),
    mode: detected.defaultMode,
    capabilities: getCapabilitiesForMode(detected.defaultMode, detected.webContainerAvailable),
    autoDetected: true,
  });
}

/**
 * Whether the app is in a degraded/fallback mode (not full WebContainer).
 */
export function isRuntimeDegraded(): boolean {
  const state = runtimeModeStore.get();
  return state.mode !== 'webcontainer' || !state.webContainerAvailable;
}
