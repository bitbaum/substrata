/**
 * PDFs read like pages.
 *
 * Asked for Kazatomprom's 2026 guidance (2026-10-24), the first search result
 * was the company's own trading update — a PDF — and `readPage` refuses PDFs
 * ("That is a application/pdf file, not a readable page"), so the one page that
 * held the figure was the one not read. Annual reports, trading updates and
 * NI 43-101 reports are PDFs; a research assistant has to read them.
 *
 * This is a `fetch` for `readPage` (ai-kit), not a second reader: `readPage`
 * still validates every hop against private addresses (SSRF) and follows
 * redirects itself; only a final PDF body is turned into its text here, with
 * `unpdf` (lib/sources/pdf.ts), and handed back as `text/plain`. Bounded: the
 * body is read to at most `maxBytes`, under `readPage`'s own timeout signal.
 */
import { isPdf, pdfPages, quoteText } from './sources/pdf';

const MAX_PDF_BYTES = 8_000_000;

async function capped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) return null;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** A fetch that answers a PDF with its text, for `readPage`'s `deps.fetch`. */
export function pdfAwareFetch(
  base: typeof globalThis.fetch = globalThis.fetch,
  maxBytes = MAX_PDF_BYTES,
): typeof globalThis.fetch {
  return async (input, init) => {
    const res = await base(input, init);
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const looksPdf = type.includes('application/pdf') || /\.pdf(\?|$)/i.test(url);
    if (!res.ok || !looksPdf || (res.status >= 300 && res.status < 400)) return res;
    const bytes = await capped(res, maxBytes);
    if (!bytes || !isPdf(bytes, type)) return new Response('', { status: 415 });
    try {
      const text = (await pdfPages(bytes)).map((page) => quoteText(page)).join('\n\n');
      return new Response(text, { status: 200, headers: { 'content-type': 'text/plain' } });
    } catch {
      return new Response('', { status: 422 });
    }
  };
}
