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
  compact?: boolean;
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
  compact = false,
  className,
  children,
}: TabTileProps) => {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClick}
            className={classNames(
              compact ? 'settings-mobile-item' : 'min-h-[160px] list-none',
              className || '',
              'relative h-full w-full veldra-radius-surface border border-[#E5E5E5] dark:border-[#333333] p-0.5',
              'appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2',
              compact && 'settings-mobile-item-shell',
            )}
          >
            {!compact && (
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
            )}
            <div
              className={classNames(
                compact
                  ? 'settings-mobile-item-button relative flex w-full items-center text-left h-full min-h-[52px] px-3 py-2 veldra-radius-control veldra-motion'
                  : 'relative flex w-full flex-col items-center justify-center h-full p-4 veldra-radius-control veldra-motion',
                'bg-white dark:bg-[#141414]',
                'group cursor-pointer',
                'hover:bg-accent-50 dark:hover:bg-[#1a1a1a]',
                isActive ? 'bg-accent-500/5 dark:bg-accent-500/10' : '',
                isLoading ? 'cursor-wait opacity-70' : '',
              )}
            >
              {/* Icon */}
              <div
                className={classNames(
                  'relative',
                  compact ? 'w-9 h-9 shrink-0' : 'w-14 h-14',
                  'flex items-center justify-center',
                  compact ? 'rounded-lg' : 'rounded-xl',
                  'bg-gray-100 dark:bg-gray-800',
                  'ring-1 ring-gray-200 dark:ring-gray-700',
                  'group-hover:bg-accent-100 dark:group-hover:bg-gray-700/80',
                  'group-hover:ring-accent-200 dark:group-hover:ring-accent-800/30',
                  'transition-all duration-100 ease-out',
                  compact ? 'mr-3' : '',
                  isActive ? 'bg-accent-500/10 dark:bg-accent-500/10 ring-accent-500/30 dark:ring-accent-500/20' : '',
                )}
              >
                {(() => {
                  const IconComponent = TAB_ICONS[tab.id];
                  return (
                    <IconComponent
                      className={classNames(
                        compact ? 'w-5 h-5' : 'w-8 h-8',
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
              <div
                className={classNames('flex flex-col w-full min-w-0', compact ? 'items-start' : 'items-center mt-4')}
              >
                <div
                  className={classNames(
                    'flex items-center w-full min-w-0',
                    compact ? 'justify-between gap-2' : 'justify-center',
                  )}
                >
                  <h3
                    className={classNames(
                      'text-[15px] font-medium leading-snug mb-2',
                      'text-gray-700 dark:text-gray-200',
                      'group-hover:text-accent-600 dark:group-hover:text-accent-300/90',
                      'transition-colors duration-100 ease-out',
                      isActive ? 'text-accent-500 dark:text-accent-400/90' : '',
                    )}
                  >
                    {TAB_LABELS[tab.id]}
                  </h3>
                  {compact && <div className="i-ph:caret-right h-4 w-4 shrink-0 text-bolt-elements-textTertiary" />}
                </div>
                {description && (
                  <p
                    className={classNames(
                      'text-[13px] leading-relaxed',
                      'text-gray-500 dark:text-gray-400',
                      compact ? 'mt-0.5 pr-5 text-left' : 'max-w-[85%] text-center',
                      'group-hover:text-accent-500 dark:group-hover:text-accent-400/70',
                      'transition-colors duration-100 ease-out',
                      isActive ? 'text-accent-400 dark:text-accent-400/80' : '',
                    )}
                  >
                    {description}
                  </p>
                )}
              </div>

              {/* Update Indicator with Tooltip */}
              {hasUpdate && (
                <>
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent-500 dark:bg-accent-400 animate-pulse" />
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
          </button>
        </Tooltip.Trigger>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
