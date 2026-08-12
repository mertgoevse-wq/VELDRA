import * as Tooltip from '@radix-ui/react-tooltip';
import { classNames } from '~/utils/classNames';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { TAB_LABELS, TAB_ICONS } from '~/components/@settings/core/constants';
import { GlowingEffect } from '~/components/ui/GlowingEffect';

interface TabTileProps {
  tab: TabVisibilityConfig;
  onClick?: () => void;
  isActive?: boolean;
  hasUpdate?: boolean;
  statusMessage?: string;
  description?: string;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const TabTile: React.FC<TabTileProps> = ({
  tab,
  onClick,
  isActive,
  hasUpdate,
  statusMessage,
  description,
  isLoading,
  className,
  children,
}: TabTileProps) => {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {/*
           * Below `sm`, this renders as a compact horizontal list row (icon + title + one-line
           * description + chevron) instead of the sm+ card -- 14 tabs at min-h-[160px] each forced
           * ~2500px of scroll on a 390px phone to reach e.g. "Image Studio". One adaptive markup
           * (no duplicate JSX, no JS breakpoint check) so both layouts always stay in sync.
           */}
          <div className={classNames('min-h-0 sm:min-h-[160px] list-none', className || '')}>
            <div className="relative sm:h-full veldra-radius-surface border border-[#E5E5E5] dark:border-[#333333] p-0.5">
              <GlowingEffect
                blur={0}
                borderWidth={1}
                spread={20}
                glow={true}
                disabled={false}
                proximity={40}
                inactiveZone={0.3}
                movementDuration={0.4}
              />
              <div
                onClick={onClick}
                className={classNames(
                  'relative flex items-center gap-3 p-3 sm:flex-col sm:items-center sm:justify-center sm:h-full sm:gap-0 sm:p-4',
                  'veldra-radius-control veldra-motion',
                  'bg-white dark:bg-[#141414]',
                  'group cursor-pointer',
                  'hover:bg-accent-50 dark:hover:bg-[#1a1a1a]',
                  isActive ? 'bg-accent-500/5 dark:bg-accent-500/10' : '',
                  isLoading ? 'cursor-wait opacity-70 pointer-events-none' : '',
                )}
              >
                {/* Icon */}
                <div
                  className={classNames(
                    'relative shrink-0',
                    'w-10 h-10 sm:w-14 sm:h-14',
                    'flex items-center justify-center',
                    'rounded-xl',
                    'bg-gray-100 dark:bg-gray-800',
                    'ring-1 ring-gray-200 dark:ring-gray-700',
                    'group-hover:bg-accent-100 dark:group-hover:bg-gray-700/80',
                    'group-hover:ring-accent-200 dark:group-hover:ring-accent-800/30',
                    'transition-all duration-100 ease-out',
                    isActive ? 'bg-accent-500/10 dark:bg-accent-500/10 ring-accent-500/30 dark:ring-accent-500/20' : '',
                  )}
                >
                  {(() => {
                    const IconComponent = TAB_ICONS[tab.id];
                    return (
                      <IconComponent
                        className={classNames(
                          'w-6 h-6 sm:w-8 sm:h-8',
                          'text-gray-600 dark:text-gray-300',
                          'group-hover:text-accent-500 dark:group-hover:text-accent-400/80',
                          'transition-colors duration-100 ease-out',
                          isActive ? 'text-accent-500 dark:text-accent-400/90' : '',
                        )}
                      />
                    );
                  })()}
                </div>

                {/* Label and Description */}
                <div className="flex min-w-0 flex-1 flex-col items-start sm:mt-4 sm:w-full sm:flex-none sm:items-center">
                  <h3
                    className={classNames(
                      'w-full truncate text-[15px] font-medium leading-snug sm:mb-2 sm:overflow-visible sm:whitespace-normal sm:text-center',
                      'text-gray-700 dark:text-gray-200',
                      'group-hover:text-accent-600 dark:group-hover:text-accent-300/90',
                      'transition-colors duration-100 ease-out',
                      isActive ? 'text-accent-500 dark:text-accent-400/90' : '',
                    )}
                  >
                    {TAB_LABELS[tab.id]}
                  </h3>
                  {description && (
                    <p
                      className={classNames(
                        'line-clamp-1 w-full text-[13px] leading-relaxed sm:line-clamp-none sm:max-w-[85%] sm:w-auto',
                        'text-gray-500 dark:text-gray-400',
                        'sm:text-center',
                        'group-hover:text-accent-500 dark:group-hover:text-accent-400/70',
                        'transition-colors duration-100 ease-out',
                        isActive ? 'text-accent-400 dark:text-accent-400/80' : '',
                      )}
                    >
                      {description}
                    </p>
                  )}
                </div>

                {/* Mobile-only affordance: card layout at sm+ doesn't need a chevron */}
                <div className="i-ph:caret-right h-4 w-4 shrink-0 text-gray-400 dark:text-gray-600 sm:hidden" />

                {/* Update Indicator with Tooltip */}
                {hasUpdate && (
                  <>
                    <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent-500 dark:bg-accent-400 animate-pulse sm:right-4 sm:top-4" />
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className={classNames(
                          'px-3 py-1.5 rounded-lg',
                          'bg-[#18181B] text-white',
                          'text-sm font-medium',
                          'select-none',
                          'z-[100]',
                        )}
                        side="top"
                        sideOffset={5}
                      >
                        {statusMessage}
                        <Tooltip.Arrow className="fill-[#18181B]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </>
                )}

                {/* Children (e.g. Beta Label) */}
                {children}
              </div>
            </div>
          </div>
        </Tooltip.Trigger>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
