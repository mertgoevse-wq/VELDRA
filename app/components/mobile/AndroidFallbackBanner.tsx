/**
 * Android Fallback UI Banner
 *
 * Displays critical information about Android limitations and available features.
 * Shows when running in Android Fallback Mode.
 */

import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { getAndroidFallbackPersistenceStatus } from '~/lib/persistence/androidFallbackStorage';
import { useEffect, useState } from 'react';

export default function AndroidFallbackBanner() {
  const runtime = useStore(runtimeModeStore);
  const [persistenceStatus, setPersistenceStatus] = useState({ available: false, hasSavedFiles: false });

  useEffect(() => {
    if (!runtime.isAndroid || runtime.mode !== 'android-fallback') {
      return;
    }

    async function checkStatus() {
      const status = await getAndroidFallbackPersistenceStatus();
      setPersistenceStatus(status);
    }

    void checkStatus();
  }, [runtime.isAndroid, runtime.mode]);

  if (!runtime.isAndroid || runtime.mode !== 'android-fallback') {
    return null;
  }

  return (
    <motion.div
      className={classNames(
        'fixed top-0 left-0 right-0 z-50',
        'bg-amber-50 dark:bg-amber-950/20',
        'border-b border-amber-200 dark:border-amber-800/50',
        'px-4 py-3 text-sm',
      )}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="max-w-full mx-auto flex items-start gap-3">
        <div className="i-ph:warning-fill w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 text-amber-800 dark:text-amber-200">
          <div className="font-medium">Android Fallback Mode</div>
          <div className="text-xs opacity-85 mt-1 space-y-1">
            <p>✅ Chat, editing, and file management work normally</p>
            <p>⚠️ Terminal, dev server, and live preview are disabled</p>
            {persistenceStatus.available && (
              <p>💾 Files are {persistenceStatus.hasSavedFiles ? 'saved locally' : 'not yet saved'}</p>
            )}
            <p>Open Settings → Runtime Mode for configuration options</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
