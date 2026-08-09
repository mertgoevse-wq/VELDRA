/**
 * RuntimeModeTab
 *
 * Settings tab that shows the current runtime mode and lets the user
 * switch between:
 *   - WebContainer Browser Mode (desktop only)
 *   - Android Fallback Mode
 *   - Remote Runtime URL
 *
 * Remote Runtime is optional. File sync is implemented as an explicit
 * user action; command execution remains disabled/stubbed.
 */

import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import {
  runtimeModeStore,
  setRuntimeMode,
  setRemoteRuntimeUrl,
  setRemoteAuthToken,
  setRemoteWorkspaceId,
  resetRuntimeMode,
  type RuntimeMode,
} from '~/lib/stores/runtime-mode';
import { getAndroidFallbackPersistenceStatus } from '~/lib/persistence/androidFallbackStorage';
import { workbenchStore } from '~/lib/stores/workbench';
import {
  getMissingRemoteRuntimeConfig,
  getSyncStatus,
  pullRemoteWorkspaceToLocal,
  pushLocalWorkspaceToRemote,
  syncSingleFileToRemote,
  type RemoteWorkspaceSyncStatus,
} from '~/lib/remote-runtime/RemoteWorkspaceSync';

interface ModeOption {
  id: RuntimeMode;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  unavailableReason?: string;
}

