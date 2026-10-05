import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {}

// A plain checkbox styled as a track+thumb via the peer-checked pattern — no Radix dependency
// needed for something this small. The thumb stays a fixed white regardless of theme (same as
// most design systems): it sits on a colored track, not on the page background, so it never
// needs its own dark: variant to stay legible.
const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => (
  <label className={cn('relative inline-flex h-5 w-9 shrink-0 items-center', props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
    <input type="checkbox" className="peer sr-only" ref={ref} {...props} />
    <span
      aria-hidden="true"
      className="absolute inset-0 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
    />
    <span
      aria-hidden="true"
      className="relative h-3.5 w-3.5 translate-x-1 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-[18px]"
    />
  </label>
));
Switch.displayName = 'Switch';

export { Switch };
