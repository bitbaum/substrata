/**
 * One quality run: re-look at a rotating slice of the sources — the ones
 * looked at longest ago first — record each verdict, then store the whole
 * scorecard for the trend. No AI anywhere: HTTP, string matching, sums.
 *
 * Scheduled every six hours on the box (appcron-substrata-quality via
 * /api/cron/quality); `scripts/quality/run.ts` runs the same thing on demand,
 * with `--all` looking at everything at once.
 */
import { buildCards, assembleResults, scoreLines } from './report';
import { BROKEN, pool, probeUrl, quotesAt } from './network';
import {
  figiSlugs,
  figiVerdicts,
  mcsSlugs,
  mcsVerdicts,
  secVerdicts,
  type RowVerdict,
} from './network-registries';
import type { CheckKind, CheckStore, StoredCheck } from './store';
import { linkTargets, quoteTargets, urlsWithRows } from './targets';

export interface RunLimits {
  /** Distinct URLs probed for link health. */
  links: number;
  /** Distinct source pages re-read for their quotes. */
  quotePages: number;
  figi: number;
  mcsChapters: number;
  /** Stop starting new looks after this long; the box wrapper stops a call at 300s. */
  budgetMs: number;
}

export const SCHEDULED: RunLimits = {
  links: 150,
  quotePages: 25,
  figi: 20,
  mcsChapters: 2,
  budgetMs: 220_000,
};
export const EVERYTHING: RunLimits = {
  links: 1e9,
  quotePages: 1e9,
  figi: 1e9,
  mcsChapters: 1e9,
  budgetMs: 3_600_000,
};

/** Keys least recently looked at first; never-looked-at before all. */
function stalest<T>(
  items: readonly T[],
  keyOf: (t: T) => string,
  seen: Map<string, string>,
  n: number,
): T[] {
  return [...items]
    .sort((a, b) => (seen.get(keyOf(a)) ?? '').localeCompare(seen.get(keyOf(b)) ?? ''))
    .slice(0, n);
}

const now = () => new Date().toISOString();
const fromVerdict = (v: RowVerdict): StoredCheck => ({
  kind: v.check as CheckKind,
  key: v.key,
  ok: v.ok,
  status: v.ok === null ? 'cannot-tell' : v.ok ? 'ok' : 'mismatch',
  detail: v.detail,
  url: v.url,
  checkedAt: now(),
});

export async function runQuality(store: CheckStore, limits: RunLimits = SCHEDULED) {
  const deadline = Date.now() + limits.budgetMs;
  const id = await store.startRun();
  const before = await store.load();
  const seen = (kind: CheckKind) =>
    new Map(before.filter((c) => c.kind === kind).map((c) => [c.key, c.checkedAt]));
  const fresh: StoredCheck[] = [];
  const errors: string[] = [];

  try {
    fresh.push(...(await secVerdicts()).map(fromVerdict));
  } catch (error) {
    errors.push(`sec: ${(error as Error).message}`);
  }
  try {
    fresh.push(
      ...(await figiVerdicts(stalest(figiSlugs(), (s) => s, seen('figi'), limits.figi))).map(
        fromVerdict,
      ),
    );
  } catch (error) {
    errors.push(`figi: ${(error as Error).message}`);
  }
  const pdfSeen = new Map([...seen('usgs-pdf')].map(([k, at]) => [k.split(':')[0], at]));
  for (const slug of stalest(mcsSlugs(), (s) => s, pdfSeen, limits.mcsChapters)) {
    if (Date.now() > deadline) break;
    try {
      fresh.push(...(await mcsVerdicts(slug)).map(fromVerdict));
    } catch (error) {
      errors.push(`usgs-pdf ${slug}: ${(error as Error).message}`);
    }
  }

  // Quotes, one read per source page answering every quote that cites it.
  const quotes = quoteTargets();
  const quoteSeen = seen('quote');
  const pages = [...new Set(quotes.map((q) => q.url))];
  const pageAge = new Map(
    pages.map((u) => [
      u,
      quotes
        .filter((q) => q.url === u)
        .map((q) => quoteSeen.get(q.key) ?? '')
        .sort()[0],
    ]),
  );
  const pickedPages = stalest(pages, (u) => u, pageAge, limits.quotePages);
  const quoteRuns = await pool(pickedPages, 4, deadline, (url) =>
    quotesAt(
      url,
      quotes.filter((q) => q.url === url),
    ),
  );
  for (const q of quoteRuns.flat())
    fresh.push({
      kind: 'quote',
      key: q.key,
      ok: q.verdict === 'unreadable' ? null : q.verdict === 'found',
      status: q.verdict,
      detail: q.detail,
      url: q.url,
      checkedAt: now(),
    });

  // Link health, stalest first.
  const urls = [...urlsWithRows(linkTargets()).keys()];
  const picked = stalest(urls, (u) => u, seen('link'), limits.links);
  const links = await pool(picked, 8, deadline, (url) => probeUrl(url));
  for (const l of links)
    fresh.push({
      kind: 'link',
      key: l.url,
      ok: l.status === 'ok' ? true : BROKEN.has(l.status) ? false : null,
      status: l.status,
      detail: l.detail,
      url: l.url,
      checkedAt: now(),
    });

  await store.save(fresh);
  const { results } = await assembleResults(await store.load());
  const cards = buildCards(results);
  const failed = fresh.filter((c) => c.ok === false).length;
  await store.finishRun(id, fresh.length, failed, scoreLines(cards));
  return {
    looked: fresh.length,
    failed,
    cannotTell: fresh.filter((c) => c.ok === null).length,
    errors,
    cards,
  };
}
