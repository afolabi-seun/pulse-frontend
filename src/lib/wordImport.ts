/**
 * Turns a Word document (.docx) or a Markdown file into wiki-page text, entirely in the browser: the file is read here and never uploaded, and
 * only the resulting Markdown is kept. Nothing is saved by this module; the caller puts the result in the editor for the author to check.
 *
 * The libraries (mammoth for Word -> HTML, turndown for HTML -> Markdown) are loaded on first use, so they cost nothing until someone imports.
 *
 * What survives: headings, paragraphs, bold/italic, lists, links and tables. What does not: images (the wiki stores text only, so they are left out
 * and counted in a warning) and layout features Markdown has no way to express (text boxes, tracked changes, comments, headers and footers).
 */

export interface ImportedDocument {
  /** Suggested page title, from the file name. */
  title: string;
  markdown: string;
  /** Things the author should know were lost or may look different. Empty when the conversion was clean. */
  warnings: string[];
  source: 'word' | 'markdown';
}

/** The file is not something that can be imported (wrong type, too big, empty). The message is safe to show as-is. */
export class ImportError extends Error {}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const IMPORT_ACCEPT = '.docx,.md,.markdown,.txt';

export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word marks headings, the title and bookmarks in ways turndown cannot see; this normalises the HTML mammoth produced before it is converted. */
function tidyHtml(html: string): { html: string; images: number } {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

  const images = doc.querySelectorAll('img');
  const imageCount = images.length;
  images.forEach((img) => img.remove());

  // A table of contents links to hidden Word bookmarks (#_Toc123). Those anchors do not exist here, so keep the text and drop the dead link.
  doc.querySelectorAll('a[href^="#_"]').forEach((a) => a.replaceWith(...Array.from(a.childNodes)));
  doc.querySelectorAll('a[id], a[name]').forEach((a) => { if (!a.textContent?.trim()) a.remove(); });

  // Word wraps the text of every table cell in a paragraph, and a Markdown table cell cannot hold block content: left alone, each cell splits across
  // several lines and the table falls apart. Flatten a cell's paragraphs into one line, with a line break between them.
  doc.querySelectorAll('td, th').forEach((cell) => {
    const paragraphs = Array.from(cell.children).filter((c) => c.tagName === 'P');
    if (paragraphs.length === 0 || paragraphs.length !== cell.children.length) return;
    cell.innerHTML = paragraphs.map((para) => para.innerHTML).join('<br>');
  });

  // GitHub-style Markdown tables need a header row, and Word tables rarely mark one. Treat the first row as the header so the table survives
  // as a table instead of falling back to raw HTML.
  doc.querySelectorAll('table').forEach((table) => {
    if (table.querySelector('th') || table.querySelector('thead')) return;
    const firstRow = table.querySelector('tr');
    if (!firstRow) return;
    firstRow.querySelectorAll('td').forEach((td) => {
      const th = doc.createElement('th');
      th.innerHTML = td.innerHTML;
      td.replaceWith(th);
    });
  });

  doc.querySelectorAll('p').forEach((p) => { if (!p.textContent?.trim() && !p.querySelector('img,br')) p.remove(); });

  return { html: doc.body.innerHTML, images: imageCount };
}

async function convertDocx(buffer: ArrayBuffer): Promise<{ markdown: string; warnings: string[] }> {
  const [{ default: mammoth }, { default: TurndownService }, { gfm }] = await Promise.all([
    import('mammoth/mammoth.browser'),
    import('turndown'),
    import('turndown-plugin-gfm'),
  ]);

  let imagesSeen = 0;
  let converted;
  try {
    converted = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
      // The wiki keeps text only: do not read or embed the image, just note that one was there.
      convertImage: mammoth.images.imgElement(async () => { imagesSeen += 1; return { src: 'about:blank' }; }),
      // mammoth's style-map syntax takes single quotes around the Word style name.
      styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"],
    });
  } catch {
    throw new ImportError('That file could not be read as a Word document. Check it is a .docx file (not the older .doc format) and is not damaged or password-protected.');
  }

  const tidy = tidyHtml(converted.value);
  const td = new TurndownService({
    headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*', strongDelimiter: '**',
  });
  td.use(gfm);
  const markdown = td.turndown(tidy.html).replace(/\n{3,}/g, '\n\n').trim();

  const warnings: string[] = [];
  const images = Math.max(imagesSeen, tidy.images);
  if (images > 0) {
    warnings.push(`${images} image${images === 1 ? ' was' : 's were'} left out: the wiki stores text only. Add a note where ${images === 1 ? 'it' : 'they'} belonged if it matters.`);
  }
  if (converted.messages.some((m) => m.type === 'warning')) {
    warnings.push('Some Word formatting could not be converted and may look different. Check the preview before saving.');
  }
  return { markdown, warnings };
}

/** FileReader rather than file.arrayBuffer()/text(): it works in every browser we support (older Safari lacks the newer methods) and in the test DOM. */
function readFile<T extends ArrayBuffer | string>(file: File, as: 'buffer' | 'text'): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () => reject(new ImportError('That file could not be read. Try choosing it again.'));
    if (as === 'buffer') reader.readAsArrayBuffer(file); else reader.readAsText(file);
  });
}

/** Reads a file chosen by the user. Throws <see cref="ImportError"/> with a message fit to show when it cannot be used. */
export async function importDocument(file: File): Promise<ImportedDocument> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  }

  const name = file.name.toLowerCase();
  let markdown: string;
  let warnings: string[] = [];
  let source: ImportedDocument['source'];

  if (name.endsWith('.docx')) {
    ({ markdown, warnings } = await convertDocx(await readFile<ArrayBuffer>(file, 'buffer')));
    source = 'word';
  } else if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')) {
    markdown = (await readFile<string>(file, 'text')).replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
    source = 'markdown';
  } else if (name.endsWith('.doc')) {
    throw new ImportError('The older .doc format is not supported. Open it in Word and save it as .docx, then import that.');
  } else {
    throw new ImportError('Choose a Word (.docx) or Markdown (.md) file.');
  }

  if (!markdown) throw new ImportError('That document has no text to import.');

  return { title: titleFromFilename(file.name), markdown, warnings, source };
}
