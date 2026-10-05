import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CheckInPage from '../CheckInPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import * as checkInsApi from '../../api/checkIns';
import { todayIso } from '../../lib/dates';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ currentUser: { id: 'eng-1', name: 'Alice Smith' } }),
}));

vi.mock('../../api/projects', () => ({
  useMyProjects: () => ({ data: [], isLoading: false }),
}));

vi.mock('../../api/checkIns');

const mockMutate = vi.fn();

describe('CheckInPage', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    vi.mocked(checkInsApi.useSubmitCheckIn).mockReturnValue({
      mutate: mockMutate, isPending: false,
    } as any);

    vi.mocked(checkInsApi.useCheckInHistory).mockReturnValue({
      data: { items: [], nextCursor: null, hasMore: false },
      isLoading: false,
    } as any);
  });

  it('renders the check-in form when not yet checked in', () => {
    renderWithProviders(<CheckInPage />);
    expect(screen.getByText(/daily check-in/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/summarise what you finished/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/what do you plan to do/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit check-in/i })).toBeInTheDocument();
  });

  it('shows submitted check-in and keeps form open when today has a check-in', () => {
    const today = todayIso();
    vi.mocked(checkInsApi.useCheckInHistory).mockReturnValue({
      data: {
        items: [{ id: 'ci1', engineerId: 'eng-1', date: today, completed: 'Did X', plannedNext: 'Do Y', blockers: null, submittedAt: '', projectId: null }],
        nextCursor: null, hasMore: false,
      },
      isLoading: false,
    } as any);

    renderWithProviders(<CheckInPage />);
    expect(screen.getByText(/submitted today/i)).toBeInTheDocument();
    expect(screen.getByText('Did X')).toBeInTheDocument();
    // Form remains so engineers can submit for another project
    expect(screen.getByRole('button', { name: /submit check-in/i })).toBeInTheDocument();
  });

  it('validates required fields and does not submit when empty', async () => {
    renderWithProviders(<CheckInPage />);
    fireEvent.click(screen.getByRole('button', { name: /submit check-in/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/required/i).length).toBeGreaterThanOrEqual(2);
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('submits form with entered values', async () => {
    renderWithProviders(<CheckInPage />);
    fireEvent.change(screen.getByPlaceholderText(/summarise what you finished/i), { target: { value: 'Finished feature A' } });
    fireEvent.change(screen.getByPlaceholderText(/what do you plan to do/i), { target: { value: 'Start feature B' } });
    fireEvent.click(screen.getByRole('button', { name: /submit check-in/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ completed: 'Finished feature A', plannedNext: 'Start feature B' }),
        expect.any(Object),
      );
    });
  });

  it('keeps the blockers box folded away until asked for', async () => {
    renderWithProviders(<CheckInPage />);

    expect(screen.queryByPlaceholderText(/preventing you from making progress/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add a blocker/i }));
    expect(screen.getByPlaceholderText(/preventing you from making progress/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add a blocker/i })).not.toBeInTheDocument();
  });

  it('sends the blocker only when one was added', async () => {
    renderWithProviders(<CheckInPage />);
    fireEvent.change(screen.getByPlaceholderText(/summarise what you finished/i), { target: { value: 'Done A' } });
    fireEvent.change(screen.getByPlaceholderText(/what do you plan to do/i), { target: { value: 'Do B' } });
    fireEvent.click(screen.getByRole('button', { name: /add a blocker/i }));
    fireEvent.change(screen.getByPlaceholderText(/preventing you from making progress/i), { target: { value: 'Waiting on access' } });
    fireEvent.click(screen.getByRole('button', { name: /submit check-in/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ blockers: 'Waiting on access' });
  });

  it('lists today\'s check-ins one per line with a preview and a blocker flag, opening to the full text', () => {
    const today = todayIso();
    vi.mocked(checkInsApi.useCheckInHistory).mockReturnValue({
      data: {
        items: [{ id: 'ci1', engineerId: 'eng-1', date: today, completed: 'Shipped the export', plannedNext: 'Start the import', blockers: 'Need API keys', submittedAt: '', projectId: null }],
        nextCursor: null, hasMore: false,
      },
      isLoading: false,
    } as any);

    renderWithProviders(<CheckInPage />);

    expect(screen.getByText('Shipped the export')).toBeInTheDocument();          // the preview
    expect(screen.getByText('Blocker')).toBeInTheDocument();
    expect(screen.queryByText('Start the import')).not.toBeInTheDocument();      // folded away

    fireEvent.click(screen.getByRole('button', { name: /General check-in — show details/i }));

    expect(screen.getByText('Start the import')).toBeInTheDocument();
    expect(screen.getByText('Need API keys')).toBeInTheDocument();
  });

  it('opens the blockers box when editing a check-in that has one', () => {
    const today = todayIso();
    vi.mocked(checkInsApi.useCheckInHistory).mockReturnValue({
      data: {
        items: [{ id: 'ci1', engineerId: 'eng-1', date: today, completed: 'A', plannedNext: 'B', blockers: 'Stuck on review', submittedAt: '', projectId: null }],
        nextCursor: null, hasMore: false,
      },
      isLoading: false,
    } as any);

    renderWithProviders(<CheckInPage />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByPlaceholderText(/preventing you from making progress/i)).toHaveValue('Stuck on review');
  });
});
