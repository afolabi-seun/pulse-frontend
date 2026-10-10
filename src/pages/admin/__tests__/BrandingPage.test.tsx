import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import BrandingPage from '../BrandingPage';
import { renderWithProviders } from '../../../test/renderWithProviders';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const ORG = { id: 'o1', name: 'Acme', slug: 'acme', brandColor: null as string | null, logoVersion: null as string | null };

/** Answers GETs by URL: the organization, and its logo as a blob. */
function serve(organization: Partial<typeof ORG> = {}) {
  vi.mocked(client.get).mockImplementation((url: string) => {
    if (url === '/organization') return Promise.resolve({ data: { ...ORG, ...organization } });
    if (url === '/organization/logo') return Promise.resolve({ data: new Blob(['png']) });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function file(name: string, type: string, size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('BrandingPage', () => {
  beforeEach(() => {
    vi.mocked(client.get).mockReset();
    vi.mocked(client.put).mockReset();
    vi.mocked(client.delete).mockReset();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:logo') }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts from the organization's current name and colour, with nothing to save", async () => {
    serve({ brandColor: '#2563EB' });

    renderWithProviders(<BrandingPage />);

    expect(await screen.findByDisplayValue('Acme')).toBeInTheDocument();
    expect(screen.getByLabelText('Accent colour')).toHaveValue('#2563EB');
    expect(screen.getByRole('button', { name: 'Blue' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('saves a new name and a colour picked from the presets', async () => {
    serve();
    vi.mocked(client.put).mockResolvedValueOnce({ data: { ...ORG, name: 'Acme Engineering', brandColor: '#0D9488' } });

    renderWithProviders(<BrandingPage />);
    fireEvent.change(await screen.findByDisplayValue('Acme'), { target: { value: ' Acme Engineering ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Teal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith('/organization/branding', { name: 'Acme Engineering', brandColor: '#0D9488' }));
    expect(await screen.findByText('Branding saved.')).toBeInTheDocument();
  });

  it("clearing the colour saves null, which is Pulse's own colour", async () => {
    serve({ brandColor: '#2563EB' });
    vi.mocked(client.put).mockResolvedValueOnce({ data: ORG });

    renderWithProviders(<BrandingPage />);
    await screen.findByDisplayValue('Acme');
    fireEvent.click(screen.getByRole('button', { name: "Use Pulse's colour" }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(client.put).toHaveBeenCalledWith('/organization/branding', { name: 'Acme', brandColor: null }));
  });

  it('will not save a colour that is not a hex colour, or an empty name', async () => {
    serve();

    renderWithProviders(<BrandingPage />);
    const name = await screen.findByDisplayValue('Acme');
    fireEvent.change(screen.getByLabelText('Accent colour'), { target: { value: 'red' } });

    expect(screen.getByText(/Enter a colour as #/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Accent colour'), { target: { value: '#DC2626' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();

    fireEvent.change(name, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('previews the colour being edited without recolouring the rest of the app', async () => {
    serve();

    renderWithProviders(<BrandingPage />);
    await screen.findByDisplayValue('Acme');
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));

    await waitFor(() =>
      expect(screen.getByTestId('branding-preview').style.getPropertyValue('--primary')).toBe('221 83% 53%'));
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  });

  it("shows the server's reason when saving fails", async () => {
    serve();
    const { ApiError } = await import('../../../lib/errors');
    vi.mocked(client.put).mockRejectedValueOnce(new ApiError('VALIDATION', 'That name is taken.', 400));

    renderWithProviders(<BrandingPage />);
    fireEvent.change(await screen.findByDisplayValue('Acme'), { target: { value: 'Other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('That name is taken.')).toBeInTheDocument();
  });

  it('uploads a logo as multipart form data', async () => {
    serve();
    vi.mocked(client.put).mockResolvedValueOnce({ data: { ...ORG, logoVersion: '1' } });

    renderWithProviders(<BrandingPage />);
    await screen.findByDisplayValue('Acme');
    const logo = file('logo.png', 'image/png');
    fireEvent.change(screen.getByLabelText('Logo file'), { target: { files: [logo] } });

    await waitFor(() => expect(client.put).toHaveBeenCalled());
    const [url, body, config] = vi.mocked(client.put).mock.calls[0];
    expect(url).toBe('/organization/logo');
    expect((body as FormData).get('file')).toBe(logo);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    // The new version fetches the logo and offers to replace or remove it.
    expect(await screen.findByRole('button', { name: 'Replace logo' })).toBeInTheDocument();
    expect(await screen.findByAltText('Current logo')).toHaveAttribute('src', 'blob:logo');
  });

  it('refuses a file of the wrong type or over the size limit before uploading it', async () => {
    serve();

    renderWithProviders(<BrandingPage />);
    await screen.findByDisplayValue('Acme');
    fireEvent.change(screen.getByLabelText('Logo file'), { target: { files: [file('logo.svg', 'image/svg+xml')] } });
    expect(await screen.findByText('The logo must be a PNG, JPEG or WebP image.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Logo file'), { target: { files: [file('big.png', 'image/png', 256 * 1024 + 1)] } });
    expect(await screen.findByText('The logo must be 256 KB or smaller.')).toBeInTheDocument();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('removes the logo', async () => {
    serve({ logoVersion: '1' });
    vi.mocked(client.delete).mockResolvedValueOnce({ data: ORG });

    renderWithProviders(<BrandingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(client.delete).toHaveBeenCalledWith('/organization/logo'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Upload logo' })).toBeInTheDocument();
  });

  it('offers a retry when the organization cannot be loaded', async () => {
    vi.mocked(client.get).mockRejectedValue(new Error('boom'));

    renderWithProviders(<BrandingPage />);

    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
  });
});
