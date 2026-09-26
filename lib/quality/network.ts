/**
 * The network half of the quality checks: does a source URL still resolve,
 * and is a quoted sentence still on its page. No AI, no judgement — HTTP and
 * string matching. Called by the scheduled run (lib/quality/run.ts) and the
 * on-demand CLI (scripts/quality/run.ts), never by `verify`.
 */
import { AGENTS, pageText, quoteOnPage, ReadError } from './page-text';

/**
 * What a URL did, after up to three tries.
 *
 * `blocked` (401, 403, 429, a bot challenge) proves nothing about the page —
 * a publisher refusing a robot is not a dead link — so it is reported apart
 * and left out of the score. `gone` (404, 410) and the other 4xx are broken;
 * `server` (5xx) and `timeout` persisted through every retry.
 */
export type LinkStatus =
  'ok' | 'blocked' | 'unresolved' | 'gone' | 'client' | 'server' | 'timeout' | 'error';

export interface LinkResult {
  url: string;
  status: LinkStatus;
  code: number | null;
  detail: string;
}

export const BROKEN: ReadonlySet<LinkStatus> = new Set([
  'gone',
  'client',
  'server',
  'timeout',
  'error',
]);

/**
 * What a thrown fetch means. A resolver that answered "try again" (EAI_AGAIN)
 * says nothing about the page — it is the checker's own network — so it is
 * `unresolved` and not scored; a name that does not exist (ENOTFOUND), a
 * refused connection or a TLS failure is the link's.
 */
function failureOf(error: unknown, timeoutMs: number): Omit<LinkResult, 'url'> {
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError' || name === 'AbortError')
    return { status: 'timeout', code: null, detail: `no answer in ${timeoutMs / 1000}s` };
  const cause = (error as Error)?.cause as (Error & { code?: string }) | undefined;
  const code = cause?.code ?? '';
  const detail = [code, cause?.message].filter(Boolean).join(': ').slice(0, 100) || 'fetch failed';
  if (code === 'EAI_AGAIN') return { status: 'unresolved', code: null, detail };
  if (code === 'UND_ERR_CONNECT_TIMEOUT') return { status: 'timeout', code: null, detail };
  return { status: 'error', code: null, detail };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function classify(code: number): LinkStatus {
  if (code < 400) return 'ok';
  if (code === 401 || code === 403 || code === 429 || code === 999) return 'blocked';
  if (code === 404 || code === 410) return 'gone';
  if (code < 500) return 'client';
  return 'server';
}

async function once(url: string, method: 'HEAD' | 'GET', agent: string, timeoutMs: number) {
  const response = await fetch(url, {
    method,
    headers: { 'User-Agent': agent, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  // Drain without reading a whole PDF into memory.
  await response.body?.cancel().catch(() => undefined);
  return response.status;
}

/** HEAD first, GET when HEAD is refused; three tries with backoff on timeouts and 5xx only. */
export async function probeUrl(url: string, timeoutMs = 15_000): Promise<LinkResult> {
  let last: LinkResult = { url, status: 'error', code: null, detail: '' };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    try {
      let code = await once(url, 'HEAD', AGENTS[0], timeoutMs);
      if (code >= 400) code = await once(url, 'GET', AGENTS[attempt % 2], timeoutMs);
      const status = classify(code);
      last = { url, status, code, detail: `HTTP ${code}` };
      if (status !== 'server') return last;
    } catch (error) {
      last = { url, ...failureOf(error, timeoutMs) };
    }
  }
  return last;
}

/** Run `work` over `items` with at most `limit` at once, stopping new starts at `deadline`. */
export async function pool<T, R>(
  items: readonly T[],
  limit: number,
  deadline: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  const lane = async () => {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      out.push(await work(item));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return out;
}

export interface QuoteResult {
  key: string;
  url: string;
  verdict: 'found' | 'missing' | 'unreadable';
  detail: string;
}

/** Every quote that cites one URL, answered from a single read of it per user agent. */
export async function quotesAt(
  url: string,
  quotes: readonly { key: string; quote: string }[],
): Promise<QuoteResult[]> {
  const pages = new Map<string, Promise<string>>();
  const read = (u: string, agent: string) => {
    if (!pages.has(agent)) pages.set(agent, pageText(u, agent, 40_000));
    return pages.get(agent)!;
  };
  const out: QuoteResult[] = [];
  for (const q of quotes) {
    const { verdict, detail } = await quoteOnPage(url, q.quote, read);
    out.push({ key: q.key, url, verdict, detail });
  }
  return out;
}

export { ReadError };
