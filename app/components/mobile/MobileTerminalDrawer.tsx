import { memo, useState, type ReactNode } from 'react';
import { classNames } from '~/utils/classNames';
import { isMobileDevice } from '~/utils/mobile';

/**
 * MobileTerminalDrawer — wraps the terminal in a bottom slide-up drawer
 * on mobile devices. On desktop, renders children directly without any
 * wrapper (zero-impact passthrough).
 *
 * Usage:
 *   <MobileTerminalDrawer>
 *     <TerminalTabs ... />
 *   </MobileTerminalDrawer>
 *
 * On mobile, a toggle button is rendered (a small tab at the bottom of
 * the workbench area). Tapping it slides the terminal panel up from the
 * bottom, covering ~60% of the screen. Tapping the backdrop or the
 * toggle again closes it.
 */

interface MobileTerminalDrawerProps {
  children: ReactNode;

  /** Label for the toggle button */
  label?: string;
}

function MobileTerminalDrawerBase({ children, label = 'Terminal' }: MobileTerminalDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // On desktop, pass through without any wrapper
  if (!isMobileDevice()) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Toggle button — sits at the bottom of the editor area */}
      <button
        className="mobile-only flex items-center gap-1.5 px-3 py-2 text-xs bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary border-t border-bolt-elements-borderColor w-full justify-center"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`${isOpen ? 'Close' : 'Open'} ${label}`}
        aria-expanded={isOpen}
      >
        <div className={classNames('i-ph:terminal transition-transform', { 'rotate-180': isOpen })} />
        <span>{label}</span>
      </button>

      {/* Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[199] bg-black/30" onClick={() => setIsOpen(false)} aria-hidden="true" />
          {/* Drawer panel */}
          <div className="mobile-terminal-drawer open">
            <div className="flex items-center justify-between px-3 py-2 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
              <span className="text-sm font-medium text-bolt-elements-textPrimary">{label}</span>
              <button
                className="i-ph:x text-lg text-bolt-elements-textSecondary min-w-[44px] min-h-[44px] flex items-center justify-center"
                onClick={() => setIsOpen(false)}
                aria-label="Close terminal drawer"
              />
            </div>
            <div className="h-[calc(100%-40px)] overflow-hidden">{children}</div>
          </div>
        </>
      )}
    </>
  );
}

export const MobileTerminalDrawer = memo(MobileTerminalDrawerBase);
