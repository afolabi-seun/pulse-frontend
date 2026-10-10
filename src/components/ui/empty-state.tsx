import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** `sm` for an empty panel or card inside a page; the default is for a page's whole list being empty. */
  size?: 'sm' | 'md';
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, size = 'md', className }: EmptyStateProps) {
  const small = size === 'sm';
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', small ? 'px-4 py-8' : 'py-16', className)}>
      <div className={cn('flex items-center justify-center rounded-full bg-muted', small ? 'mb-2.5 h-10 w-10' : 'mb-4 h-14 w-14')}>
        <Icon className={cn('text-muted-foreground', small ? 'h-4 w-4' : 'h-6 w-6')} strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
