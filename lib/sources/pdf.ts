/**
 * PDF text, page by page, and the quote check that works on it.
 *
 * Annual reports, NI 43-101 technical reports and statistical yearbooks are
 * PDFs. Their extracted text breaks lines mid-sentence and hyphenates words
 * across lines ("ura-\nnium"), so a quote a reader copied from the rendered
 * page would not be found by a byte search. `quoteText` undoes exactly those
 * two things — line breaks and end-of-line hyphenation — and nothing else;
 * then the same `verbatimIn` rule as every web page applies (case, words and
 * numbers must match; only typography and whitespace are forgiven).
 *
 * Extraction is `unpdf` (pdf.js, no native binary), so CI needs no poppler.
 */
import { extractText, getDocumentProxy } from 'unpdf';

import { verbatimIn } from '@/lib/event-rules';

export function isPdf(bytes: Uint8Array, contentType = ''): boolean {
  if (contentType.includes('application/pdf')) return true;
  // "%PDF-" within the first kilobyte: some servers send octet-stream.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

/** Each page's text, in page order (index 0 is page 1). Throws an Error a person can act on. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  try {
    // pdf.js takes ownership of the buffer it is given; hand it a copy.
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(doc, { mergePages: false });
    return text;
  } catch (error) {
    throw new Error(
      `Could not read the PDF (${(error as Error).message}). If it is a scan with no text layer, quote a page that has text, or use the publisher's HTML version.`,
    );
  }
}

/**
 * The text as a reader sees it: a soft hyphen disappears, a hyphen at a line
 * end between two letters closes up — dropped ("ura-\nnium" → "uranium") or,
 * with `keepHyphen`, kept ("long-\nterm" → "long-term"), since the PDF cannot
 * say which it was — and every run of whitespace is one space.
 */
export function quoteText(text: string, keepHyphen = false): string {
  return text
    .replace(/\u00ad/g, '')
    .replace(/(\p{L})-[ \t]*\r?\n[ \t]*(\p{Ll})/gu, keepHyphen ? '$1-$2' : '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function inText(needle: string, text: string): string | null {
  return verbatimIn(needle, quoteText(text)) ?? verbatimIn(needle, quoteText(text, true));
}

export interface PdfQuoteHit {
  /** 1-based page the quote is on; null when it only matches across a page break. */
  page: number | null;
  /** The quote as it stands in the document. */
  matched: string;
}

/** Where `quote` stands in the document, or null when it is not there word for word. */
export function findQuoteInPages(quote: string, pages: readonly string[]): PdfQuoteHit | null {
  const needle = quoteText(quote);
  for (let i = 0; i < pages.length; i++) {
    const matched = inText(needle, pages[i]);
    if (matched) return { page: i + 1, matched };
  }
  const matched = inText(needle, pages.join('\n'));
  return matched ? { page: null, matched } : null;
}
