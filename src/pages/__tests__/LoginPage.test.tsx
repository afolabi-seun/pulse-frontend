import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginPage from '../LoginPage';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ currentUser: null, login: vi.fn() }),
}));

const mockMutate = vi.fn();
vi.mock('../../api/auth', () => ({
  useLogin: () => ({ mutate: mockMutate, isPending: false }),
}));

describe('LoginPage', () => {
  beforeEach(() => mockMutate.mockReset());

  it('renders the sign-in form', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitted empty', async () => {
    renderWithProviders(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls login mutate with entered credentials', async () => {
    renderWithProviders(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@pulse.io' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { email: 'alice@pulse.io', password: 'secret' },
        expect.any(Object),
      );
    });
  });

  it('shows error alert when onError sets root error', async () => {
    mockMutate.mockImplementation((_vals: unknown, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error('Invalid email or password.'));
    });

    renderWithProviders(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@pulse.io' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
