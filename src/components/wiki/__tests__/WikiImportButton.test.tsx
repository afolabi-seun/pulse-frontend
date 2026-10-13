import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';
import WikiImportButton from '../WikiImportButton';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('sonner', async (orig) => ({ ...(await orig<typeof import('sonner')>()), toast: { error: vi.fn(), success: vi.fn() } }));

const choose = (file: File) => fireEvent.change(screen.getByLabelText('Choose a Word or Markdown file to import'), { target: { files: [file] } });

describe('WikiImportButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hands a converted Word document to the editor, with its title from the file name', async () => {
    const onImported = vi.fn();
    renderWithProviders(<WikiImportButton onImported={onImported} />);

    const bytes = readFileSync(resolve(__dirname, '../../../lib/__tests__/fixtures/sample.docx'));
    choose(new File([bytes], 'Treasury_Design.docx'));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const doc = onImported.mock.calls[0][0];
    expect(doc.title).toBe('Treasury Design');
    expect(doc.markdown).toContain('# Overview');
    expect(doc.warnings.join(' ')).toMatch(/image/);
  });

  it('tells the user why a file cannot be imported, and hands nothing to the editor', async () => {
    const onImported = vi.fn();
    renderWithProviders(<WikiImportButton onImported={onImported} />);

    choose(new File(['x'], 'budget.xlsx'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Word \(\.docx\) or Markdown/)));
    expect(onImported).not.toHaveBeenCalled();
  });

  it('says plainly that the original file is not kept and images are not imported', () => {
    renderWithProviders(<WikiImportButton onImported={vi.fn()} />);

    expect(screen.getByText(/file is not stored, and images are not imported/i)).toBeInTheDocument();
  });
});
