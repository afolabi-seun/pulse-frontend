import { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OrganizationName from '../OrganizationName';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({ default: { get: vi.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe('OrganizationName', () => {
  beforeEach(() => vi.mocked(client.get).mockReset());

  it("shows the user's organization", async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: { id: 'o1', name: 'Acme Corp', slug: 'acme' } });

    render(<OrganizationName />, { wrapper });

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledWith('/organization');
  });

  it('shows nothing for the default organization, whose name is a placeholder', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: { id: 'o0', name: 'Default organization', slug: 'default' } });

    render(<OrganizationName />, { wrapper });

    await waitFor(() => expect(client.get).toHaveBeenCalled());
    expect(screen.queryByTestId('organization-name')).not.toBeInTheDocument();
  });

  it('shows the default organization once its head has named it', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: { id: 'o0', name: 'Acme Engineering', slug: 'default' } });

    render(<OrganizationName />, { wrapper });

    expect(await screen.findByText('Acme Engineering')).toBeInTheDocument();
  });

  it('shows nothing if the organization cannot be loaded', async () => {
    vi.mocked(client.get).mockRejectedValueOnce(new Error('offline'));

    render(<OrganizationName />, { wrapper });

    await waitFor(() => expect(client.get).toHaveBeenCalled());
    expect(screen.queryByTestId('organization-name')).not.toBeInTheDocument();
  });
});
