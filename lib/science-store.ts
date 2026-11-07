/**
 * Fetching the science feeds into research_science_items.
 *
 * A run takes the bottlenecks searched longest ago and queries every source
 * for each. The free tiers set the pace: OpenAlex allows about a hundred
 * unkeyed calls a day and each bottleneck costs two, so a bottleneck is
 * searched at most once every REFRESH_HOURS; arXiv asks for three seconds
 * between requests. Requires scripts/db/007-science-pipeline.sql.
 */
import { SCIENCE_QUERIES, type ScienceQuery } from '@/config/substrata-pipeline';
import { database } from './db';
import { MIN_RELEVANCE, placeItem, relevance, titleKey, type ScienceItem } from './science';
import { USER_AGENT, arxivUrl, openAlexUrl, parseArxiv, parseOpenAlex } from './science-sources';
import {
  USASPENDING_URL,
  nsfUrl,
  openAireUrl,
  parseNsf,
  parseOpenAire,
  parseUsaSpending,
  usaSpendingBody,
} from './science-grants';

export const BOTTLENECKS_PER_RUN = 2;
export const REFRESH_HOURS = 20;
const ARXIV_GAP_MS = 3_100;

/**
 * Stop starting new bottlenecks after this long; the box wrapper allows 300s.
 * Stopping at 200s bounds the run well inside the curl timeout so the service
 * never exits with status 28.
 */
export const SCIENCE_RUN_BUDGET_MS = 200_000;

export interface FetchScienceOptions {
  budgetMs?: number;
  signal?: AbortSignal;
}

function timeoutSignal(timeoutMs: number, parentSignal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
}

/** One retry: the grant APIs drop a request now and then under no load at all. */
async function get(
  url: string,
  init: RequestInit = {},
  tries = 2,
  signal?: AbortSignal,
  timeoutMs = 15_000,
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
      signal: timeoutSignal(timeoutMs, signal),
    });
    if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`);
    return response;
  } catch (error) {
    if (tries <= 1 || signal?.aborted) throw error;
    await new Promise((r) => setTimeout(r, 2_000));
    return get(url, init, tries - 1, signal, timeoutMs);
  }
}

/** Every source for one bottleneck. A source that fails is named, and the others still count. */
export async function collect(
  q: ScienceQuery,
  now: Date = new Date(),
  options: { signal?: AbortSignal; remainingMs?: () => number } = {},
): Promise<{ items: ScienceItem[]; failed: string[] }> {
  const failed: string[] = [];
  const attempt = async (name: string, run: () => Promise<ScienceItem[]>) => {
    if (options.signal?.aborted || (options.remainingMs && options.remainingMs() < 1_000)) {
      return [];
    }
    try {
      return await run();
    } catch (error) {
      failed.push(`${name} (${error instanceof Error ? error.message.slice(0, 60) : 'error'})`);
      return [];
    }
  };
  const reqTimeout = () => Math.min(15_000, options.remainingMs ? options.remainingMs() : 15_000);
  const batches = await Promise.all([
    attempt('openalex', async () => [
      ...parseOpenAlex(
        await (
          await get(openAlexUrl(q, now, 'recent'), {}, 2, options.signal, reqTimeout())
        ).json(),
      ),
      ...parseOpenAlex(
        await (await get(openAlexUrl(q, now, 'cited'), {}, 2, options.signal, reqTimeout())).json(),
      ),
    ]),
    attempt('nsf', async () => {
      const out: ScienceItem[] = [];
      for (const phrase of q.phrases) {
        if (options.signal?.aborted || (options.remainingMs && options.remainingMs() < 1_000))
          break;
        out.push(
          ...parseNsf(
            await (await get(nsfUrl(phrase, now), {}, 2, options.signal, reqTimeout())).json(),
          ),
        );
      }
      return out;
    }),
    attempt('openaire', async () => {
      const out: ScienceItem[] = [];
      for (const phrase of q.phrases) {
        if (options.signal?.aborted || (options.remainingMs && options.remainingMs() < 1_000))
          break;
        out.push(
          ...parseOpenAire(
            await (await get(openAireUrl(phrase, now), {}, 2, options.signal, reqTimeout())).json(),
          ),
        );
      }
      return out;
    }),
    attempt('doe', async () =>
      parseUsaSpending(
        await (
          await get(
            USASPENDING_URL,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: usaSpendingBody(q, now),
            },
            2,
            options.signal,
            reqTimeout(),
          )
        ).json(),
      ),
    ),
  ]);
  // arXiv last and alone: it is the one source that asks for a pause.
  const arxiv =
    options.signal?.aborted || (options.remainingMs && options.remainingMs() < 4_000)
      ? []
      : await attempt('arxiv', async () => {
          await new Promise((r) => setTimeout(r, ARXIV_GAP_MS));
          return parseArxiv(
            await (
              await get(
                arxivUrl(q),
                { headers: { Accept: 'application/atom+xml' } },
                2,
                options.signal,
                reqTimeout(),
              )
            ).text(),
          );
        });
  return { items: [...batches.flat(), ...arxiv], failed };
}

export interface ScienceRun {
  bottlenecks: string[];
  fetched: number;
  kept: number;
  itemsNew: number;
  failed: string[];
}

export function cleanDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const match = d.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

export function cleanInt(n: unknown): number | null {
  if (n === null || n === undefined || n === '') return null;
  const num = Number(n);
  return Number.isInteger(num) ? num : null;
}

async function save(bottleneck: string, item: ScienceItem, score: number, matched: string[]) {
  const tk = titleKey(item.title);
  if (!tk) return 0;
  const placed = placeItem(item);
  const result = await database().query<{ inserted: boolean }>(
    `INSERT INTO research_science_items
       (bottleneck, title_key, id, source, kind, title, abstract, venue, year, published_on, url, doi,
        pdf_url, citations, institutions, funder, programme, amount, currency, score, matched, stage, stage_why)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     ON CONFLICT (bottleneck, title_key) DO UPDATE SET
       citations = GREATEST(research_science_items.citations, EXCLUDED.citations),
       abstract = CASE WHEN research_science_items.abstract = '' THEN EXCLUDED.abstract
                       ELSE research_science_items.abstract END,
       pdf_url = COALESCE(research_science_items.pdf_url, EXCLUDED.pdf_url),
       also_urls = CASE WHEN research_science_items.url = EXCLUDED.url
                          OR EXCLUDED.url = ANY(research_science_items.also_urls)
                        THEN research_science_items.also_urls
                        ELSE research_science_items.also_urls || EXCLUDED.url END,
       -- The stage rule can change; the newest reading of it wins.
       stage = EXCLUDED.stage,
       stage_why = EXCLUDED.stage_why,
       score = GREATEST(research_science_items.score, EXCLUDED.score),
       updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [
      bottleneck,
      tk,
      item.id,
      item.source,
      item.kind,
      item.title,
      item.abstract.slice(0, 4000),
      item.venue,
      cleanInt(item.year),
      cleanDate(item.publishedOn),
      item.url,
      item.doi,
      item.pdfUrl,
      cleanInt(item.citations),
      JSON.stringify(item.institutions.slice(0, 12)),
      item.funder,
      item.programme,
      Number.isFinite(Number(item.amount)) ? Number(item.amount) : null,
      item.currency,
      score,
      matched,
      placed.stage,
      placed.why,
    ],
  );
  return result.rows[0]?.inserted ? 1 : 0;
}

