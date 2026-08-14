import { memo, useState, type ReactNode } from 'react';
import { classNames } from '~/utils/classNames';
import { isMobileDevice } from '~/utils/mobile';

/**
 * MobileFileTreeDrawer — wraps the file tree in a left slide-in drawer
 * on mobile devices. On desktop, renders children directly without any
 * wrapper (zero-impact passthrough).
 *
 * Usage:
 *   <MobileFileTreeDrawer>
 *     <FileTree ... />
 *   </MobileFileTreeDrawer>
 *
 * On mobile, a toggle button is rendered (a hamburger icon). Tapping it
 * slides the file tree panel in from the left, covering ~80% of the
 * screen width (max 320px). Tapping the backdrop or the toggle again
 * closes it.
 */

interface MobileFileTreeDrawerProps {
  children: ReactNode;

  /** Label for the toggle button */
  label?: string;
}

function MobileFileTreeDrawerBase({ children, label = 'Files' }: MobileFileTreeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // On desktop, pass through without any wrapper
  if (!isMobileDevice()) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Toggle button — sits at the top-left of the editor area */}
      <button
        className="mobile-only flex items-center gap-1.5 px-2 py-1.5 text-sm bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary rounded-md"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`${isOpen ? 'Close' : 'Open'} ${label}`}
        aria-expanded={isOpen}
      >
        <div className={classNames('i-ph:list transition-transform', { 'rotate-90': isOpen })} />
        <span className="text-xs">{label}</span>
      </button>

      {/* Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[199] bg-black/30" onClick={() => setIsOpen(false)} aria-hidden="true" />
          {/* Drawer panel */}
          <div className="mobile-filetree-drawer open">
            <div className="flex items-center justify-between px-3 py-2 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 sticky top-0 z-10">
              <span className="text-sm font-medium text-bolt-elements-textPrimary">{label}</span>
              <button
                className="i-ph:x text-lg text-bolt-elements-textSecondary min-w-[44px] min-h-[44px] flex items-center justify-center"
                onClick={() => setIsOpen(false)}
                aria-label="Close file tree drawer"
              />
            </div>
            <div className="overflow-y-auto">{children}</div>
          </div>
        </>
      )}
    </>
  );
}

export const MobileFileTreeDrawer = memo(MobileFileTreeDrawerBase);
