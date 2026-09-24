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

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`);
  return response;
}

/** Every source for one bottleneck. A source that fails is named, and the others still count. */
export async function collect(
  q: ScienceQuery,
  now: Date = new Date(),
): Promise<{ items: ScienceItem[]; failed: string[] }> {
  const failed: string[] = [];
  const attempt = async (name: string, run: () => Promise<ScienceItem[]>) => {
    try {
      return await run();
    } catch {
      failed.push(name);
      return [];
    }
  };
  const batches = await Promise.all([
    attempt('openalex', async () => [
      ...parseOpenAlex(await (await get(openAlexUrl(q, now, 'recent'))).json()),
      ...parseOpenAlex(await (await get(openAlexUrl(q, now, 'cited'))).json()),
    ]),
    attempt('nsf', async () => {
      const out: ScienceItem[] = [];
      for (const phrase of q.phrases)
        out.push(...parseNsf(await (await get(nsfUrl(phrase, now))).json()));
      return out;
    }),
    attempt('openaire', async () => {
      const out: ScienceItem[] = [];
      for (const phrase of q.phrases)
        out.push(...parseOpenAire(await (await get(openAireUrl(phrase, now))).json()));
      return out;
    }),
    attempt('doe', async () =>
      parseUsaSpending(
        await (
          await get(USASPENDING_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: usaSpendingBody(q, now),
          })
        ).json(),
      ),
    ),
  ]);
  // arXiv last and alone: it is the one source that asks for a pause.
  const arxiv = await attempt('arxiv', async () => {
    await new Promise((r) => setTimeout(r, ARXIV_GAP_MS));
    return parseArxiv(
      await (await get(arxivUrl(q), { headers: { Accept: 'application/atom+xml' } })).text(),
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

async function save(bottleneck: string, item: ScienceItem, score: number, matched: string[]) {
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
       updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [
      bottleneck,
      titleKey(item.title),
      item.id,
      item.source,
      item.kind,
      item.title,
      item.abstract.slice(0, 4000),
      item.venue,
      item.year,
      item.publishedOn,
      item.url,
      item.doi,
      item.pdfUrl,
      item.citations,
      JSON.stringify(item.institutions.slice(0, 12)),
      item.funder,
      item.programme,
      item.amount,
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

export async function fetchScience(now: Date = new Date(), only?: string): Promise<ScienceRun> {
  const db = database();
  const names = only ? [only].filter((n) => n in SCIENCE_QUERIES) : await due(now);
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_science_runs (bottlenecks) VALUES ($1) RETURNING id',
    [names],
  );
  const outcome: ScienceRun = { bottlenecks: names, fetched: 0, kept: 0, itemsNew: 0, failed: [] };
  for (const name of names) {
    const q = SCIENCE_QUERIES[name];
    const { items, failed } = await collect(q, now);
    outcome.fetched += items.length;
    outcome.failed.push(...failed.map((f) => `${name}: ${f}`));
    for (const item of items) {
      const { score, matched } = relevance(item, q);
      if (score < MIN_RELEVANCE) continue;
      outcome.kept += 1;
      outcome.itemsNew += await save(name, item, score, matched);
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