/** Searched longest ago first; never-searched before anything. */
async function due(now: Date): Promise<string[]> {
  const result = await database().query<{ bottleneck: string; searched_at: Date }>(
    'SELECT bottleneck, searched_at FROM research_science_cursor',
  );
  const last = new Map(result.rows.map((r) => [r.bottleneck, r.searched_at.getTime()]));
  const cutoff = now.getTime() - REFRESH_HOURS * 3_600_000;
  return Object.keys(SCIENCE_QUERIES)
    .filter((name) => (last.get(name) ?? 0) < cutoff)
    .sort((a, b) => (last.get(a) ?? 0) - (last.get(b) ?? 0))
    .slice(0, BOTTLENECKS_PER_RUN);
}

export async function fetchScience(
  now: Date = new Date(),
  only?: string,
  { budgetMs = SCIENCE_RUN_BUDGET_MS, signal }: FetchScienceOptions = {},
): Promise<ScienceRun> {
  const started = Date.now();
  const db = database();
  const names = only ? [only].filter((n) => n in SCIENCE_QUERIES) : await due(now);
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_science_runs (bottlenecks) VALUES ($1) RETURNING id',
    [names],
  );
  const outcome: ScienceRun = { bottlenecks: names, fetched: 0, kept: 0, itemsNew: 0, failed: [] };
  const remaining = () => Math.max(0, budgetMs - (Date.now() - started));

  for (const name of names) {
    if (Date.now() - started > budgetMs || signal?.aborted) break;
    const q = SCIENCE_QUERIES[name];
    const { items, failed } = await collect(q, now, { signal, remainingMs: remaining });
    outcome.fetched += items.length;
    outcome.failed.push(...failed.map((f) => `${name}: ${f}`));
    for (const item of items) {
      const { score, matched } = relevance(item, q);
      if (score < MIN_RELEVANCE) continue;
      outcome.kept += 1;
      try {
        outcome.itemsNew += await save(name, item, score, matched);
      } catch (error) {
        outcome.failed.push(
          `${name}: save ${item.id} (${error instanceof Error ? error.message : 'error'})`,
        );
      }
    }
    await db.query(
      `INSERT INTO research_science_cursor (bottleneck, searched_at) VALUES ($1, now())
       ON CONFLICT (bottleneck) DO UPDATE SET searched_at = now()`,
      [name],
    );
  }
  await db.query(
    `UPDATE research_science_runs
        SET finished_at = now(), fetched = $2, kept = $3, items_new = $4, failed = $5
      WHERE id = $1`,
    [run.rows[0].id, outcome.fetched, outcome.kept, outcome.itemsNew, outcome.failed],
  );
  return outcome;
}

/**
 * "Update now" on a bottleneck page reaches its research too: the open
 * databases are searched for this one bottleneck, unless that happened within
 * `cooldownHours` (one search serves every reader who presses after it). No
 * model is involved — this is internet fetching only.
 */
export async function refreshResearch(
  name: string,
  cooldownHours: number,
): Promise<{ searched: boolean; itemsNew: number }> {
  if (!(name in SCIENCE_QUERIES)) return { searched: false, itemsNew: 0 };
  const last = await database().query<{ searched_at: Date }>(
    'SELECT searched_at FROM research_science_cursor WHERE bottleneck = $1',
    [name],
  );
  const at = last.rows[0]?.searched_at?.getTime() ?? 0;
  if (Date.now() - at < cooldownHours * 3_600_000) return { searched: false, itemsNew: 0 };
  const run = await fetchScience(new Date(), name);
  return { searched: true, itemsNew: run.itemsNew };
}