export default function RuntimeModeTab() {
  const runtime = useStore(runtimeModeStore);
  const [urlInput, setUrlInput] = useState(runtime.remoteRuntimeUrl);
  const [tokenInput, setTokenInput] = useState(runtime.remoteAuthToken);
  const [workspaceInput, setWorkspaceInput] = useState(runtime.remoteWorkspaceId);
  const [syncingAction, setSyncingAction] = useState<'push' | 'pull' | 'current-file' | null>(null);
  const [syncStatus, setSyncStatus] = useState<RemoteWorkspaceSyncStatus>(() => getSyncStatus());
  const [persistenceStatus, setPersistenceStatus] = useState({
    available: false,
    hasSavedFiles: false,
    lastOpenedFile: undefined as string | undefined,
  });

  useEffect(() => {
    let active = true;

    async function refreshStatus() {
      const status = await getAndroidFallbackPersistenceStatus();

      if (active) {
        setPersistenceStatus(status);
      }
    }

    void refreshStatus();

    return () => {
      active = false;
    };
  }, [runtime.mode, runtime.isAndroid]);

  useEffect(() => {
    setUrlInput(runtime.remoteRuntimeUrl);
  }, [runtime.remoteRuntimeUrl]);

  useEffect(() => {
    setTokenInput(runtime.remoteAuthToken);
  }, [runtime.remoteAuthToken]);

  useEffect(() => {
    setWorkspaceInput(runtime.remoteWorkspaceId);
  }, [runtime.remoteWorkspaceId]);

  const modes: ModeOption[] = [
    {
      id: 'webcontainer',
      label: 'WebContainer Browser Mode',
      description:
        'Full in-browser runtime. Supports terminal, package install, dev server, and live preview. Requires SharedArrayBuffer + cross-origin isolation.',
      icon: 'i-ph:browser-fill',
      available: runtime.webContainerAvailable,
      unavailableReason: runtime.isAndroid
        ? 'Not available on Android WebView (no SharedArrayBuffer)'
        : 'Not available in this browser (requires cross-origin isolation)',
    },
    {
      id: 'android-fallback',
      label: 'Android Fallback Mode',
      description:
        'In-memory file system. Code editing and AI chat work. Terminal, command execution, package install, dev server, and preview are disabled.',
      icon: 'i-ph:device-mobile-fill',
      available: true,
    },
    {
      id: 'remote',
      label: 'Remote Runtime',
      description:
        'Connect to a remote sandbox server for explicit file sync. Local IndexedDB files remain the source of truth. Command execution stays disabled.',
      icon: 'i-ph:cloud-fill',
      available: true,
    },
  ];

  const handleModeChange = useCallback(
    (mode: RuntimeMode) => {
      const option = modes.find((m) => m.id === mode);

      if (mode === 'remote' && !urlInput.trim()) {
        toast.info('Enter a remote runtime URL below to use Remote Runtime mode');
      }

      setRuntimeMode(mode);
      toast.success(`Runtime mode set to: ${option?.label ?? mode}`);
    },
    [urlInput],
  );

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
    toast.success('Remote runtime auth token saved');
  }, [tokenInput]);

  const handleWorkspaceSave = useCallback(() => {
    setRemoteWorkspaceId(workspaceInput.trim());
    toast.success('Remote runtime workspace ID saved');
  }, [workspaceInput]);

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

  const handleReset = useCallback(() => {
    resetRuntimeMode();
    toast.success('Runtime mode reset to auto-detected value');
  }, []);

  const handleResetWorkspace = useCallback(async () => {
    try {
      await workbenchStore.resetLocalAndroidWorkspace();

      const status = await getAndroidFallbackPersistenceStatus();
      setPersistenceStatus(status);
      toast.success('Local Android workspace cleared');
    } catch (error) {
      console.error(error);
      toast.error('Unable to reset local Android workspace');
    }
  }, []);

  const missingRemoteConfig = getMissingRemoteRuntimeConfig();
  const canUseRemoteSync = runtime.mode === 'remote' && missingRemoteConfig.length === 0;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <motion.div
        className={classNames('rounded-lg shadow-sm dark:shadow-none p-4 space-y-3', 'bg-white dark:bg-[#0A0A0A]')}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex items-center gap-2">
          <div
            className={classNames(
              'w-4 h-4',
              runtime.mode === 'webcontainer'
                ? 'text-green-500'
                : runtime.mode === 'remote'
                  ? 'text-blue-500'
                  : 'text-amber-500',
            )}
          >
            <div
              className={classNames(
                'w-4 h-4',
                runtime.mode === 'webcontainer'
                  ? 'i-ph:check-circle-fill'
                  : runtime.mode === 'remote'
                    ? 'i-ph:cloud-fill'
                    : 'i-ph:warning-fill',
              )}
            />
          </div>
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Current Runtime</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-bolt-elements-textSecondary">Mode:</span>{' '}
            <span className="font-medium text-bolt-elements-textPrimary">
              {modes.find((m) => m.id === runtime.mode)?.label ?? runtime.mode}
            </span>
          </div>
          <div>
            <span className="text-bolt-elements-textSecondary">Detected:</span>{' '}
            <span className="font-medium text-bolt-elements-textPrimary">
              {runtime.autoDetected ? 'Auto' : 'Manual'}
            </span>
          </div>
          <div>
            <span className="text-bolt-elements-textSecondary">WebContainer:</span>{' '}
            <span
              className={classNames(
                'font-medium',
                runtime.webContainerAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-500',
              )}
            >
              {runtime.webContainerAvailable ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <div>
            <span className="text-bolt-elements-textSecondary">Android:</span>{' '}
            <span
              className={classNames(
                'font-medium',
                runtime.isAndroid ? 'text-amber-600 dark:text-amber-400' : 'text-bolt-elements-textPrimary',
              )}
            >
              {runtime.isAndroid ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          <div className="flex items-center justify-between gap-3">
            <span>
              {persistenceStatus.hasSavedFiles ? 'Saved locally on Android' : 'No local Android workspace yet'}
            </span>
            {runtime.isAndroid && (
              <button
                onClick={handleResetWorkspace}
                className="rounded-md border border-emerald-700/20 px-2.5 py-1 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              >
                Reset local Android workspace
              </button>
            )}
          </div>
          {persistenceStatus.lastOpenedFile && (
            <div className="mt-1 text-xs opacity-80">Last opened: {persistenceStatus.lastOpenedFile}</div>
          )}
        </div>
      </motion.div>

      {/* Mode Selection */}
      <motion.div
        className={classNames('rounded-lg shadow-sm dark:shadow-none p-4 space-y-3', 'bg-white dark:bg-[#0A0A0A]')}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:cpu-fill w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Runtime Mode</span>
        </div>

        <div className="space-y-2">
          {modes.map((option) => {
            const isSelected = runtime.mode === option.id;

            return (
              <label
                key={option.id}
                className={classNames(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                    : 'border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-300 dark:hover:border-purple-700',
                  !option.available && 'opacity-50 cursor-not-allowed',
                )}
                onClick={(e) => {
                  if (!option.available) {
                    e.preventDefault();
                    return;
                  }

                  handleModeChange(option.id);
                }}
              >
                {/* Radio */}
                <div
                  className={classNames(
                    'flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    isSelected ? 'border-purple-500' : 'border-gray-300 dark:border-gray-600',
                  )}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </div>

                {/* Icon */}
                <div
                  className={classNames(
                    'flex-shrink-0 w-5 h-5 mt-0.5',
                    option.icon,
                    isSelected ? 'text-purple-500' : 'text-bolt-elements-textSecondary',
                  )}
                />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-bolt-elements-textPrimary">{option.label}</div>
                  <div className="text-xs text-bolt-elements-textSecondary mt-0.5 leading-relaxed">
                    {option.description}
                  </div>
                  {!option.available && option.unavailableReason && (
                    <div className="text-xs text-red-500 mt-1">{option.unavailableReason}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </motion.div>

      {/* Remote Runtime */}
      <motion.div
        className={classNames(
          'rounded-lg shadow-sm dark:shadow-none p-4 space-y-3',
          'bg-white dark:bg-[#0A0A0A]',
          runtime.mode !== 'remote' && 'opacity-60',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:link-fill w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Remote Runtime</span>
        </div>

        <p className="text-xs text-bolt-elements-textSecondary">
          Remote Runtime syncs text files, runs safe command profiles, and detects live preview URLs. Local IndexedDB
          remains the source of truth. On Android, localhost is the phone; use your laptop LAN IP such as
          http://192.168.x.x:8787. For live preview, run project dev servers with --host 0.0.0.0 or equivalent.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://192.168.x.x:8787"
            disabled={runtime.mode !== 'remote'}
            className={classNames(
              'flex-1 px-3 py-2 rounded-lg text-sm',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              'transition-all duration-200',
              'placeholder:text-bolt-elements-textTertiary',
              'disabled:cursor-not-allowed',
            )}
          />
          <button
            onClick={handleUrlSave}
            disabled={runtime.mode !== 'remote'}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-purple-500 text-white',
              'hover:bg-purple-600',
              'transition-all duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Save
          </button>
        </div>

        {runtime.remoteRuntimeUrl && (
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <div className="i-ph:check-circle-fill w-3 h-3" />
            <span>Saved: {runtime.remoteRuntimeUrl}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Auth token"
              disabled={runtime.mode !== 'remote'}
              className={classNames(
                'flex-1 px-3 py-2 rounded-lg text-sm',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'text-bolt-elements-textPrimary',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                'transition-all duration-200',
                'placeholder:text-bolt-elements-textTertiary',
                'disabled:cursor-not-allowed',
              )}
            />
            <button
              onClick={handleTokenSave}
              disabled={runtime.mode !== 'remote'}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
              placeholder="Workspace ID"
              disabled={runtime.mode !== 'remote'}
              className={classNames(
                'flex-1 px-3 py-2 rounded-lg text-sm',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'text-bolt-elements-textPrimary',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                'transition-all duration-200',
                'placeholder:text-bolt-elements-textTertiary',
                'disabled:cursor-not-allowed',
              )}
            />
            <button
              onClick={handleWorkspaceSave}
              disabled={runtime.mode !== 'remote'}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        {missingRemoteConfig.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 flex items-start gap-2">
            <div className="i-ph:info-fill w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Remote file sync needs: {missingRemoteConfig.join(', ')}.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => runSyncAction('push')}
            disabled={!canUseRemoteSync || syncingAction !== null}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-[#E5E5E5] dark:border-[#1A1A1A] text-bolt-elements-textPrimary hover:bg-gray-50 dark:hover:bg-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <div className={syncingAction === 'push' ? 'i-ph:spinner-gap animate-spin' : 'i-ph:upload-simple-fill'} />
            <span>Sync workspace to Remote Runtime</span>
          </button>
          <button
            onClick={() => runSyncAction('pull')}
            disabled={!canUseRemoteSync || syncingAction !== null}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-[#E5E5E5] dark:border-[#1A1A1A] text-bolt-elements-textPrimary hover:bg-gray-50 dark:hover:bg-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <div className={syncingAction === 'pull' ? 'i-ph:spinner-gap animate-spin' : 'i-ph:download-simple-fill'} />
            <span>Pull remote files</span>
          </button>
          <button
            onClick={() => runSyncAction('current-file')}
            disabled={!canUseRemoteSync || syncingAction !== null}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-[#E5E5E5] dark:border-[#1A1A1A] text-bolt-elements-textPrimary hover:bg-gray-50 dark:hover:bg-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <div
              className={syncingAction === 'current-file' ? 'i-ph:spinner-gap animate-spin' : 'i-ph:file-arrow-up-fill'}
            />
            <span>Sync current file</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-bolt-elements-textSecondary">
          <span>Last sync: {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}</span>
          <span>Status: {syncStatus.state}</span>
          <span>Synced: {syncStatus.syncedFileCount}</span>
          <span>Skipped: {syncStatus.skippedFileCount}</span>
        </div>

        {syncStatus.lastError && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg p-2 break-all">
            Last error: {syncStatus.lastError}
          </div>
        )}

        {syncStatus.conflictCount > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2">
            {syncStatus.conflictCount} conflict(s) found. Local files were kept by default.
          </div>
        )}

        <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 flex items-start gap-2">
          <div className="i-ph:info-fill w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Start the server with REMOTE_RUNTIME_HOST=0.0.0.0 and REMOTE_RUNTIME_PORT=8787 when testing from a phone.
          </span>
        </div>
      </motion.div>

      {/* Capability Summary */}
      <motion.div
        className={classNames('rounded-lg shadow-sm dark:shadow-none p-4 space-y-3', 'bg-white dark:bg-[#0A0A0A]')}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:list-checks-fill w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Capabilities</span>
        </div>

        <div className="space-y-1.5">
          {(
            [
              ['fileSystem', 'File System (read/write/edit)'],
              ['terminal', 'Interactive Terminal'],
              ['commandExecution', 'Command Execution'],
              ['packageInstall', 'Package Install (npm/pnpm)'],
              ['devServer', 'Dev Server'],
              ['preview', 'Live Preview'],
              ['persistentFileSystem', 'Persistent File System'],
            ] as const
          ).map(([key, label]) => {
            const enabled = runtime.capabilities[key];
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div
                  className={classNames(
                    'w-4 h-4 flex items-center justify-center',
                    enabled ? 'text-green-500' : 'text-red-400',
                  )}
                >
                  <div
                    className={classNames('w-3.5 h-3.5', enabled ? 'i-ph:check-circle-fill' : 'i-ph:x-circle-fill')}
                  />
                </div>
                <span
                  className={classNames(
                    enabled ? 'text-bolt-elements-textPrimary' : 'text-bolt-elements-textSecondary',
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Reset button */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <button
          onClick={handleReset}
          className={classNames(
            'w-full px-4 py-2 rounded-lg text-sm font-medium',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'text-bolt-elements-textSecondary',
            'hover:bg-gray-50 dark:hover:bg-[#1A1A1A]',
            'transition-all duration-200',
          )}
        >
          Reset to Auto-Detected Mode
        </button>
      </motion.div>
    </div>
  );
}
