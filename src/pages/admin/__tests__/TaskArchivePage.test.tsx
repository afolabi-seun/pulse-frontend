import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TaskArchivePage from '../TaskArchivePage';
import { renderWithProviders } from '../../../test/renderWithProviders';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('../../../api/projects', () => ({ useProjectList: () => ({ data: [] }) }));
vi.mock('../../../api/reports', () => ({
  useReportingBaseline: () => ({ data: null }),
  useSetReportingBaseline: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../../../api/taskArchive', () => ({
  useArchiveTasks: () => ({ mutate: mocks.mutate, isPending: false }),
  useArchivedTasks: () => ({ data: { items: [], total: 0 }, isLoading: false }),
  useRestoreArchivedTask: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('TaskArchivePage', () => {
  beforeEach(() => mocks.mutate.mockReset());

  async function preview() {
    renderWithProviders(<TaskArchivePage />);
    fireEvent.change(document.getElementById('archive-baseline')!, { target: { value: '2026-10-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    return mocks.mutate.mock.calls.at(-1)![0] as Record<string, unknown>;
  }

  it('previews without archiving finished tasks touched since, unless that option is chosen', async () => {
    const request = await preview();

    expect(request.includeFinishedTouched).toBe(false);
    expect(request.includeTouched).toBe(false);
    expect(request.dryRun).toBe(true);
  });

  it('can archive finished tasks touched since without including open ones', async () => {
    renderWithProviders(<TaskArchivePage />);
    fireEvent.change(document.getElementById('archive-baseline')!, { target: { value: '2026-10-01' } });
    await userEvent.click(document.getElementById('archive-include-finished-touched')!);

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const request = mocks.mutate.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(request.includeFinishedTouched).toBe(true);
    expect(request.includeTouched).toBe(false);
  });
});
