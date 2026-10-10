import { screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EscalationsPage from '../EscalationsPage';
import { renderWithProviders } from '../../test/renderWithProviders';

const mockEscalations = vi.hoisted(() => vi.fn());
vi.mock('../../api/escalations', () => ({ useEscalations: () => mockEscalations() }));
vi.mock('../../api/engineers', () => ({ useEngineerList: () => ({ data: [{ id: 'e1', name: 'Alice Smith' }] }) }));
vi.mock('../../components/tasks/TaskPreviewDrawer', () => ({ default: () => null }));

const esc = (taskId: string, level: string, daysUntilDue: number) => ({
  taskId, taskTitle: `Task ${taskId}`, assigneeId: 'e1', dueDate: '2026-10-09', level, daysUntilDue, projectName: 'Apollo', taskKey: null,
});

const serve = (items: ReturnType<typeof esc>[]) =>
  mockEscalations.mockReturnValue({ data: items, isLoading: false, error: null, refetch: vi.fn() });

const filters = () => within(screen.getByRole('group', { name: 'Filter by urgency' }));

describe('EscalationsPage', () => {
  beforeEach(() => serve([esc('a', 'Overdue', -2), esc('b', 'Overdue', -1), esc('c', 'TMinus1', 1), esc('d', 'TMinus3', 3)]));

  it('counts each urgency on a card and lists every group beneath', () => {
    renderWithProviders(<EscalationsPage />);

    expect(filters().getByRole('button', { name: /Overdue/ })).toHaveTextContent('2');
    expect(filters().getByRole('button', { name: /Due tomorrow/ })).toHaveTextContent('1');
    expect(filters().getByRole('button', { name: /Due in 3 days/ })).toHaveTextContent('1');
    ['Task a', 'Task b', 'Task c', 'Task d'].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
  });

  it('pressing a card shows only that group, and pressing it again shows them all', () => {
    renderWithProviders(<EscalationsPage />);
    const overdue = filters().getByRole('button', { name: /Overdue/ });

    fireEvent.click(overdue);

    expect(overdue).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Task a')).toBeInTheDocument();
    expect(screen.queryByText('Task c')).not.toBeInTheDocument();
    expect(screen.queryByText('Task d')).not.toBeInTheDocument();

    fireEvent.click(overdue);

    expect(overdue).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Task c')).toBeInTheDocument();
  });

  it('pressing another card switches the filter to it', () => {
    renderWithProviders(<EscalationsPage />);

    fireEvent.click(filters().getByRole('button', { name: /Overdue/ }));
    fireEvent.click(filters().getByRole('button', { name: /Due tomorrow/ }));

    expect(screen.getByText('Task c')).toBeInTheDocument();
    expect(screen.queryByText('Task a')).not.toBeInTheDocument();
    expect(filters().getByRole('button', { name: /Overdue/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens already filtered from a link that names a group', () => {
    renderWithProviders(<EscalationsPage />, { initialEntries: ['/escalations?level=three-days'] });

    expect(screen.getByText('Task d')).toBeInTheDocument();
    expect(screen.queryByText('Task a')).not.toBeInTheDocument();
  });

  it('a group with nothing in it is not a filter, and a link naming it shows everything', () => {
    serve([esc('a', 'Overdue', -2)]);

    renderWithProviders(<EscalationsPage />, { initialEntries: ['/escalations?level=tomorrow'] });

    expect(filters().queryByRole('button', { name: /Due tomorrow/ })).not.toBeInTheDocument();
    expect(filters().getByText('Due tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Task a')).toBeInTheDocument();
  });

  it('says everything is on track, with no filter cards, when there are no escalations', () => {
    serve([]);

    renderWithProviders(<EscalationsPage />);

    expect(screen.getByText('All tasks on track')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter by urgency' })).not.toBeInTheDocument();
  });
});
