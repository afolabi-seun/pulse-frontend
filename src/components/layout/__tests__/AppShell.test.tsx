import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import AppShell from '../AppShell';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useSignalR', () => ({ useSignalR: vi.fn() }));
vi.mock('../../../api/organization', () => ({ useApplyOrganizationBrand: vi.fn() }));
vi.mock('../Sidebar', () => ({ default: () => null }));
vi.mock('../Footer', () => ({ default: () => null }));
vi.mock('../../DemoBanner', () => ({ default: () => null }));
vi.mock('../../GuidedTour', () => ({ default: () => null }));
vi.mock('../../CommandPalette', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Search" /> : null),
}));

describe('AppShell', () => {
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
