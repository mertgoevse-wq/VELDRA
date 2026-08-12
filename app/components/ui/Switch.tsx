import { memo } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { classNames } from '~/utils/classNames';

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  className?: string;
}

export const Switch = memo(({ className, ...props }: SwitchProps) => {
  return (
    <SwitchPrimitive.Root
      className={classNames(
        'relative h-6 w-11 cursor-pointer rounded-full bg-bolt-elements-button-primary-background',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-bolt-elements-item-contentAccent',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={classNames(
          'block h-5 w-5 rounded-full bg-white',
          'shadow-lg shadow-black/20',
          'transition-transform duration-200 ease-in-out',
          'translate-x-0.5',
          'data-[state=checked]:translate-x-[1.375rem]',
          'will-change-transform',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
