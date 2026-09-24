/**
 * Reading the science feed back for pages and the desk. Dates are cast to text
 * in SQL: node-postgres turns a `date` into a local-midnight Date, which is how
 * a paper published on the 1st shows as the 31st.
 */
import type { PipelineStage } from '@/config/substrata-pipeline';
import { database } from './db';
import type { Institution, ItemKind, ScienceItem, ScienceSource } from './science';

/** "New" means found in the last week AND published in the last month, so a backfill is not news. */
export const NEW_FOUND_DAYS = 7;
export const NEW_PUBLISHED_DAYS = 30;

export interface StoredItem extends ScienceItem {
  bottleneck: string;
  score: number;
  matched: string[];
  stage: PipelineStage;
  stageWhy: string;
  alsoUrls: string[];
  review: string;
  firstSeen: string;
}

interface Row {
  bottleneck: string;
  id: string;
  source: ScienceSource;
  kind: ItemKind;
  title: string;
  abstract: string;
  venue: string | null;
  year: number | null;
  published_on: string | null;
  url: string;
  doi: string | null;
  pdf_url: string | null;
  citations: number | null;
  institutions: Institution[];
  funder: string | null;
  programme: string | null;
  amount: number | null;
  currency: string | null;
  score: number;
  matched: string[];
  stage: PipelineStage;
  stage_why: string;
  also_urls: string[];
  review: string;
  first_seen: string;
}

const COLUMNS = `bottleneck, id, source, kind, title, abstract, venue, year, published_on::text AS published_on,
  url, doi, pdf_url, citations, institutions, funder, programme, amount::float8 AS amount, currency, score,
  matched, stage, stage_why, also_urls, review, first_seen::text AS first_seen`;

const NEW_CLAUSE = `first_seen > now() - interval '${NEW_FOUND_DAYS} days'
  AND published_on > current_date - ${NEW_PUBLISHED_DAYS}`;

function toItem(r: Row): StoredItem {
  return {
    bottleneck: r.bottleneck,
    id: r.id,
    source: r.source,
    kind: r.kind,
    title: r.title,
    abstract: r.abstract,
    venue: r.venue,
    year: r.year,
    publishedOn: r.published_on,
    url: r.url,
    doi: r.doi,
    pdfUrl: r.pdf_url,
    citations: r.citations,
    institutions: Array.isArray(r.institutions) ? r.institutions : [],
    funder: r.funder,
    programme: r.programme,
    amount: r.amount,
    currency: r.currency,
    score: r.score,
    matched: r.matched,
    stage: r.stage,
    stageWhy: r.stage_why,
    alsoUrls: r.also_urls,
    review: r.review,
    firstSeen: r.first_seen,
  };
}

export interface FunnelRow {
  bottleneck: string;
  stage: PipelineStage;
  items: number;
  fresh: number;
}

export async function funnelCounts(): Promise<FunnelRow[]> {
  const result = await database().query<{
    bottleneck: string;
    stage: PipelineStage;
    items: number;
    fresh: number;
  }>(
    `SELECT bottleneck, stage, count(*)::int AS items,
            count(*) FILTER (WHERE ${NEW_CLAUSE})::int AS fresh
       FROM research_science_items GROUP BY bottleneck, stage`,
  );
  return result.rows;
}

/** One bottleneck's items, optionally one stage's, newest publication first. */
export async function itemsFor(
  bottleneck: string,
  stage: PipelineStage | null = null,
  limit = 60,
  order: 'recent' | 'cited' = 'recent',
): Promise<StoredItem[]> {
  const result = await database().query<Row>(
    `SELECT ${COLUMNS} FROM research_science_items
      WHERE bottleneck = $1 AND ($2::text IS NULL OR stage = $2)
      ORDER BY ${order === 'cited' ? 'citations DESC NULLS LAST,' : ''} published_on DESC NULLS LAST, score DESC
      LIMIT $3`,
    [bottleneck, stage, limit],
  );
  return result.rows.map(toItem);
}

/** New this week, on the given bottlenecks or all of them. */
export async function newItems(
  bottlenecks: readonly string[] | null = null,
  limit = 100,
  publishedDays = NEW_PUBLISHED_DAYS,
): Promise<StoredItem[]> {
  const result = await database().query<Row>(
    `SELECT ${COLUMNS} FROM research_science_items
      WHERE published_on > current_date - $3::int
        AND first_seen > now() - interval '${NEW_FOUND_DAYS} days'
        AND ($1::text[] IS NULL OR bottleneck = ANY($1))
      ORDER BY published_on DESC, score DESC LIMIT $2`,
    [bottlenecks, limit, publishedDays],
  );
  return result.rows.map(toItem);
}

export interface OrgActivity {
  name: string;
  type: string | null;
  country: string | null;
  bottleneck: string;
  items: number;
  latest: string | null;
}

/** Every institution named on an item, with how many items per bottleneck. */
export async function orgActivity(): Promise<OrgActivity[]> {
  const result = await database().query<OrgActivity>(
    `SELECT inst->>'name' AS name, max(inst->>'type') AS type, max(inst->>'country') AS country,
            bottleneck, count(*)::int AS items, max(published_on)::text AS latest
       FROM research_science_items, jsonb_array_elements(institutions) AS inst
      GROUP BY inst->>'name', bottleneck`,
  );
  return result.rows;
}

/** Items naming one institution, exactly as the source spelled it. */
export async function itemsByOrg(name: string, limit = 60): Promise<StoredItem[]> {
  const result = await database().query<Row>(
    `SELECT ${COLUMNS} FROM research_science_items
      WHERE institutions @> jsonb_build_array(jsonb_build_object('name', $1::text))
      ORDER BY published_on DESC NULLS LAST LIMIT $2`,
    [name, limit],
  );
  return result.rows.map(toItem);
}

export interface RunInfo {
  finishedAt: string;
  bottlenecks: number;
}

export async function lastScienceRun(): Promise<RunInfo | null> {
  const result = await database().query<{ finished_at: Date; searched: number }>(
    `SELECT (SELECT max(finished_at) FROM research_science_runs) AS finished_at,
            (SELECT count(*)::int FROM research_science_cursor) AS searched`,
  );
  const row = result.rows[0];
  return row?.finished_at
    ? { finishedAt: row.finished_at.toISOString(), bottlenecks: row.searched }
    : null;
}
