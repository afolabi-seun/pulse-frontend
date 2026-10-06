import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NotificationPreferencesPage from '../NotificationPreferencesPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import client from '../../api/client';

vi.mock('../../api/client', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

const prefs = [
  { kind: 'task_assigned', category: 'Tasks', label: 'Task assigned', description: 'A task was assigned to you', email: true, emailLocked: false },
  { kind: 'mentioned', category: 'Collaboration', label: 'Mentioned', description: 'Someone mentioned you', email: false, emailLocked: false },
  { kind: 'password_reset', category: 'Security', label: 'Password reset', description: 'A reset link', email: true, emailLocked: true },
];

describe('NotificationPreferencesPage', () => {
  beforeEach(() => {
    vi.mocked(client.get).mockReset();
    vi.mocked(client.put).mockReset();
    vi.mocked(client.get).mockResolvedValue({ data: prefs });
  });

  it('shows each kind under its category with its current email setting', async () => {
    renderWithProviders(<NotificationPreferencesPage />);

    expect(await screen.findByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Collaboration')).toBeInTheDocument();
    expect(screen.getByLabelText('Email me: Task assigned')).toBeChecked();
    expect(screen.getByLabelText('Email me: Mentioned')).not.toBeChecked();
  });

  it('switching email off saves it', async () => {
    vi.mocked(client.put).mockResolvedValueOnce({ data: { ...prefs[0], email: false } });
    renderWithProviders(<NotificationPreferencesPage />);

    fireEvent.click(await screen.findByLabelText('Email me: Task assigned'));

    await waitFor(() => expect(client.put).toHaveBeenCalledWith('/notifications/preferences/task_assigned', { email: false }));
  });

  it('security notices are always emailed and cannot be switched off', async () => {
    renderWithProviders(<NotificationPreferencesPage />);

    const toggle = await screen.findByLabelText('Email me: Password reset');
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    expect(screen.getByText('Always emailed')).toBeInTheDocument();
  });

  it('a failed save puts the toggle back and says so', async () => {
    vi.mocked(client.put).mockRejectedValueOnce(new Error('offline'));
    renderWithProviders(<NotificationPreferencesPage />);

    const toggle = await screen.findByLabelText('Email me: Task assigned');
    fireEvent.click(toggle);

    expect(await screen.findByText('Could not update "Task assigned".')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Email me: Task assigned')).toBeChecked());
  });
});
