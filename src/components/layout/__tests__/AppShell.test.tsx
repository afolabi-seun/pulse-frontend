import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AppShell from '../AppShell';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useSignalR', () => ({ useSignalR: vi.fn() }));
const mockLogo = vi.hoisted(() => vi.fn<() => string | undefined>());
vi.mock('../../../api/organization', () => ({ useApplyOrganizationBrand: vi.fn(), useOrganizationLogo: () => mockLogo() }));
vi.mock('../Sidebar', () => ({ default: () => null }));
vi.mock('../Footer', () => ({ default: () => null }));
vi.mock('../../DemoBanner', () => ({ default: () => null }));
vi.mock('../../GuidedTour', () => ({ default: () => null }));
vi.mock('../../CommandPalette', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Search" /> : null),
}));

describe('AppShell', () => {
  beforeEach(() => mockLogo.mockReturnValue(undefined));

  it("shows the organization's logo in the top bar in place of the Pulse mark", () => {
    const { container, unmount } = renderWithProviders(<AppShell />);
    expect(screen.getByTestId('pulse-mark')).toBeInTheDocument();
    expect(container.querySelector('header img')).toBeNull();
    unmount();

    mockLogo.mockReturnValue('blob:logo');
    const branded = renderWithProviders(<AppShell />);

    expect(branded.container.querySelector('header img')).toHaveAttribute('src', 'blob:logo');
    expect(screen.queryByTestId('pulse-mark')).not.toBeInTheDocument();
  });

  it("opens search from the top bar's button, for phones where the sidebar's is behind the menu", () => {
    renderWithProviders(<AppShell />);
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
  });

  it('opens and closes search with Ctrl+K or ⌘K', () => {
    renderWithProviders(<AppShell />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();
  });
});
