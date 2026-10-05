import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import Spinner from './Spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring',
        secondary: 'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
        danger:    'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
        ghost:     'text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
        link:      'text-primary underline-offset-4 hover:underline focus-visible:ring-ring',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading = false, asChild = false, disabled, children, className, ...rest }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...rest}
      >
        {loading && <Spinner size="sm" label="Loading" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export default Button;
export { buttonVariants };
