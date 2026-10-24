/**
 * The one way a source adapter touches the network: allow-listed host, its
 * own pace, a descriptive user agent, and a cache under `.tmp/sources/` so a
 * re-run (and add.ts's quote check right after it) reads the same bytes.
 *
 * Tests never reach this code's network half: they pass `fetch` (or a cache
 * directory already holding the fixture) through `FetchDeps`.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assertAllowed, type HostRule } from './hosts';

export interface FetchedBody {
  url: string;
  status: number;
  contentType: string;
  body: Uint8Array;
  /** ISO timestamp of the network read (the cached one, on a cache hit). */
  fetchedAt: string;
  fromCache: boolean;
}

export interface FetchDeps {
  fetch?: typeof globalThis.fetch;
  /** Where cached bodies live; null turns the cache off. Default `.tmp/sources`. */
  cacheDir?: string | null;
  /** How old a cached body may be before it is read again. Default one day. */
  maxAgeMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export const DEFAULT_CACHE_DIR = path.resolve(process.cwd(), '.tmp/sources');
const DAY = 24 * 60 * 60 * 1000;

const lastCall = new Map<string, number>();

async function pace(rule: HostRule, deps: FetchDeps): Promise<void> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const wait = (lastCall.get(rule.host) ?? 0) + rule.minIntervalMs - now();
  if (wait > 0) await sleep(wait);
  lastCall.set(rule.host, now());
}

function cacheKey(url: string, accept: string): string {
  return createHash('sha256').update(`${accept}\n${url}`).digest('hex').slice(0, 32);
}

interface CacheMeta {
  url: string;
  status: number;
  contentType: string;
  fetchedAt: string;
}

async function fromCache(dir: string, key: string, maxAgeMs: number, now: number) {
  try {
    const meta = JSON.parse(await readFile(path.join(dir, `${key}.json`), 'utf8')) as CacheMeta;
    if (now - Date.parse(meta.fetchedAt) > maxAgeMs) return null;
    const body = new Uint8Array(await readFile(path.join(dir, `${key}.body`)));
    return { ...meta, body, fromCache: true } satisfies FetchedBody;
  } catch {
    return null;
  }
}

async function readCapped(res: Response, maxBytes: number, url: string): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`${url} is larger than ${maxBytes} bytes; refused.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/**
 * GET an allow-listed URL. Throws HostNotAllowed for any other host, and an
 * Error with the status for a non-2xx answer (never a cached failure).
 */
export async function sourceFetch(
  url: string,
  accept = '*/*',
  deps: FetchDeps = {},
): Promise<FetchedBody> {
  const rule = assertAllowed(url);
  const now = deps.now ?? Date.now;
  const dir = deps.cacheDir === undefined ? DEFAULT_CACHE_DIR : deps.cacheDir;
  const key = cacheKey(url, accept);
  if (dir) {
    const hit = await fromCache(dir, key, deps.maxAgeMs ?? DAY, now());
    if (hit) return hit;
  }
  const doFetch = deps.fetch ?? globalThis.fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let res: Response;
  for (let attempt = 1; ; attempt++) {
    await pace(rule, deps);
    res = await doFetch(url, {
      headers: { 'User-Agent': rule.userAgent, Accept: accept, 'Accept-Encoding': 'gzip, deflate' },
      redirect: 'follow',
      signal: AbortSignal.timeout(deps.timeoutMs ?? rule.timeoutMs ?? 60_000),
    });
    // Asked to slow down: wait as told (or 15 s, 30 s), at most three times.
    if (res.status !== 429 || attempt > 3) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 15_000 * attempt,
    );
  }
  // A redirect may only land on an allowed host too.
  if (res.url) assertAllowed(res.url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}.`);
  const body = await readCapped(res, rule.maxBytes, url);
  const fetched: FetchedBody = {
    url,
    status: res.status,
    contentType: (res.headers.get('content-type') ?? '').toLowerCase(),
    body,
    fetchedAt: new Date(now()).toISOString(),
    fromCache: false,
  };
  if (dir) {
    await mkdir(dir, { recursive: true });
    const meta: CacheMeta = {
      url,
      status: fetched.status,
      contentType: fetched.contentType,
      fetchedAt: fetched.fetchedAt,
    };
    await writeFile(path.join(dir, `${key}.body`), body);
    await writeFile(path.join(dir, `${key}.json`), `${JSON.stringify(meta)}\n`);
  }
  return fetched;
}

/** The body as UTF-8 text. */
export function bodyText(f: Pick<FetchedBody, 'body'>): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(f.body);
}

/** Forget the per-host clocks (tests). */
export function resetPacing(): void {
  lastCall.clear();
}
