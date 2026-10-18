import { screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProgressControl from '../ProgressControl';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { TaskDto } from '../../../types/api';

const mutate = vi.hoisted(() => vi.fn());
vi.mock('../../../api/tasks', () => ({ useSetTaskProgress: () => ({ mutate, isPending: false }) }));

const task = (over: Partial<TaskDto> = {}): TaskDto => ({
  id: 't1', status: 'active', points: 8, progressPercent: 50, effectiveProgress: 50, earnedPoints: 4, progressFromChecklist: false, ...over,
} as TaskDto);

describe('ProgressControl', () => {
  beforeEach(() => mutate.mockClear());

  it('shows how far along the task is and the points earned', () => {
    renderWithProviders(<ProgressControl task={task()} canSet={false} />);

    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('4 of 8 pts earned')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Task progress' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('lets someone who can set it pick a step, and marks the current one', () => {
    renderWithProviders(<ProgressControl task={task()} canSet />);

    expect(screen.getByRole('button', { name: '50%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '25%' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '75%' }));

    expect(mutate).toHaveBeenCalledWith(75, expect.anything());
  });

  it('offers only the four steps, never 100', () => {
    renderWithProviders(<ProgressControl task={task()} canSet />);

    const labels = within(screen.getByRole('group', { name: 'Set progress' })).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['0%', '25%', '50%', '75%']);
  });

  it('shows no buttons to someone who cannot set it', () => {
    renderWithProviders(<ProgressControl task={task()} canSet={false} />);

    expect(screen.queryByRole('group', { name: 'Set progress' })).not.toBeInTheDocument();
  });

  it('follows the checklist when there is one, with no buttons', () => {
    renderWithProviders(<ProgressControl task={task({ progressFromChecklist: true, effectiveProgress: 25, earnedPoints: 2 })} canSet />);

    expect(screen.getByText('Follows the checklist')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Set progress' })).not.toBeInTheDocument();
  });

  it('says a task in QA counts as 90% and cannot be set by hand', () => {
    renderWithProviders(<ProgressControl task={task({ status: 'inQa', effectiveProgress: 90, earnedPoints: 7.2 })} canSet />);

    expect(screen.getByText(/In QA — counted as 90%/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Set progress' })).not.toBeInTheDocument();
  });

  it('shows a finished task as complete', () => {
    renderWithProviders(<ProgressControl task={task({ status: 'done', effectiveProgress: 100, earnedPoints: 8 })} canSet />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('shows nothing for work not started or without an estimate', () => {
    const { container, rerender } = renderWithProviders(<ProgressControl task={task({ status: 'backlog' })} canSet />);
    expect(container.querySelector('[data-testid="progress-control"]')).toBeNull();

    rerender(<ProgressControl task={task({ points: 0 })} canSet />);
    expect(container.querySelector('[data-testid="progress-control"]')).toBeNull();
  });
});
