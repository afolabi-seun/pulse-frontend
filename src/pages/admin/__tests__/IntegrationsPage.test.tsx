import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import IntegrationsPage from '../IntegrationsPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));

const slack = (overrides: Record<string, unknown> = {}) => ({
  data: { available: true, connected: false, teamName: null, connectedAt: null, ...overrides },
});

describe('IntegrationsPage', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.mocked(client.get).mockReset();
    vi.mocked(client.delete).mockReset();
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("says so when Slack isn't set up on the server, with no connect button", async () => {
    vi.mocked(client.get).mockResolvedValueOnce(slack({ available: false }));

    renderWithProviders(<IntegrationsPage />);

    expect(await screen.findByText(/isn't set up on this Pulse server/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Slack' })).not.toBeInTheDocument();
  });

  it('connecting sends the browser to the Slack install URL', async () => {
    vi.mocked(client.get)
      .mockResolvedValueOnce(slack())
      .mockResolvedValueOnce({ data: 'https://slack.com/oauth/v2/authorize?state=abc' });

    renderWithProviders(<IntegrationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Slack' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?state=abc'));
    expect(client.get).toHaveBeenLastCalledWith('/integrations/slack/install-url');
  });

  it('shows the connected workspace and can disconnect it', async () => {
    vi.mocked(client.get)
      .mockResolvedValueOnce(slack({ connected: true, teamName: 'Acme Slack', connectedAt: '2026-10-06T08:00:00Z' }))
      .mockResolvedValue(slack());
    vi.mocked(client.delete).mockResolvedValueOnce({ data: true });

    renderWithProviders(<IntegrationsPage />);

    expect(await screen.findByText(/go to Acme Slack/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(client.delete).toHaveBeenCalledWith('/integrations/slack'));
    expect(await screen.findByText('Slack disconnected.')).toBeInTheDocument();
  });

  it('reports why an install came back unsuccessful', async () => {
    vi.mocked(client.get).mockResolvedValueOnce(slack());

    renderWithProviders(<IntegrationsPage />, { initialEntries: ['/admin/integrations?slack=error&reason=workspace_taken'] });

    expect(await screen.findByText('That Slack workspace is already connected to another organization.')).toBeInTheDocument();
  });

  it('confirms a successful install', async () => {
    vi.mocked(client.get).mockResolvedValueOnce(slack({ connected: true, teamName: 'Acme Slack' }));

    renderWithProviders(<IntegrationsPage />, { initialEntries: ['/admin/integrations?slack=connected'] });

    expect(await screen.findByText('Slack connected.')).toBeInTheDocument();
  });
});
