import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WikiContent from '../WikiContent';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { WikiPageSummaryDto, WikiIndexEntryDto } from '../../../types/api';

const { mockUseAllWikiPages } = vi.hoisted(() => ({ mockUseAllWikiPages: vi.fn() }));
vi.mock('../../../api/wiki', () => ({ useAllWikiPages: mockUseAllWikiPages }));

const projectPages: WikiPageSummaryDto[] = [
  { id: 'page-api-standards', title: 'API Standards', createdAt: '2026-01-01', updatedAt: null },
];

const globalPages: WikiIndexEntryDto[] = [
  {
    pageId: 'page-onboarding',
    pageTitle: 'Onboarding Guide',
    projectId: 'project-other',
    projectName: 'Other Project',
    createdAt: '2026-01-01',
    updatedAt: null,
  },
];

describe('WikiContent — internal wiki link resolution', () => {
  beforeEach(() => {
    mockUseAllWikiPages.mockReturnValue({ data: globalPages });
  });

  it('resolves a relative .md link against the current project\'s own pages', () => {
    renderWithProviders(
      <WikiContent
        content="See [API Standards](./api_standards.md) for details."
        projectId="project-mine"
        currentProjectPages={projectPages}
      />,
    );

    const link = screen.getByRole('link', { name: 'API Standards' });
    expect(link).toHaveAttribute('href', '/projects/project-mine?wiki=page-api-standards');
  });

  it('falls back to the org-wide index for a page in another project', () => {
    renderWithProviders(
      <WikiContent
        content="See [Onboarding Guide](./onboarding-guide.md)."
        projectId="project-mine"
        currentProjectPages={projectPages}
      />,
    );

    const link = screen.getByRole('link', { name: 'Onboarding Guide' });
    expect(link).toHaveAttribute('href', '/wiki/project-other/page-onboarding');
  });

  it('flags an unresolved wiki-shaped link instead of leaving it as a dead relative URL', async () => {
    renderWithProviders(
      <WikiContent
        content="See [Missing Page](./nonexistent.md)."
        projectId="project-mine"
        currentProjectPages={projectPages}
      />,
    );

    const link = screen.getByRole('link', { name: 'Missing Page' });
    expect(link).toHaveAttribute('title', expect.stringContaining('No wiki page found'));

    const user = userEvent.setup();
    await user.click(link);
    expect(window.location.pathname).toBe('/');
  });

  it('resolves a relative link that also carries a heading anchor, e.g. "./page.md#some-heading"', () => {
    renderWithProviders(
      <WikiContent
        content="See [API Standards → Envelope](./api_standards.md#response-envelope) for details."
        projectId="project-mine"
        currentProjectPages={projectPages}
      />,
    );

    const link = screen.getByRole('link', { name: 'API Standards → Envelope' });
    expect(link).toHaveAttribute('href', '/projects/project-mine?wiki=page-api-standards#response-envelope');
  });

  it('leaves absolute URLs untouched', () => {
    renderWithProviders(
      <WikiContent
        content="[External](https://example.com)"
        projectId="project-mine"
        currentProjectPages={projectPages}
      />,
    );

    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute('target', '_blank');
  });

  it('generates a GitHub-style id on headings so a table-of-contents anchor has something to jump to', () => {
    renderWithProviders(
      <WikiContent
        content="## Error Code Registry & Resolution"
        projectId="project-mine"
        currentProjectPages={projectPages}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Error Code Registry & Resolution' }))
      .toHaveAttribute('id', 'error-code-registry--resolution');
  });

  it('scrolls an in-page anchor link to its heading instead of opening it as an external link', async () => {
    renderWithProviders(
      <WikiContent
        content={'## Section One\n\n[Jump to Section One](#section-one)'}
        projectId="project-mine"
        currentProjectPages={projectPages}
      />,
    );

    const link = screen.getByRole('link', { name: 'Jump to Section One' });
    expect(link).toHaveAttribute('href', '#section-one');
    expect(link).not.toHaveAttribute('target', '_blank');

    const heading = screen.getByRole('heading', { name: 'Section One' });
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;

    const user = userEvent.setup();
    await user.click(link);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});
