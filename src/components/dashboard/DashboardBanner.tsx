import { organizationDisplayName, useCurrentOrganization } from '../../api/organization';
import { cn } from '@/lib/utils';

export interface BannerHeadline {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  /** Colours the value red when it's something to act on. */
  tone?: 'bad';
}

interface DashboardBannerProps {
  title: string;
  description?: string;
  /** The one number worth leading with, shown on the right. */
  headline?: BannerHeadline;
}

/**
 * The dashboard's header: whose organization this is, the greeting, and one headline number. Takes the sidebar's
 * dark surface in both themes so it reads as part of the app's frame. The number stays white rather than taking the
 * organization's accent, which may be too dark to read on it.
 */
export default function DashboardBanner({ title, description, headline }: DashboardBannerProps) {
  const { data: organization } = useCurrentOrganization();
  const organizationName = organizationDisplayName(organization);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl bg-sidebar px-5 py-4 text-sidebar-foreground">
      <div className="min-w-0">
        {organizationName && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground" data-testid="banner-organization">
            {organizationName}
          </p>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-sidebar-muted-foreground">{description}</p>}
      </div>

      {headline && (
        <div className="sm:text-right" data-testid="banner-headline">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">{headline.label}</p>
          <p className={cn(
            'flex items-baseline gap-1 font-mono text-2xl font-bold tabular-nums tracking-tight sm:justify-end',
            headline.tone === 'bad' && 'text-red-400',
          )}>
            {headline.value}
            {headline.unit && <span className="font-sans text-sm font-medium tracking-normal text-sidebar-muted-foreground">{headline.unit}</span>}
          </p>
          {headline.sub && <p className="text-xs text-sidebar-muted-foreground">{headline.sub}</p>}
        </div>
      )}
    </div>
  );
}
