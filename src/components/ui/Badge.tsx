import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      // Dark variants use a translucent tint over the card surface rather than reusing the
      // light-mode solid-50 swatch — a bare light pastel chip on a dark card reads as a
      // washed-out, mismatched rectangle. See the Pulse Redesign design canvas.
      variant: {
        green:  'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30',
        red:    'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30',
        yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30',
        blue:   'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/30',
        gray:   'bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-white/10 dark:text-gray-200 dark:ring-white/15',
        purple: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/15 dark:text-purple-400 dark:ring-purple-500/30',
      },
    },
    defaultVariants: { variant: 'gray' },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  label: string;
}

export default function Badge({ label, variant, className, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {label}
    </span>
  );
}

export { badgeVariants };
