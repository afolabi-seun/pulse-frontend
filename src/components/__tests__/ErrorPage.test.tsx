import { screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRouteError } from 'react-router-dom';
import { RouteErrorBoundary, CHUNK_RELOAD_GUARD_KEY } from '../ErrorPage';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useRouteError: vi.fn() };
});

const mockUseRouteError = vi.mocked(useRouteError);

describe('RouteErrorBoundary — stale-chunk auto-reload', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });
  });

  afterEach(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
    vi.clearAllMocks();
  });

  it('reloads once and renders nothing for a stale dynamic-import error', () => {
    mockUseRouteError.mockReturnValue(new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/WikiIndexPage-abc123.js'));

    renderWithProviders(<RouteErrorBoundary />);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBe('1');
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('shows the normal error page instead of reloading again once the guard is already set', () => {
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1');
    mockUseRouteError.mockReturnValue(new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/WikiIndexPage-abc123.js'));

    renderWithProviders(<RouteErrorBoundary />);

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('does not auto-reload for an unrelated error', () => {
    mockUseRouteError.mockReturnValue(new Error('Something else broke'));

    renderWithProviders(<RouteErrorBoundary />);

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something else broke')).toBeInTheDocument();
  });
});
