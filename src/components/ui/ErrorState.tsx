import { describeError } from '../ErrorPage';

interface ErrorStateProps {
  error?: unknown;
  /** Override the derived message (e.g. a widget-specific hint). */
  message?: string;
  onRetry?: () => void;
}

/**
 * Compact inline error state for a single widget/section that failed while the
 * rest of the page still works. For a full-page failure use `ErrorPage`.
 * Shares `describeError` with `ErrorPage` so copy and icons stay consistent.
 */
export default function ErrorState({ error, message, onRetry }: ErrorStateProps) {
  const desc = describeError(error);
  const Icon = desc.icon;
  // A forbidden/not-found state is terminal — retrying won't help, so suppress the button.
  const showRetry = onRetry && desc.status !== 403 && desc.status !== 404;

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{desc.title}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{message ?? desc.message}</p>
      </div>
      {showRetry && (
        <button
          onClick={onRetry}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      )}
    </div>
  );
}
