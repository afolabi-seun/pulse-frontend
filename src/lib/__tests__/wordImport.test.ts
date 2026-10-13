import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { importDocument, ImportError, titleFromFilename, MAX_IMPORT_BYTES } from '../wordImport';

function fixture(name: string): File {
  const bytes = readFileSync(resolve(__dirname, 'fixtures', name));
  return new File([bytes], 'Treasury_Design v2.docx');
}

describe('titleFromFilename', () => {
  it('drops the extension and turns underscores into spaces', () => {
    expect(titleFromFilename('Treasury_Design v2.docx')).toBe('Treasury Design v2');
    expect(titleFromFilename('notes.final.md')).toBe('notes.final');
    expect(titleFromFilename('  spaced   out .md')).toBe('spaced out');
  });
});

describe('importDocument: Word', () => {
  it('converts headings, formatting, lists, links and tables to Markdown', async () => {
    const doc = await importDocument(fixture('sample.docx'));

    expect(doc.source).toBe('word');
    expect(doc.title).toBe('Treasury Design v2');
    const md = doc.markdown;
    expect(md).toContain('# Treasury Design');            // the Title style becomes a top heading
    expect(md).toContain('# Overview');                    // Heading 1
    expect(md).toContain('## Rules');                      // Heading 2
    expect(md).toContain('**bold**');
    expect(md).toContain('*italic*');
    expect(md).toContain('[linked spec](https://example.com/spec)');
    expect(md).toMatch(/^-\s+First point$/m);              // bullet list
    expect(md).toMatch(/^-\s+Second point$/m);
    expect(md).toMatch(/^1\.\s+Step one$/m);               // numbered list
    expect(md).toMatch(/^2\.\s+Step two$/m);
  });

  it('keeps a table as a Markdown table, using its first row as the header', async () => {
    const { markdown } = await importDocument(fixture('sample.docx'));

    // Whole lines, not a loose pattern: Word puts each cell's text in a paragraph, and an earlier version split every cell across several lines
    // while a pattern with \s between the pipes still matched it.
    const lines = markdown.split('\n');
    expect(lines).toContain('| Field | Rule |');
    expect(lines).toContain('| --- | --- |');
    expect(lines).toContain('| Product Code | Must be positive |');
    expect(markdown).not.toContain('<table');
  });

  it('drops a table-of-contents link to a hidden Word bookmark but keeps its text', async () => {
    const { markdown } = await importDocument(fixture('sample.docx'));

    expect(markdown).not.toContain('#_Toc');
    expect(markdown).toContain('Overview');
  });

  it('leaves images out and says how many', async () => {
    const doc = await importDocument(fixture('sample.docx'));

    expect(doc.markdown).not.toContain('![');
    expect(doc.markdown).not.toContain('about:blank');
    expect(doc.warnings.join(' ')).toMatch(/1 image was left out/);
  });

  it('refuses a file that is not really a Word document, with a message fit to show', async () => {
    const notWord = new File(['this is not a zip'], 'broken.docx');

    await expect(importDocument(notWord)).rejects.toThrow(ImportError);
    await expect(importDocument(notWord)).rejects.toThrow(/could not be read as a Word document/);
  });
});

describe('importDocument: Markdown and refusals', () => {
  it('takes a Markdown file as it is, without a byte-order mark or Windows line endings', async () => {
    const doc = await importDocument(new File(['﻿# Runbook\r\n\r\nSteps here.\r\n'], 'runbook.md'));

    expect(doc.source).toBe('markdown');
    expect(doc.markdown).toBe('# Runbook\n\nSteps here.');
    expect(doc.warnings).toEqual([]);
    expect(doc.title).toBe('runbook');
  });

  it('explains that the old .doc format is not supported', async () => {
    await expect(importDocument(new File(['x'], 'old.doc'))).rejects.toThrow(/save it as \.docx/);
  });

  it('refuses other file types', async () => {
    await expect(importDocument(new File(['x'], 'sheet.xlsx'))).rejects.toThrow(/Word \(\.docx\) or Markdown/);
  });

  it('refuses a document with no text', async () => {
    await expect(importDocument(new File(['   \n  '], 'empty.md'))).rejects.toThrow(/no text to import/);
  });

  it('refuses a file over the size limit before reading it', async () => {
    const big = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'huge.docx');

    await expect(importDocument(big)).rejects.toThrow(/limit is 10 MB/);
  });
});
