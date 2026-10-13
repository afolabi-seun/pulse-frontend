import { screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WikiIndexPage from '../WikiIndexPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { WikiIndexEntryDto } from '../../../types/api';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));

const entry = (over: Partial<WikiIndexEntryDto> & { pageId: string; pageTitle: string; projectId: string; projectName: string }): WikiIndexEntryDto =>
  ({ createdAt: '2026-09-01T00:00:00Z', updatedAt: null, ...over });

let pages: WikiIndexEntryDto[] = [];
vi.mock('../../../api/wiki', () => ({
  useAllWikiPages: () => ({ data: pages, isLoading: false }),
  downloadWikiPagePdf: vi.fn(),
}));

const listView = () => localStorage.setItem('wiki.view', 'list');

describe('WikiIndexPage', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); navigate.mockClear(); });

  it('lists every project\'s pages in one list, newest first, and opens a page in the standalone viewer', () => {
    pages = [
      entry({ pageId: 'p1', pageTitle: 'Old runbook', projectId: 'a', projectName: 'Alpha', updatedAt: '2026-09-02T00:00:00Z' }),
      entry({ pageId: 'p2', pageTitle: 'Fresh guide', projectId: 'b', projectName: 'Beta', updatedAt: '2026-10-01T00:00:00Z' }),
    ];
    listView();
    renderWithProviders(<WikiIndexPage />);

    const titles = screen.getAllByText(/Old runbook|Fresh guide/).map((n) => n.textContent);
    expect(titles).toEqual(['Fresh guide', 'Old runbook']);
    const freshRow = screen.getByText('Fresh guide').closest('div.flex') as HTMLElement;
    expect(within(freshRow).getByText('Beta')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fresh guide'));
    expect(navigate).toHaveBeenCalledWith('/wiki/b/p2');
  });

  it('filters by project and by search text', () => {
    pages = [
      entry({ pageId: 'p1', pageTitle: 'Onboarding', projectId: 'a', projectName: 'Alpha' }),
      entry({ pageId: 'p2', pageTitle: 'Deploy steps', projectId: 'b', projectName: 'Beta' }),
    ];
    renderWithProviders(<WikiIndexPage />);

    // The project filter is a type-to-search box: focus it, type part of a name, pick the match.
    const projectFilter = screen.getByDisplayValue('All projects');
    fireEvent.focus(projectFilter);
    fireEvent.change(projectFilter, { target: { value: 'bet' } });
    expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Beta' }));
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
    expect(screen.getByText('Deploy steps')).toBeInTheDocument();

    fireEvent.focus(screen.getByDisplayValue('Beta'));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'All projects' }));
    fireEvent.change(screen.getByLabelText('Search pages or projects'), { target: { value: 'onboard' } });
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.queryByText('Deploy steps')).not.toBeInTheDocument();
  });

  it('marks a members-only page with a lock and pages the list at 25', () => {
    pages = Array.from({ length: 30 }, (_, i) =>
      entry({ pageId: `p${i}`, pageTitle: `Page ${String(i).padStart(2, '0')}`, projectId: 'a', projectName: 'Alpha',
        updatedAt: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`, restrictedToMembers: i === 29 }));
    listView();
    renderWithProviders(<WikiIndexPage />);

    expect(screen.getAllByText(/^Page \d{2}$/).length).toBe(25);
    expect(screen.getAllByLabelText('Project members only')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getAllByText(/^Page \d{2}$/).length).toBe(5);
  });

  describe('grouped by project (the default)', () => {
    const threeProjects = () => {
      pages = [
        entry({ pageId: 'a1', pageTitle: 'Alpha one', projectId: 'a', projectName: 'Alpha' }),
        entry({ pageId: 'a2', pageTitle: 'Alpha two', projectId: 'a', projectName: 'Alpha' }),
        entry({ pageId: 'b1', pageTitle: 'Beta one',  projectId: 'b', projectName: 'Beta' }),
      ];
    };

    it('shows each project once, with its pages under it, instead of repeating the name on every row', () => {
      threeProjects();
      renderWithProviders(<WikiIndexPage />);

      expect(screen.getByRole('button', { name: 'Alpha, 2 pages' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'Beta, 1 page' })).toBeInTheDocument();
      expect(screen.getByText('Alpha one')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Project/ })).not.toBeInTheDocument();
    });

    it('folds and unfolds a project, and remembers it', () => {
      threeProjects();
      const { unmount } = renderWithProviders(<WikiIndexPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Alpha, 2 pages' }));
      expect(screen.queryByText('Alpha one')).not.toBeInTheDocument();
      expect(screen.getByText('Beta one')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Alpha, 2 pages' })).toHaveAttribute('aria-expanded', 'false');

      unmount();
      renderWithProviders(<WikiIndexPage />);
      expect(screen.queryByText('Alpha one')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Alpha, 2 pages' }));
      expect(screen.getByText('Alpha one')).toBeInTheDocument();
    });

    it('folds and unfolds every project at once', () => {
      threeProjects();
      renderWithProviders(<WikiIndexPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Fold all' }));
      expect(screen.queryByText('Alpha one')).not.toBeInTheDocument();
      expect(screen.queryByText('Beta one')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Unfold all' }));
      expect(screen.getByText('Alpha one')).toBeInTheDocument();
      expect(screen.getByText('Beta one')).toBeInTheDocument();
    });

    it('never hides a search match behind a folded project', () => {
      threeProjects();
      renderWithProviders(<WikiIndexPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Alpha, 2 pages' }));

      fireEvent.change(screen.getByLabelText('Search pages or projects'), { target: { value: 'alpha' } });
      expect(screen.getByText('Alpha one')).toBeInTheDocument();
    });

    it('opens a page from under its project', () => {
      threeProjects();
      renderWithProviders(<WikiIndexPage />);

      fireEvent.click(screen.getByText('Beta one'));
      expect(navigate).toHaveBeenCalledWith('/wiki/b/b1');
    });
  });

  it('lets a long title wrap onto the next line instead of cutting it off', () => {
    const long = 'Escalation grace period after QA rejection + backend-flagged auto-routing';
    pages = [entry({ pageId: 'p1', pageTitle: long, projectId: 'a', projectName: 'Alpha' })];
    renderWithProviders(<WikiIndexPage />);

    const title = screen.getByText(long);
    expect(title.className).toContain('break-words');
    expect(title.className).not.toContain('truncate');
  });

  // ── Page types ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

  const typed = () => [
    entry({ pageId: 't1', pageTitle: 'Service map', projectId: 'a', projectName: 'Alpha', category: 'architecture' }),
    entry({ pageId: 't2', pageTitle: 'Local setup', projectId: 'b', projectName: 'Beta', category: 'development' }),
    entry({ pageId: 't3', pageTitle: 'Release plan', projectId: 'a', projectName: 'Alpha', category: 'pmo' }),
    entry({ pageId: 't4', pageTitle: 'Old notes', projectId: 'b', projectName: 'Beta' }),   // no type: General
  ];

  it('groups by type in the types\' own order, with General last, naming each page\'s project', () => {
    pages = typed();
    localStorage.setItem('wiki.view', 'type');
    renderWithProviders(<WikiIndexPage />);

    const headings = screen.getAllByRole('button', { name: /\d pages?$/ }).map((b) => b.getAttribute('aria-label'));
    expect(headings).toEqual(['Development, 1 page', 'Architecture, 1 page', 'PMO, 1 page', 'General, 1 page']);
    expect(screen.getByText('Local setup')).toBeInTheDocument();
    // Grouped by type, the project is a column on each row (the heading no longer says it).
    const row = screen.getByText('Local setup').closest('div.cursor-pointer')! as HTMLElement;
    expect(within(row).getByText('Beta')).toBeInTheDocument();
  });

  it('shows a type badge on each page when grouped by project, and treats a page with no type as General', () => {
    pages = typed();
    renderWithProviders(<WikiIndexPage />);

    const old = screen.getByText('Old notes').closest('div.cursor-pointer')! as HTMLElement;
    expect(within(old).getByText('General')).toBeInTheDocument();
    expect(within(screen.getByText('Service map').closest('div.cursor-pointer')! as HTMLElement).getByText('Architecture')).toBeInTheDocument();
  });

  it('filters by type', () => {
    pages = typed();
    listView();
    renderWithProviders(<WikiIndexPage />);

    const typeFilter = screen.getByPlaceholderText('Type…');
    fireEvent.focus(typeFilter);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Architecture (1)' }));

    expect(screen.getByText('Service map')).toBeInTheDocument();
    expect(screen.queryByText('Local setup')).not.toBeInTheDocument();
    expect(screen.queryByText('Old notes')).not.toBeInTheDocument();
  });

  it('does not offer a type filter when every page is the same type', () => {
    pages = [entry({ pageId: 'g1', pageTitle: 'Only one kind', projectId: 'a', projectName: 'Alpha' })];
    renderWithProviders(<WikiIndexPage />);

    expect(screen.queryByPlaceholderText('Type…')).not.toBeInTheDocument();
  });
});
