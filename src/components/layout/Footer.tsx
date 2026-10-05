import pkg from '../../../package.json';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

export default function Footer({ className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn('pb-4 pt-4', className)}>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-muted-foreground">
        <span>© {year} Pulse · v{pkg.version}</span>
      </div>
    </footer>
  );
}
