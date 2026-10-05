import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FeedbackSubmitPage from '../feedback/FeedbackSubmitPage';
import { renderWithProviders } from '../../test/renderWithProviders';

const mockMutate = vi.fn();
vi.mock('../../api/feedback', () => ({
  useSubmitFeedback: () => ({ mutate: mockMutate, isPending: false }),
}));

describe('FeedbackSubmitPage', () => {
  beforeEach(() => mockMutate.mockReset());

  it('renders form and privacy notice', () => {
    renderWithProviders(<FeedbackSubmitPage />);
    expect(screen.getByText(/privacy notice/i)).toBeInTheDocument();
    expect(screen.getByText(/department heads/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument();
  });

  it('shows validation error when submitted empty', async () => {
    renderWithProviders(<FeedbackSubmitPage />);
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(screen.getByText(/feedback text is required/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls mutate with feedback text', async () => {
    renderWithProviders(<FeedbackSubmitPage />);
    fireEvent.change(screen.getByPlaceholderText(/share anything on your mind/i), {
      target: { value: 'The sprint planning process could be smoother.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { text: 'The sprint planning process could be smoother.' },
        expect.any(Object),
      );
    });
  });
});
