/**
 * RuntimeModeBanner
 *
 * Shows a dismissible banner at the top of the chat area when the app
 * is running in Android Fallback or Remote mode (i.e. WebContainer is
 * not available).
 *
 * The banner explains:
 *   - Code editing works locally in the UI
 *   - Command execution / dev server / preview require a remote runtime
 *   - (If remote URL is set) Remote runtime is configured
 *   - How to configure a remote runtime URL in Settings
 */

import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { classNames } from '~/utils/classNames';

const STORAGE_KEY_DISMISSED = 'bolt_runtime_banner_dismissed_v1';

export function RuntimeModeBanner() {
  const runtime = useStore(runtimeModeStore);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_DISMISSED) === 'true';
    } catch {
      return false;
    }
  });

  // Don't show banner in WebContainer mode
  if (runtime.mode === 'webcontainer' && runtime.webContainerAvailable) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);

    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
    } catch {
      // ignore
    }
  };

  const isRemoteConfigured = runtime.mode === 'remote' && runtime.remoteRuntimeUrl;

  const bannerText = isRemoteConfigured
    ? 'Remote runtime is configured. Code editing works locally; commands run on the remote server.'
    : runtime.isAndroid
      ? 'Running in Android Fallback Mode. Code editing works in the UI, but command execution, package install, dev server, and live preview require a remote runtime.'
      : 'WebContainer is not available in this browser. Code editing works in the UI, but command execution and preview require a remote runtime.';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={classNames(
          'relative overflow-hidden',
          'bg-bolt-elements-background-depth-2 backdrop-blur',
          'border-b border-bolt-elements-borderColor',
        )}
      >
        <div className="flex items-start gap-3 px-4 py-3 text-sm">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className={classNames('i-ph:info-fill w-4 h-4', 'text-accent-500')} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 font-mono tracking-tight">
            <p className="text-bolt-elements-textPrimary leading-snug">{bannerText}</p>
            {!isRemoteConfigured && (
              <p className="text-bolt-elements-textSecondary text-xs mt-1">
                Configure a remote runtime URL in Settings → Runtime Mode to enable command execution.
              </p>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-bolt-elements-item-backgroundActive transition-colors"
            aria-label="Dismiss banner"
          >
            <div className="i-ph:x-bold w-3.5 h-3.5 text-bolt-elements-textTertiary" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
