import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const badgeVariants = cva(
  'inline-flex items-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-bolt-elements-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3',
        secondary:
          'border border-bolt-elements-borderColor/50 bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2',
        destructive: 'border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20',
        outline: 'border border-bolt-elements-borderColor text-bolt-elements-textPrimary',
        primary: 'border border-accent-500/30 bg-accent-500/10 text-accent-500',
        success: 'border border-green-500/30 bg-green-500/10 text-green-500',
        warning: 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-500',
        danger: 'border border-red-500/30 bg-red-500/10 text-red-500',
        info: 'border border-blue-500/30 bg-blue-500/10 text-blue-500',
        subtle:
          'border border-bolt-elements-borderColor/30 dark:border-bolt-elements-borderColor-dark/30 bg-white/50 dark:bg-bolt-elements-background-depth-4/50 backdrop-blur-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark',
      },
      size: {
        default: 'rounded-sm px-2 py-0.5 text-[10px] tracking-wider uppercase font-mono font-medium',
        sm: 'rounded-sm px-1.5 py-0.5 text-[9px] tracking-wider uppercase font-mono',
        md: 'rounded-sm px-2 py-1 text-[11px] tracking-wider uppercase font-mono font-medium',
        lg: 'rounded-sm px-3 py-1.5 text-xs tracking-wider uppercase font-mono font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  icon?: string;
}

function Badge({ className, variant, size, icon, children, ...props }: BadgeProps) {
  return (
    <div className={classNames(badgeVariants({ variant, size }), className)} {...props}>
      {icon && <span className={icon} />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
