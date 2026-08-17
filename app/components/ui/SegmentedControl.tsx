import { useMemo } from 'react';
import { classNames } from '~/utils/classNames';
import { genericMemo } from '~/utils/react';

/**
 * SegmentedControl -- shared Android-first segmented control primitive.
 *
 * Unlike `Slider` (capped at 3 options, tuned for compact desktop toolbars), this supports
 * any number of options and guarantees a real 44dp touch target per segment. The active
 * indicator is a plain CSS transform/transition (not framer-motion) so it automatically
 * respects `prefers-reduced-motion` through `--veldra-motion-duration-base`'s token-level
 * zeroing (see variables.scss) instead of needing its own reduced-motion check.
 */

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

export const SegmentedControl = genericMemo(
  <T extends string>({ value, options, onChange, className, 'aria-label': ariaLabel }: SegmentedControlProps<T>) => {
    const activeIndex = useMemo(() => {
      const index = options.findIndex((option) => option.value === value);
      return index === -1 ? 0 : index;
    }, [options, value]);

    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={classNames(
          'relative flex items-stretch shrink-0 gap-0.5 rounded-full p-1',
          'bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor',
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-full bg-bolt-elements-item-backgroundAccent transition-transform ease-out"
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(calc(${activeIndex} * (100% + 0.125rem)))`,
            transitionDuration: 'var(--veldra-motion-duration-base)',
          }}
        />
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option.value)}
              className={classNames(
                'relative z-10 flex flex-1 min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
                selected
                  ? 'text-bolt-elements-item-contentAccent'
                  : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
              )}
            >
              {option.icon && <div className={option.icon} />}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  },
);
