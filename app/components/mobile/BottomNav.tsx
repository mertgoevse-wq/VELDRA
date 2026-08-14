import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { isMobileDevice } from '~/utils/mobile';

/**
 * Bottom navigation bar for mobile devices.
 *
 * Shows four tabs: Chat, Files, Preview, Settings.
 * Only rendered on mobile (Capacitor or touch + narrow viewport).
 * On desktop, this component renders null.
 *
 * The tab switching is done via callbacks — the parent component
 * (BaseChat / Workbench) controls what's visible. The bottom nav
 * just provides touch-friendly navigation buttons.
 */

export type MobileTab = 'chat' | 'files' | 'preview' | 'settings';

interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;

  /** Whether the workbench (files/preview) is available — requires chatStarted */
  workbenchAvailable?: boolean;
}

interface TabConfig {
  id: MobileTab;
  label: string;
  icon: string;
  disabled?: boolean;
}

function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(8);
  }
}

function BottomNavBase({ activeTab, onTabChange, workbenchAvailable = false }: BottomNavProps) {
  if (!isMobileDevice()) {
    return null;
  }

  const tabs: TabConfig[] = [
    { id: 'chat', label: 'Chat', icon: 'i-ph:chat-circle' },
    { id: 'files', label: 'Files', icon: 'i-ph:folder-simple', disabled: !workbenchAvailable },
    { id: 'preview', label: 'Preview', icon: 'i-ph:eye', disabled: !workbenchAvailable },
    { id: 'settings', label: 'Settings', icon: 'i-ph:gear' },
  ];

  return (
    <nav className="mobile-bottom-nav mobile-only">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={classNames({ active: activeTab === tab.id })}
          disabled={tab.disabled}
          onClick={() => {
            if (!tab.disabled) {
              triggerHaptic();
              onTabChange(tab.id);
            }
          }}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <div className={tab.icon} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export const BottomNav = memo(BottomNavBase);
