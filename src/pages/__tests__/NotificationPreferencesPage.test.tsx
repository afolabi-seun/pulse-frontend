import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NotificationPreferencesPage from '../NotificationPreferencesPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import client from '../../api/client';

vi.mock('../../api/client', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

const prefs = [
  { kind: 'task_assigned', category: 'Tasks', label: 'Task assigned', description: 'A task was assigned to you', email: true, emailLocked: false, chat: true },
  { kind: 'mentioned', category: 'Collaboration', label: 'Mentioned', description: 'Someone mentioned you', email: false, emailLocked: false, chat: true },
  { kind: 'password_reset', category: 'Security', label: 'Password reset', description: 'A reset link', email: true, emailLocked: true, chat: true },
];

const chatSettings = (overrides: Record<string, unknown> = {}) => ({
  channel: 'none', slackAvailable: false, googleChatAvailable: false, googleChatLinked: false, ...overrides,
});

/** Answers GETs by URL: the page loads preferences and personal-chat settings in parallel. */
function serve(chat: Record<string, unknown> = {}) {
  vi.mocked(client.get).mockImplementation((url: string) => {
    if (url === '/notifications/preferences') return Promise.resolve({ data: prefs });
    if (url === '/notifications/chat') return Promise.resolve({ data: chatSettings(chat) });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe('NotificationPreferencesPage', () => {
  beforeEach(() => {
    vi.mocked(client.get).mockReset();
    vi.mocked(client.put).mockReset();
    serve();
  });

  // ── Email ──────────────────────────────────────────────────────────────

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

    fireEvent.click(await screen.findByLabelText('Email me: Task assigned'));

    expect(await screen.findByText('Could not update "Task assigned".')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Email me: Task assigned')).toBeChecked());
  });

  // ── Personal chat ──────────────────────────────────────────────────────

  it('personal chat is off by default, with unavailable channels disabled and explained', async () => {
    renderWithProviders(<NotificationPreferencesPage />);

    expect(await screen.findByLabelText('None')).toBeChecked();
    expect(screen.getByLabelText(/Slack/)).toBeDisabled();
    expect(screen.getByText("Your organization hasn't connected Slack yet.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Google Chat/)).toBeDisabled();
    expect(screen.queryByLabelText('Message me: Task assigned')).not.toBeInTheDocument();
  });

  it('tells someone to open a direct message with Pulse before choosing Google Chat', async () => {
    serve({ googleChatAvailable: true });
    renderWithProviders(<NotificationPreferencesPage />);

    expect(await screen.findByText('Open a direct message with Pulse in Google Chat first, then come back.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Google Chat/)).toBeDisabled();
  });

  it('choosing Slack saves the channel', async () => {
    serve({ slackAvailable: true });
    vi.mocked(client.put).mockResolvedValueOnce({ data: chatSettings({ channel: 'slack', slackAvailable: true }) });
    renderWithProviders(<NotificationPreferencesPage />);

    fireEvent.click(await screen.findByLabelText('Slack'));

    await waitFor(() => expect(client.put).toHaveBeenCalledWith('/notifications/chat', { channel: 'slack' }));
    expect(await screen.findByText('Personal chat messages turned on.')).toBeInTheDocument();
  });

  it('with a channel chosen, each kind gets a chat toggle that saves on its own', async () => {
    serve({ channel: 'slack', slackAvailable: true });
    vi.mocked(client.put).mockResolvedValueOnce({ data: { ...prefs[0], chat: false } });
    renderWithProviders(<NotificationPreferencesPage />);

    fireEvent.click(await screen.findByLabelText('Message me: Task assigned'));

    await waitFor(() => expect(client.put).toHaveBeenCalledWith('/notifications/preferences/task_assigned', { chat: false }));
  });

  // ── Summary and channel chips ──────────────────────────────────────────

  it('says how many kinds are emailed, and keeps the count current as they change', async () => {
    vi.mocked(client.put).mockReturnValueOnce(new Promise(() => {})); // never settles: the count moves on the click alone
    renderWithProviders(<NotificationPreferencesPage />);

    // Task assigned and the locked password reset are emailed; Mentioned is not. Chat is off, so it doesn't count.
    expect(await screen.findByTestId('preferences-summary')).toHaveTextContent('2 of 3 notifications are also emailed to you.');

    fireEvent.click(screen.getByLabelText('Email me: Task assigned'));

    await waitFor(() => expect(screen.getByTestId('preferences-summary')).toHaveTextContent('1 of 3'));
  });

  it('counts a kind that is only messaged once a chat channel is chosen, and names the channel on its chip', async () => {
    serve({ channel: 'google_chat', googleChatAvailable: true, googleChatLinked: true });
    renderWithProviders(<NotificationPreferencesPage />);

    // Mentioned has email off but chat on, so with a channel chosen all three reach the person outside the inbox.
    expect(await screen.findByTestId('preferences-summary')).toHaveTextContent('3 of 3 notifications also reach you by email or Google Chat.');
    expect(screen.getByLabelText('Message me: Mentioned').closest('label')).toHaveTextContent('Google Chat');
  });

  it('shows the inbox on every kind as a channel that is always on', async () => {
    renderWithProviders(<NotificationPreferencesPage />);

    await screen.findByText('Tasks');
    expect(screen.getAllByText('Inbox')).toHaveLength(3);
    expect(screen.queryByLabelText(/Message me/)).not.toBeInTheDocument();
  });
});
