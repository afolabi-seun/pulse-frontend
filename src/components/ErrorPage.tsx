import { useEffect } from 'react';
import { AlertTriangle, Home, Lock, RefreshCw, SearchX, ServerCrash, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ApiError } from '../lib/errors';

// A deploy replaced the app's chunk manifest after this tab already loaded its index.html —
// the browser tries to fetch a lazy-route chunk by its old (now-404ing) hashed filename. A
// full reload fetches the new manifest and self-heals; guarded via sessionStorage (cleared on
// every fresh boot in main.tsx) so a genuinely broken deploy/CDN outage doesn't reload forever.
export const CHUNK_RELOAD_GUARD_KEY = 'pulse-chunk-reload-attempted';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(message);
}

export interface ErrorDescription {
  icon: LucideIcon;
  title: string;
  message: string;
  /** HTTP-ish status to show as a large headline, when meaningful. */
  status?: number;
}

/**
 * Single source of truth for turning *any* thrown value into user-facing copy.
 * Handles axios `ApiError`s, react-router route errors, and plain JS errors.
 * Pure (no hooks) so it is safe to call from anywhere — including class error
 * boundaries rendered outside the Router/Query providers.
 */
export function describeError(error: unknown): ErrorDescription {
  if (error instanceof ApiError) {
    if (error.isForbidden())
      return {
        icon: Lock,
        title: 'Access restricted',
        status: 403,
        message: "You don't have permission to view this. Contact your administrator if you think this is a mistake.",
      };
    if (error.isNotFound())
      return {
        icon: SearchX,
        title: 'Not found',
        status: 404,
        message: 'The resource you are looking for could not be found.',
      };
    if (!error.status)
      return {
        icon: WifiOff,
        title: 'Connection lost',
        message: 'We could not reach the server. Check your connection and try again.',
      };
    if (error.isServer())
      return {
        icon: ServerCrash,
        title: 'Server error',
        status: error.status,
        message: 'Something went wrong on our end. Please try again in a moment.',
      };
    return { icon: AlertTriangle, title: 'Something went wrong', status: error.status, message: error.message };
  }

  if (isRouteErrorResponse(error)) {
    if (error.status === 404)
      return {
        icon: SearchX,
        title: 'Page not found',
        status: 404,
        message: "This page doesn't exist or you don't have access to it.",
      };
    return {
      icon: AlertTriangle,
      title: 'Something went wrong',
      status: error.status,
      message: error.statusText || 'An unexpected error occurred while loading this page.',
    };
  }

  if (error instanceof Error)
    return { icon: AlertTriangle, title: 'Something went wrong', message: error.message || 'An unexpected error occurred.' };

  return { icon: AlertTriangle, title: 'Something went wrong', message: 'An unexpected error occurred.' };
}

const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const secondaryBtn =
  'inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface ErrorPageProps {
  error?: unknown;
  /** Recovery callback. When provided the primary action is "Try again"; otherwise it is "Reload page". */
  onReset?: () => void;
  /** Render as a standalone full-viewport page (boundaries) vs. inside the app shell content area. */
  fullScreen?: boolean;
  /** Hide the "Dashboard" link (e.g. on the dashboard itself, or before authentication). */
  hideHome?: boolean;
}

/**
 * Generic, robust full-page error view used across every error scenario:
 * top-level render crashes (AppErrorBoundary), route/loader errors
 * (RouteErrorBoundary), and any page that wants a full-page failure state.
 * For inline per-widget failures, use `ErrorState` instead.
 */
export default function ErrorPage({ error, onReset, fullScreen = false, hideHome = false }: ErrorPageProps) {
  const { icon: Icon, title, message, status } = describeError(error);

  return (
    <main
      role="alert"
      className={
        fullScreen
          ? 'flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center'
          : 'flex min-h-[60vh] flex-col items-center justify-center p-8 text-center'
      }
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      {status !== undefined && <p className="text-4xl font-bold tracking-tight text-foreground">{status}</p>}
      <h1 className="mt-2 text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{message}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onReset ?? (() => window.location.reload())} className={primaryBtn}>
          <RefreshCw className="h-4 w-4" />
          {onReset ? 'Try again' : 'Reload page'}
        </button>
        {!hideHome && (
          <a href="/dashboard" className={secondaryBtn}>
            <Home className="h-4 w-4" />
            Dashboard
          </a>
        )}
      </div>

      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <pre className="mt-6 max-h-48 max-w-xl overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.stack}
        </pre>
      )}
    </main>
  );
}

/**
 * react-router `errorElement`. Reads the routing error and renders the shared
 * full-page error view. Reloading is the natural retry for a route-level failure.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const willAutoReload = isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY);

  useEffect(() => {
    if (!willAutoReload) return;
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1');
    window.location.reload();
  }, [willAutoReload]);

  // Avoid flashing "Something went wrong" for what's actually a transparent, near-instant
  // recovery — the reload above is already in flight.
  if (willAutoReload) return null;

  return <ErrorPage error={error} fullScreen />;
}
