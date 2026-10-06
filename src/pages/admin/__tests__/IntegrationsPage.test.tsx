import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import IntegrationsPage from '../IntegrationsPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

type Responses = { slack?: Record<string, unknown>; googleChat?: Record<string, unknown>; installUrl?: string };

/** Answers GETs by URL, so the page's Slack and Google Chat queries can resolve in any order. */
function serve({ slack = {}, googleChat = {}, installUrl }: Responses) {
  vi.mocked(client.get).mockImplementation((url: string) => {
    if (url === '/integrations/slack')
      return Promise.resolve({ data: { available: true, connected: false, teamName: null, connectedAt: null, ...slack } });
    if (url === '/integrations/google-chat') return Promise.resolve({ data: { available: true, spaces: [], ...googleChat } });
    if (url === '/integrations/slack/install-url') return Promise.resolve({ data: installUrl });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe('IntegrationsPage', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.mocked(client.get).mockReset();
    vi.mocked(client.post).mockReset();
    vi.mocked(client.delete).mockReset();
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => vi.unstubAllGlobals());

  // ── Slack ──────────────────────────────────────────────────────────────

  it("says so when Slack isn't set up on the server, with no connect button", async () => {
    serve({ slack: { available: false } });

    renderWithProviders(<IntegrationsPage />);

    expect(await screen.findByText(/Slack isn't set up on this Pulse server/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Slack' })).not.toBeInTheDocument();
  });

  it('connecting sends the browser to the Slack install URL', async () => {
    serve({ installUrl: 'https://slack.com/oauth/v2/authorize?state=abc' });

    renderWithProviders(<IntegrationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Slack' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?state=abc'));
  });

  it('shows the connected workspace and can disconnect it', async () => {
    serve({ slack: { connected: true, teamName: 'Acme Slack', connectedAt: '2026-10-06T08:00:00Z' } });
    vi.mocked(client.delete).mockResolvedValueOnce({ data: true });

    renderWithProviders(<IntegrationsPage />);

    expect(await screen.findByText(/go to Acme Slack/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(client.delete).toHaveBeenCalledWith('/integrations/slack'));
    expect(await screen.findByText('Slack disconnected.')).toBeInTheDocument();
  });

  it('reports why a Slack install came back unsuccessful', async () => {
    serve({});

    renderWithProviders(<IntegrationsPage />, { initialEntries: ['/admin/integrations?slack=error&reason=workspace_taken'] });

    expect(await screen.findByText('That Slack workspace is already connected to another organization.')).toBeInTheDocument();
  });

  it('confirms a successful Slack install', async () => {
    serve({ slack: { connected: true, teamName: 'Acme Slack' } });

    renderWithProviders(<IntegrationsPage />, { initialEntries: ['/admin/integrations?slack=connected'] });

    expect(await screen.findByText('Slack connected.')).toBeInTheDocument();
  });

  // ── Google Chat ────────────────────────────────────────────────────────

  it("says so when Google Chat isn't set up on the server", async () => {
    serve({ googleChat: { available: false } });

    renderWithProviders(<IntegrationsPage />);

    expect(await screen.findByText(/Google Chat isn't set up on this Pulse server/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link a space' })).not.toBeInTheDocument();
  });

  it('linking a space shows the one-time command to send in Chat', async () => {
    serve({});
    vi.mocked(client.post).mockResolvedValueOnce({
      data: { code: 'ABCD-2345', expiresAt: '2026-10-06T09:00:00Z', command: '@Pulse link ABCD-2345' },
    });

    renderWithProviders(<IntegrationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Link a space' }));

    expect(await screen.findByTestId('link-command')).toHaveTextContent('@Pulse link ABCD-2345');
    expect(client.post).toHaveBeenCalledWith('/integrations/google-chat/link-codes');
  });

  it('lists linked spaces and can unlink one', async () => {
    serve({ googleChat: { spaces: [{ id: 's1', spaceId: 'spaces/AAA', displayName: 'Team alerts' }] } });
    vi.mocked(client.delete).mockResolvedValueOnce({ data: true });

    renderWithProviders(<IntegrationsPage />);

    expect(await screen.findByText('Team alerts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));

    await waitFor(() => expect(client.delete).toHaveBeenCalledWith('/integrations/google-chat/spaces/s1'));
    expect(await screen.findByText('Unlinked Team alerts.')).toBeInTheDocument();
  });
});
