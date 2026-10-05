import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useSmartBack } from '../../hooks/useSmartBack';

interface Crumb {
  label: string;
  href?: string;
  /** Use real back-navigation (preserving whatever filters/pagination the caller had) instead
   * of a fresh Link to a bare href — set on crumbs pointing back at a URL-stated list page. */
  smart?: boolean;
}

function SmartCrumb({ crumb }: { crumb: Crumb & { href: string } }) {
  const goBack = useSmartBack(crumb.href);
  return (
    <button type="button" onClick={goBack} className="hover:text-foreground transition-colors">
      {crumb.label}
    </button>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
}

export default function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-0.5 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 mx-0.5" />}
                {crumb.href
                  ? crumb.smart
                    ? <SmartCrumb crumb={crumb as Crumb & { href: string }} />
                    : <Link to={crumb.href} className="hover:text-foreground transition-colors">{crumb.label}</Link>
                  : <span>{crumb.label}</span>
                }
              </Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
