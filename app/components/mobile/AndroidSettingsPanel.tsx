/**
 * AndroidSettingsPanel
 *
 * A simplified settings panel for the Android build.
 * Shows the most important settings for Android users:
 *   - Runtime mode status
 *   - API key configuration
 *   - Persistence status / reset
 *   - App info
 *
 * Full settings (Remix ControlPanel) require router context and
 * are not available in the SPA build without significant refactoring.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import {
  runtimeModeStore,
  resetRuntimeMode,
  setRuntimeMode,
  setRemoteRuntimeUrl,
  setRemoteAuthToken,
  setRemoteWorkspaceId,
  type RuntimeMode,
} from '~/lib/stores/runtime-mode';
import { getAndroidFallbackPersistenceStatus } from '~/lib/persistence/androidFallbackStorage';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { AndroidApiClient } from '~/lib/android-api/AndroidApiClient';
import { ANDROID_API_BACKEND_TOKEN_KEY, ANDROID_API_BACKEND_URL_KEY } from '~/lib/android-api/backend-config';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import {
  getMissingRemoteRuntimeConfig,
  getSyncStatus,
  pullRemoteWorkspaceToLocal,
  pushLocalWorkspaceToRemote,
  syncSingleFileToRemote,
  type RemoteWorkspaceSyncStatus,
} from '~/lib/remote-runtime/RemoteWorkspaceSync';

interface PersistenceStatus {
  available: boolean;
  hasSavedFiles: boolean;
  lastOpenedFile?: string;
}

function loadLocalSetting(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export default function AndroidSettingsPanel() {
  const runtime = useStore(runtimeModeStore);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>({
    available: false,
    hasSavedFiles: false,
  });
  const [resetting, setResetting] = useState(false);
  const [urlInput, setUrlInput] = useState(runtime.remoteRuntimeUrl);
  const [tokenInput, setTokenInput] = useState(runtime.remoteAuthToken);
  const [workspaceInput, setWorkspaceInput] = useState(runtime.remoteWorkspaceId);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'checking' | 'connected' | 'failed'>(
    'disconnected',
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [syncingAction, setSyncingAction] = useState<'push' | 'pull' | 'current-file' | null>(null);
  const [syncStatus, setSyncStatus] = useState<RemoteWorkspaceSyncStatus>(() => getSyncStatus());
  const [apiBackendUrlInput, setApiBackendUrlInput] = useState(() => loadLocalSetting(ANDROID_API_BACKEND_URL_KEY));
  const [apiBackendTokenInput, setApiBackendTokenInput] = useState(() =>
    loadLocalSetting(ANDROID_API_BACKEND_TOKEN_KEY),
  );
  const [apiBackendState, setApiBackendState] = useState<'not-configured' | 'checking' | 'connected' | 'failed'>(
    apiBackendUrlInput.trim() ? 'not-configured' : 'not-configured',
  );
  const [apiBackendError, setApiBackendError] = useState<string | null>(null);
  const [testingApiBackend, setTestingApiBackend] = useState(false);

  useEffect(() => {
    setUrlInput(runtime.remoteRuntimeUrl);
    setConnectionState('disconnected');
    setLastError(null);
  }, [runtime.remoteRuntimeUrl]);

  useEffect(() => {
    setTokenInput(runtime.remoteAuthToken);
  }, [runtime.remoteAuthToken]);

  useEffect(() => {
    setWorkspaceInput(runtime.remoteWorkspaceId);
  }, [runtime.remoteWorkspaceId]);

  const handleUrlSave = useCallback(() => {
    const trimmed = urlInput.trim();

    if (
      trimmed &&
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('ws://') &&
      !trimmed.startsWith('wss://')
    ) {
      toast.error('URL must start with http://, https://, ws://, or wss://');
      return;
    }

    setRemoteRuntimeUrl(trimmed);
    toast.success(trimmed ? 'Remote runtime URL saved' : 'Remote runtime URL cleared');
  }, [urlInput]);

  const handleTokenSave = useCallback(() => {
    setRemoteAuthToken(tokenInput.trim());
    toast.success('Auth token saved');
  }, [tokenInput]);

  const handleWorkspaceSave = useCallback(() => {
    setRemoteWorkspaceId(workspaceInput.trim());
    toast.success('Workspace ID saved');
  }, [workspaceInput]);

  const handleApiBackendSave = useCallback(() => {
    const trimmedUrl = apiBackendUrlInput.trim();
    const trimmedToken = apiBackendTokenInput.trim();

    if (trimmedUrl && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      toast.error('Android API Backend URL must start with http:// or https://');
      return;
    }

    try {
      localStorage.setItem(ANDROID_API_BACKEND_URL_KEY, trimmedUrl);
      localStorage.setItem(ANDROID_API_BACKEND_TOKEN_KEY, trimmedToken);
      toast.success(trimmedUrl ? 'Android API Backend settings saved' : 'Android API Backend URL cleared');
      setApiBackendState(trimmedUrl ? 'not-configured' : 'not-configured');
      setApiBackendError(null);
    } catch {
      toast.error('Failed to save Android API Backend settings');
    }
  }, [apiBackendTokenInput, apiBackendUrlInput]);

  const handleTestApiBackend = useCallback(async () => {
    const trimmedUrl = apiBackendUrlInput.trim();

    if (!trimmedUrl) {
      toast.error('Android API Backend URL is required to test the backend');
      return;
    }

    setTestingApiBackend(true);
    setApiBackendState('checking');
    setApiBackendError(null);

    try {
      const client = new AndroidApiClient({
        baseUrl: trimmedUrl,
        token: apiBackendTokenInput.trim(),
      });
      const response = await client.health();

      if (!response.ok) {
        throw new Error(response.message || 'Backend responded with an invalid health payload.');
      }

      setApiBackendState('connected');
      toast.success(`Android API Backend connected${response.service ? `: ${response.service}` : ''}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Android API Backend test failed';
      setApiBackendState('failed');
      setApiBackendError(message);
      toast.error(message);
    } finally {
      setTestingApiBackend(false);
    }
  }, [apiBackendTokenInput, apiBackendUrlInput]);

  const handleTestConnection = useCallback(async () => {
    const trimmedUrl = urlInput.trim();

    if (!trimmedUrl) {
      toast.error('Remote Runtime URL is required to test connection');
      return;
    }

    setTestingConnection(true);
    setConnectionState('checking');
    setLastError(null);

    try {
      const client = new RemoteRuntimeClient(trimmedUrl, tokenInput.trim(), workspaceInput.trim());
      const healthResponse = await client.health();

      if (healthResponse && healthResponse.ok) {
        setConnectionState('connected');
        toast.success(`Connected successfully! Server: ${healthResponse.service}, Version: ${healthResponse.version}`);
      } else {
        setConnectionState('failed');
        setLastError('Server responded with invalid payload');
        toast.error('Connection failed: Server responded with invalid payload');
      }
    } catch (err: any) {
      console.error('[RemoteRuntime] Test connection failed', err);

      const errMsg = err.message || 'Unknown error';
      setConnectionState('failed');
      setLastError(errMsg);
      toast.error(`Connection failed: ${errMsg}`);
    } finally {
      setTestingConnection(false);
    }
  }, [urlInput, tokenInput, workspaceInput]);

  const handleCreateWorkspace = useCallback(async () => {
    const trimmedUrl = urlInput.trim();

    if (!trimmedUrl) {
      toast.error('Remote Runtime URL is required to create a workspace');
      return;
    }

    setCreatingWorkspace(true);
    setLastError(null);

    try {
      const client = new RemoteRuntimeClient(trimmedUrl, tokenInput.trim());
      const workspaceResponse = await client.createWorkspace('node-clean');

      if (workspaceResponse && workspaceResponse.workspaceId) {
        setRemoteWorkspaceId(workspaceResponse.workspaceId);
        setWorkspaceInput(workspaceResponse.workspaceId);
        toast.success(`Workspace created successfully! ID: ${workspaceResponse.workspaceId}`);
      } else {
        throw new Error('Server did not return a workspace ID.');
      }
    } catch (err: any) {
      console.error('[RemoteRuntime] Workspace creation failed', err);

      const errMsg = err.message || 'Unknown error';
      setLastError(errMsg);
      toast.error(`Workspace creation failed: ${errMsg}`);
    } finally {
      setCreatingWorkspace(false);
    }
  }, [urlInput, tokenInput]);

  const runSyncAction = useCallback(async (action: 'push' | 'pull' | 'current-file') => {
    setSyncingAction(action);

    try {
      const nextStatus =
        action === 'push'
          ? await pushLocalWorkspaceToRemote()
          : action === 'pull'
            ? await pullRemoteWorkspaceToLocal()
            : await syncSingleFileToRemote();

      setSyncStatus(nextStatus);

      if (nextStatus.state === 'error') {
        toast.error(nextStatus.lastError ?? 'Remote Runtime sync failed');
      } else if (nextStatus.conflictCount > 0) {
        toast.warning(
          `Remote Runtime sync completed with ${nextStatus.conflictCount} conflict(s). Local files were kept.`,
        );
      } else {
        toast.success('Remote Runtime sync completed');
      }

      const status = await getAndroidFallbackPersistenceStatus();
      setPersistenceStatus(status);
    } finally {
      setSyncingAction(null);
    }
  }, []);

  const handleModeChange = useCallback(
    (mode: RuntimeMode) => {
      if (mode === 'remote' && !urlInput.trim()) {
        toast.info('Enter a remote runtime URL below to use Remote Runtime mode');
      }

      setRuntimeMode(mode);
      toast.success(`Runtime mode set to: ${mode === 'remote' ? 'Remote Runtime' : 'Android Fallback'}`);
    },
    [urlInput],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      const status = await getAndroidFallbackPersistenceStatus();

      if (active) {
        setPersistenceStatus(status);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const handleResetWorkspace = useCallback(async () => {
    if (!window.confirm('Reset your local Android workspace? This will delete all locally saved files.')) {
      return;
    }

    setResetting(true);

    try {
      await workbenchStore.resetLocalAndroidWorkspace();

      const status = await getAndroidFallbackPersistenceStatus();
      setPersistenceStatus(status);
      toast.success('Local workspace reset successfully');
    } catch (error) {
      console.error('[Settings] Reset failed', error);
      toast.error('Failed to reset workspace');
    } finally {
      setResetting(false);
    }
  }, []);

  const modeLabel =
    runtime.mode === 'android-fallback'
      ? 'Android Fallback Mode'
      : runtime.mode === 'webcontainer'
        ? 'WebContainer Mode'
        : 'Remote Runtime Mode';

  const modeColor = runtime.mode === 'android-fallback' ? '#f59e0b' : '#10b981';
  const missingRemoteConfig = getMissingRemoteRuntimeConfig();
  const canUseRemoteSync = runtime.mode === 'remote' && missingRemoteConfig.length === 0;

  return (
    <div className="android-settings-panel">
      <header className="android-settings-header">
        <div className="i-ph:gear-six-fill android-settings-icon" />
        <h1 className="android-settings-title">Settings</h1>
      </header>

      <div className="android-settings-body">
        {/* Runtime Mode Card */}
        <section className="android-card">
          <h2 className="android-card-title">
            <div className="i-ph:cpu-fill" />
            Runtime Mode
          </h2>
          <div className="android-card-content gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange('android-fallback')}
                className={classNames('flex-1 py-2 rounded-lg text-xs font-semibold border transition-all', {
                  'bg-accent-600/15 border-accent-500/50 text-accent-400': runtime.mode === 'android-fallback',
                  'bg-transparent border-bolt-elements-borderColor text-bolt-elements-textSecondary':
                    runtime.mode !== 'android-fallback',
                })}
              >
                Android Fallback
              </button>
              <button
                onClick={() => handleModeChange('remote')}
                className={classNames('flex-1 py-2 rounded-lg text-xs font-semibold border transition-all', {
                  'bg-accent-600/15 border-accent-500/50 text-accent-400': runtime.mode === 'remote',
                  'bg-transparent border-bolt-elements-borderColor text-bolt-elements-textSecondary':
                    runtime.mode !== 'remote',
                })}
              >
                Remote Runtime
              </button>
            </div>

            <div
              className="android-mode-badge"
              style={{ backgroundColor: modeColor + '20', color: modeColor, borderColor: modeColor + '40' }}
            >
              <span className="android-mode-dot" style={{ backgroundColor: modeColor }} />
              {modeLabel}
            </div>

            <div className="android-capability-list">
              {[
                { label: 'File System (in-memory)', enabled: runtime.capabilities.fileSystem },
                { label: 'Persistent Storage (IndexedDB)', enabled: persistenceStatus.available },
                { label: 'Terminal', enabled: runtime.capabilities.terminal },
                { label: 'Dev Server / Preview', enabled: runtime.capabilities.devServer },
                { label: 'WebContainer', enabled: runtime.webContainerAvailable },
              ].map(({ label, enabled }) => (
                <div key={label} className="android-capability-row">
                  <div
                    className={
                      enabled
                        ? 'i-ph:check-circle-fill android-cap-icon android-cap-enabled'
                        : 'i-ph:x-circle-fill android-cap-icon android-cap-disabled'
                    }
                  />
                  <span className={enabled ? 'android-cap-label-enabled' : 'android-cap-label-disabled'}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Android API Backend Card */}
        <section className="android-card">
          <h2 className="android-card-title">
            <div className="i-ph:cloud-check-fill" />
            Android API Backend
          </h2>
          <div className="android-card-content gap-3.5">
            <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">
              LLM chat on Android needs an authenticated backend because Remix API routes do not run inside the WebView.
              Provider keys stay on that backend and must never be bundled into the Android app.
            </p>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-bolt-elements-textTertiary font-semibold uppercase tracking-wider">
                Android API Backend URL
              </span>
              <input
                type="text"
                value={apiBackendUrlInput}
                onChange={(event) => {
                  setApiBackendUrlInput(event.target.value);
                  setApiBackendState('not-configured');
                }}
                placeholder="https://api.example.com/android"
                className="px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0A] border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-accent-500 placeholder:text-bolt-elements-textTertiary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-bolt-elements-textTertiary font-semibold uppercase tracking-wider">
                Backend Auth Token
              </span>
              <input
                type="password"
                value={apiBackendTokenInput}
                onChange={(event) => setApiBackendTokenInput(event.target.value)}
                placeholder="Backend token, not provider API key"
                className="px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0A] border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-accent-500 placeholder:text-bolt-elements-textTertiary"
              />
            </div>

            {!apiBackendUrlInput.trim() && (
              <div className="text-[10px] text-amber-400 bg-amber-950/20 border border-amber-900/50 rounded-lg p-2">
                Android LLM chat is not configured yet. Add a backend URL after deploying a secure API bridge.
              </div>
            )}

            {apiBackendError && (
              <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg p-2 break-all">
                <strong>Error:</strong> {apiBackendError}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span
                className={classNames('font-semibold uppercase text-[10px] px-2.5 py-0.5 rounded-full border', {
                  'bg-gray-500/10 border-gray-500/30 text-gray-400': apiBackendState === 'not-configured',
                  'bg-accent-500/10 border-accent-500/30 text-accent-400': apiBackendState === 'checking',
                  'bg-green-500/10 border-green-500/30 text-green-400': apiBackendState === 'connected',
                  'bg-red-500/10 border-red-500/30 text-red-400': apiBackendState === 'failed',
                })}
              >
                {apiBackendState}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleApiBackendSave}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleTestApiBackend}
                  disabled={testingApiBackend || !apiBackendUrlInput.trim()}
                  className="android-secondary-btn text-xs font-semibold px-3.5 py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className={testingApiBackend ? 'i-ph:spinner-gap animate-spin' : 'i-ph:plugs-fill'} />
                  <span>Test API Backend</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Remote Runtime Card */}
        <section className={classNames('android-card', { 'opacity-60': runtime.mode !== 'remote' })}>
          <h2 className="android-card-title">
            <div className="i-ph:link-fill" />
            Remote Runtime Settings
          </h2>
          <div className="android-card-content gap-3.5">
            <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">
              Remote Runtime can mirror local Android files to a trusted computer/server and run safe predefined command
              profiles. On a phone, localhost points to the phone; use your laptop LAN IP, for example
              http://192.168.x.x:8787. For live preview, run project dev servers with --host 0.0.0.0 or equivalent.
            </p>

            {/* URL Input */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-bolt-elements-textTertiary font-semibold uppercase tracking-wider">
                Server URL
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://runtime.example.com"
                  disabled={runtime.mode !== 'remote'}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0A] border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-accent-500 placeholder:text-bolt-elements-textTertiary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleUrlSave}
                  disabled={runtime.mode !== 'remote'}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
              {runtime.remoteRuntimeUrl && (
                <div className="text-[10px] text-green-500 flex items-center gap-0.5 mt-0.5">
                  <div className="i-ph:check-circle-fill w-3 h-3" />
                  <span>Saved: {runtime.remoteRuntimeUrl}</span>
                </div>
              )}
            </div>

            {/* Auth Token Input */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-bolt-elements-textTertiary font-semibold uppercase tracking-wider">
                Auth Token
              </span>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Bearer Auth Token"
                  disabled={runtime.mode !== 'remote'}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0A] border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-accent-500 placeholder:text-bolt-elements-textTertiary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleTokenSave}
                  disabled={runtime.mode !== 'remote'}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
              {runtime.remoteAuthToken && (
                <div className="text-[10px] text-green-500 flex items-center gap-0.5 mt-0.5">
                  <div className="i-ph:check-circle-fill w-3 h-3" />
                  <span>Token saved (length: {runtime.remoteAuthToken.length})</span>
                </div>
              )}
            </div>

            {/* Workspace ID Input */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-bolt-elements-textTertiary font-semibold uppercase tracking-wider">
                Workspace ID
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workspaceInput}
                  onChange={(e) => setWorkspaceInput(e.target.value)}
                  placeholder="ws_xyz123"
                  disabled={runtime.mode !== 'remote'}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0A] border border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-accent-500 placeholder:text-bolt-elements-textTertiary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleWorkspaceSave}
                  disabled={runtime.mode !== 'remote'}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
              {runtime.remoteWorkspaceId && (
                <div className="text-[10px] text-green-500 flex items-center gap-0.5 mt-0.5">
                  <div className="i-ph:check-circle-fill w-3 h-3" />
                  <span>Saved ID: {runtime.remoteWorkspaceId}</span>
                </div>
              )}
            </div>

            {/* Connection Status & Errors */}
            <div className="flex flex-col gap-1.5 mt-1 border-t border-bolt-elements-borderColor pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-bolt-elements-textSecondary">Connection Status:</span>
                <span
                  className={classNames('font-semibold uppercase text-[10px] px-2.5 py-0.5 rounded-full border', {
                    'bg-gray-500/10 border-gray-500/30 text-gray-400': connectionState === 'disconnected',
                    'bg-accent-500/10 border-accent-500/30 text-accent-400': connectionState === 'checking',
                    'bg-green-500/10 border-green-500/30 text-green-400': connectionState === 'connected',
                    'bg-red-500/10 border-red-500/30 text-red-400': connectionState === 'failed',
                  })}
                >
                  {connectionState}
                </span>
              </div>
              {lastError && (
                <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg p-2 mt-1 break-all">
                  <strong>Error:</strong> {lastError}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleTestConnection}
                disabled={runtime.mode !== 'remote' || testingConnection || !urlInput.trim()}
                className="flex-1 android-secondary-btn text-xs font-semibold py-2 flex items-center justify-center gap-1.5 hover:bg-bolt-elements-background-depth-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingConnection ? (
                  <>
                    <div className="i-ph:spinner-gap animate-spin w-3.5 h-3.5" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <div className="i-ph:plugs-fill w-3.5 h-3.5" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCreateWorkspace}
                disabled={runtime.mode !== 'remote' || creatingWorkspace || !urlInput.trim()}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingWorkspace ? (
                  <>
                    <div className="i-ph:spinner-gap animate-spin w-3.5 h-3.5" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <div className="i-ph:plus-circle-fill w-3.5 h-3.5" />
                    <span>Create Workspace</span>
                  </>
                )}
              </button>
            </div>

            {/* File Sync */}
            <div className="flex flex-col gap-2 mt-2 border-t border-bolt-elements-borderColor pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-bolt-elements-textPrimary">File Sync</span>
                <span
                  className={classNames('text-[10px] uppercase px-2 py-0.5 rounded-full border', {
                    'bg-gray-500/10 border-gray-500/30 text-gray-400': syncStatus.state === 'idle',
                    'bg-accent-500/10 border-accent-500/30 text-accent-400': syncStatus.state === 'syncing',
                    'bg-green-500/10 border-green-500/30 text-green-400': syncStatus.state === 'success',
                    'bg-red-500/10 border-red-500/30 text-red-400': syncStatus.state === 'error',
                  })}
                >
                  {syncStatus.state}
                </span>
              </div>

              {missingRemoteConfig.length > 0 && (
                <div className="text-[10px] text-amber-400 bg-amber-950/20 border border-amber-900/50 rounded-lg p-2">
                  Remote file sync needs: {missingRemoteConfig.join(', ')}.
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => runSyncAction('push')}
                  disabled={!canUseRemoteSync || syncingAction !== null}
                  className="android-secondary-btn text-[10px] font-semibold py-2 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    className={syncingAction === 'push' ? 'i-ph:spinner-gap animate-spin' : 'i-ph:upload-simple-fill'}
                  />
                  <span>Sync workspace to Remote Runtime</span>
                </button>
                <button
                  onClick={() => runSyncAction('pull')}
                  disabled={!canUseRemoteSync || syncingAction !== null}
                  className="android-secondary-btn text-[10px] font-semibold py-2 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    className={syncingAction === 'pull' ? 'i-ph:spinner-gap animate-spin' : 'i-ph:download-simple-fill'}
                  />
                  <span>Pull remote files</span>
                </button>
                <button
                  onClick={() => runSyncAction('current-file')}
                  disabled={!canUseRemoteSync || syncingAction !== null}
                  className="android-secondary-btn text-[10px] font-semibold py-2 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    className={
                      syncingAction === 'current-file' ? 'i-ph:spinner-gap animate-spin' : 'i-ph:file-arrow-up-fill'
                    }
                  />
                  <span>Sync current file</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-bolt-elements-textSecondary">
                <span>
                  Last sync: {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}
                </span>
                <span>Synced files: {syncStatus.syncedFileCount}</span>
                <span>Skipped files: {syncStatus.skippedFileCount}</span>
                <span>Conflicts: {syncStatus.conflictCount}</span>
              </div>

              {syncStatus.lastError && (
                <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg p-2 break-all">
                  <strong>Last error:</strong> {syncStatus.lastError}
                </div>
              )}

              {syncStatus.warnings.length > 0 && (
                <div className="text-[10px] text-amber-300 bg-amber-950/20 border border-amber-900/50 rounded-lg p-2">
                  {syncStatus.warnings.slice(0, 3).map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Local Storage Card */}
        <section className="android-card">
          <h2 className="android-card-title">
            <div className="i-ph:hard-drive-fill" />
            Local Workspace
          </h2>
          <div className="android-card-content">
            {persistenceStatus.available ? (
              <>
                <div
                  className={`android-storage-status ${persistenceStatus.hasSavedFiles ? 'android-storage-saved' : 'android-storage-empty'}`}
                >
                  <div className={persistenceStatus.hasSavedFiles ? 'i-ph:floppy-disk-fill' : 'i-ph:database'} />
                  <span>
                    {persistenceStatus.hasSavedFiles
                      ? 'Files saved locally on this device'
                      : 'No local workspace saved yet'}
                  </span>
                </div>
                {persistenceStatus.lastOpenedFile && (
                  <p className="android-storage-last">Last file: {persistenceStatus.lastOpenedFile}</p>
                )}
                <button
                  className="android-danger-btn"
                  onClick={handleResetWorkspace}
                  disabled={resetting || !persistenceStatus.hasSavedFiles}
                >
                  {resetting ? (
                    <>
                      <div className="i-ph:spinner-gap animate-spin" /> Resetting…
                    </>
                  ) : (
                    <>
                      <div className="i-ph:trash-fill" /> Reset Local Workspace
                    </>
                  )}
                </button>
              </>
            ) : (
              <p className="android-storage-unavailable">
                IndexedDB not available — files are stored in memory only and will be lost on app restart.
              </p>
            )}
          </div>
        </section>

        {/* App Info Card */}
        <section className="android-card">
          <h2 className="android-card-title">
            <div className="i-ph:info-fill" />
            About
          </h2>
          <div className="android-card-content android-about space-y-2">
            <p className="android-about-name font-bold text-bolt-elements-textPrimary">VELDRA</p>
            <p className="android-about-version text-xs text-bolt-elements-textSecondary">v1.0.0 (Debug build)</p>
            <p className="text-xs text-bolt-elements-textSecondary">Build Date: 2026-07-05</p>

            <div className="border-t border-bolt-elements-borderColor/30 my-2 pt-2 text-xs">
              <span className="text-bolt-elements-textSecondary">Runtime Mode: </span>
              <span className="font-semibold text-bolt-elements-textPrimary">
                {runtime.mode === 'remote' ? 'Remote Runtime' : 'Android Fallback (Local)'}
              </span>
            </div>

            {runtime.mode === 'remote' && (
              <div className="text-xs">
                <span className="text-bolt-elements-textSecondary">Remote Status: </span>
                <span
                  className={classNames(
                    'font-semibold',
                    connectionState === 'connected' && 'text-green-500',
                    connectionState === 'failed' && 'text-red-500',
                    connectionState === 'checking' && 'text-blue-500',
                    connectionState === 'disconnected' && 'text-gray-500',
                  )}
                >
                  {connectionState === 'connected' && 'Connected'}
                  {connectionState === 'failed' && 'Failed'}
                  {connectionState === 'checking' && 'Checking…'}
                  {connectionState === 'disconnected' && 'Disconnected'}
                </span>
              </div>
            )}

            <p className="android-about-desc text-xs text-bolt-elements-textTertiary leading-normal mt-2">
              VELDRA for Android — provider-agnostic AI-powered development in your pocket. WebContainer features
              (terminal, dev server, preview) require a desktop browser or a connected Remote Runtime.
            </p>
            <button
              className="android-secondary-btn mt-3 w-full py-1.5 rounded-lg text-xs"
              onClick={() => {
                resetRuntimeMode();
                toast.info('Runtime mode reset to auto-detected');
              }}
            >
              <div className="i-ph:arrows-counter-clockwise" />
              Reset Runtime Mode
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
