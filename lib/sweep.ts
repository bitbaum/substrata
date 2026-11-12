/**
 * What counts as a candidate event, in one place. The box timer's sweep
 * (`lib/sweep-store.ts`) is the only caller; its queue is the only queue.
 */
import { createHash } from 'node:crypto';
import { searchProviders } from '@/lib/web-search';
import { webSearch, readPage } from '@bitbaum/ai-kit/web';

import { MATERIALS } from '@/config/substrata';
import { CHOKEPOINTS } from '@/config/substrata-coverage';
import type { EventEffect } from '@/config/substrata-events';
import { DEFAULT_SWEEP_SETTINGS, queryFor, type SweepSettings } from '@/lib/sweep-settings';

/** What the sweep files: a page naming a bottleneck's term with words of change. Never a finding. */
export interface CandidateEvent {
  id: string;
  bottleneck: string;
  term: string;
  url: string;
  title: string;
  published: string | null;
  excerpt: string;
  effectGuess: EventEffect;
  foundAt: string;
  status: 'candidate' | 'could_not_look';
}

export {
  DEFAULT_SWEEP_SETTINGS,
  parseSweepSettings,
  queryFor,
  type SweepSettings,
} from '@/lib/sweep-settings';
import { isNeverAnEvent, looksLikeAReference } from '@/lib/sweep-filter';

export { isNeverAnEvent, looksLikeAReference } from '@/lib/sweep-filter';

/** How many results to consider, how many to read, and how much text to keep around a match. */
const RESULTS_PER_NODE = 8;
const EXCERPT_RADIUS = 200;

const TIGHTENS =
  /shortag|delay|cut|halt|suspend|ban|restrict|control|licen[cs]e requir|liquidat|clos(e|ure|ing)|outage|fire|explosion|strike|sanction|tariff|backlog|sold out|wait(ing)? list|years? of lead/i;
const LOOSENS =
  /expan|new plant|new facilit|capacity|open(s|ed|ing)|commission|ramp|second source|agreement|approv|granted|breakthrough|recycl|ease|resum/i;

/** A find whose title is about another market that shares the material's word. */
export function isOffTopic(bottleneck: string, title: string): boolean {
  return MATERIALS.find((m) => m.title === bottleneck)?.offTopic?.test(title) ?? false;
}

export function nodes(): Array<{ name: string; term: string }> {
  return [
    ...MATERIALS.map((m) => ({ name: m.title, term: m.search })),
    ...CHOKEPOINTS.map((c) => ({ name: c.name, term: chokepointTerm(c.name) })),
  ];
}

/** "Large power transformer slots" → "large power transformer"; the last word is usually the count noun we added. */
function chokepointTerm(name: string): string {
  return name
    .replace(
      /\b(slots|order books|queues|capacity|yield|formulation|engineers|sintering|drives)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function guessEffect(text: string): EventEffect {
  const tight = TIGHTENS.test(text);
  const loose = LOOSENS.test(text);
  if (tight && !loose) return 'tightens';
  if (loose && !tight) return 'loosens';
  return 'neutral';
}

function excerptAround(text: string, term: string): string | null {
  const lower = text.toLowerCase();
  const at = lower.indexOf(term.toLowerCase());
  if (at < 0) return null;
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(text.length, at + term.length + EXCERPT_RADIUS);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * A page's address without what a search engine or campaign appended. Google
 * adds `?srsltid=…` with a new value on every result, so the same blog post
 * was stored eight times as eight "new" leads (Liquid helium, 2026-10-02).
 */
const TRACKING =
  /^(srsltid|utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|igshid|ref_src|_hs(enc|mi))$/i;

export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()])
      if (TRACKING.test(key)) u.searchParams.delete(key);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

function idFor(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}

export interface SweepOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function sweep(
  node: { name: string; term: string },
  settings: SweepSettings = DEFAULT_SWEEP_SETTINGS,
  options: SweepOptions = {},
): Promise<CandidateEvent[]> {
  if (options.signal?.aborted) return [];
  const foundAt = new Date().toISOString();
  // The year is today's, not a literal: a hardcoded "2026" would quietly
  // narrow every search to last year from January on.
  const query = queryFor(node.term, settings.eventWords, new Date().getUTCFullYear());
  const searchTimeout = options.timeoutMs ? Math.min(15_000, options.timeoutMs) : 15_000;
  const customFetch = options.signal
    ? (url: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal
          ? AbortSignal.any([init.signal, options.signal!])
          : options.signal;
        return globalThis.fetch(url, { ...init, signal });
      }
    : undefined;
  const search = await webSearch(
    query,
    { limit: RESULTS_PER_NODE, timeoutMs: searchTimeout },
    { providers: searchProviders(customFetch) },
  );

  if (options.signal?.aborted) return [];
  if (search.status === 'could_not_look') {
    return [
      {
        id: idFor(`could_not_look:${node.name}:${foundAt}`),
        bottleneck: node.name,
        term: node.term,
        url: '',
        title: '',
        published: null,
        excerpt: '',
        effectGuess: 'neutral',
        foundAt,
        status: 'could_not_look',
      },
    ];
  }
  if (search.status === 'nothing') return [];

  const candidates = search.results
    .filter((r) => !isNeverAnEvent(r.url, settings.blockedHosts) && !isOffTopic(node.name, r.title))
    .slice(0, settings.pagesPerNode);

  // In parallel: candidate pages read one after the other was the slowest step,
  // accumulating up to 8 × 15s timeouts; neither page depends on the other.
  const pageTimeout = options.timeoutMs ? Math.min(15_000, options.timeoutMs) : 15_000;
  const pages = await Promise.all(
    candidates.map(async (result) => {
      if (options.signal?.aborted) {
        return {
          result,
          page: {
            ok: false as const,
            url: result.url,
            failure: { kind: 'timeout' as const, reason: 'Aborted' },
          },
        };
      }
      const page = await readPage(
        result.url,
        { timeoutMs: pageTimeout, maxChars: 60_000 },
        customFetch ? { fetch: customFetch } : {},
      );
      return { result, page };
    }),
  );

  const out: CandidateEvent[] = [];
  for (const { result, page } of pages) {
    if (!page.ok) continue;
    const excerpt = excerptAround(page.text, node.term);
    if (!excerpt) continue;
    const title = page.title || result.title;
    if (isOffTopic(node.name, title)) continue;
    // Checked here, not on the search result, because the reader often returns
    // a truer title than the snippet did.
    if (looksLikeAReference(title)) continue;
    const url = canonicalUrl(page.url);
    out.push({
      id: idFor(url),
      bottleneck: node.name,
      term: node.term,
      url,
      title,
      published: result.published ?? null,
      excerpt,
      effectGuess: guessEffect(excerpt),
      foundAt,
      status: 'candidate',
    });
  }
  return out;
}
