import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../ui/Button';
import { IMPORT_ACCEPT, ImportError, importDocument, type ImportedDocument } from '../../lib/wordImport';

/**
 * "Import from Word": picks a .docx (or .md) file, converts it in the browser and hands the Markdown to the editor for review. The original file
 * is not uploaded or kept, and nothing is saved until the author saves the page.
 */
export default function WikiImportButton({ onImported, disabled }: { onImported: (doc: ImportedDocument) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onImported(await importDocument(file));
    } catch (err) {
      toast.error(err instanceof ImportError ? err.message : 'That file could not be imported.');
    } finally {
      setBusy(false);
      // Let the same file be chosen again (e.g. after fixing it in Word).
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <input
        ref={inputRef}
        id="wiki-import-file"
        type="file"
        accept={IMPORT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a Word or Markdown file to import"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button type="button" size="sm" variant="secondary" loading={busy} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <FileUp className="mr-1.5 h-3.5 w-3.5" /> Import from Word
      </Button>
      <p className="text-xs text-muted-foreground">
        Word (.docx) or Markdown. Only the converted text is kept: the file is not stored, and images are not imported.
      </p>
    </div>
  );
}
