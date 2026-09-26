/**
 * Checks on what the scheduled feeds wrote to the database: official series,
 * science items and open roles, plus each feed's freshness as
 * lib/freshness/read.ts already judges it. Each query stands alone, so one
 * missing table turns one check into "could not read", not the page into an
 * error.
 */
import { OFFICIAL_SERIES } from '@/config/substrata-official-series';
import { QUALITY_DATASETS } from '@/config/substrata-quality';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { database } from '@/lib/db';
import { freshnessReport } from '@/lib/freshness/read';
import { BAD_STATES, STATE_LABEL } from '@/lib/freshness/status';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { bottleneckHref, seriesHref } from '@/lib/links';
import type { CheckResult, Failure } from './types';

type Meta = Omit<CheckResult, 'checked' | 'passed' | 'failures' | 'kind'>;

/** Every database check, declared, so test/quality.test.ts can hold them to the criteria without a database. */
export const DATABASE_CHECKS: readonly Pick<CheckResult, 'dataset' | 'criterion' | 'check'>[] = [
  { dataset: 'official-series', criterion: 'completeness', check: 'official-series/has-points' },
  { dataset: 'science', criterion: 'completeness', check: 'science/feed-per-bottleneck' },
  { dataset: 'science', criterion: 'provenance', check: 'science/item-link-date' },
  { dataset: 'jobs', criterion: 'provenance', check: 'jobs/posting-link' },
  { dataset: 'jobs', criterion: 'freshness', check: 'jobs/seen-recently' },
  { dataset: 'jobs', criterion: 'consistency', check: 'jobs/company-exists' },
  ...QUALITY_DATASETS.filter((d) => d.freshness.feeds?.length).map((d) => ({
    dataset: d.id,
    criterion: 'freshness' as const,
    check: `${d.id}/feed`,
  })),
];

function result(meta: Meta, checked: number, failures: Failure[]): CheckResult {
  return {
    ...meta,
    kind: 'database',
    checked,
    passed: checked - failures.length,
    failures,
    asOf: new Date().toISOString(),
  };
}

async function officialSeries(): Promise<CheckResult> {
  const { rows } = await database().query<{ series: string; n: string }>(
    'SELECT series, count(*) AS n FROM research_series_points GROUP BY series',
  );
  const held = new Map(rows.map((r) => [r.series, Number(r.n)]));
  return result(
    {
      dataset: 'official-series',
      criterion: 'completeness',
      check: 'official-series/has-points',
      label: 'Every declared series has points in the database',
    },
    OFFICIAL_SERIES.length,
    OFFICIAL_SERIES.filter((s) => !held.get(s.id)).map((s) => ({
      row: s.id,
      problem: 'no points fetched',
      page: seriesHref(s.id),
    })),
  );
}

async function science(): Promise<CheckResult[]> {
  const db = database();
  const [{ rows: per }, { rows: bad }] = await Promise.all([
    db.query<{ bottleneck: string }>('SELECT DISTINCT bottleneck FROM research_science_items'),
    db.query<{ bottleneck: string; title: string; url: string; total: string }>(
      `SELECT bottleneck, title, url, count(*) OVER () AS total FROM research_science_items
        WHERE url !~ '^https?://' OR (published_on IS NULL AND year IS NULL) LIMIT 50`,
    ),
  ]);
  const { rows: count } = await db.query<{ n: string }>(
    'SELECT count(*) AS n FROM research_science_items',
  );
  const held = new Set(per.map((r) => r.bottleneck));
  const badTotal = Number(bad[0]?.total ?? 0);
  return [
    result(
      {
        dataset: 'science',
        criterion: 'completeness',
        check: 'science/feed-per-bottleneck',
        label: 'Every bottleneck has at least one paper, preprint or grant in the feed',
      },
      BOTTLENECKS.length,
      BOTTLENECKS.filter((b) => !held.has(b.slug) && !held.has(b.name)).map((b) => ({
        row: b.name,
        problem: 'nothing in the feed',
        page: bottleneckHref(b.slug),
      })),
    ),
    {
      ...result(
        {
          dataset: 'science',
          criterion: 'provenance',
          check: 'science/item-link-date',
          label: 'Every feed item has a link and a date',
        },
        Number(count[0]?.n ?? 0),
        bad.map((r) => ({
          row: r.title.slice(0, 80),
          problem: 'no link or no date',
          link: r.url || undefined,
        })),
      ),
      passed: Number(count[0]?.n ?? 0) - badTotal,
    },
  ];
}

async function jobs(): Promise<CheckResult[]> {
  const { rows } = await database().query<{
    company_slug: string;
    title: string;
    url: string;
    last_seen: Date;
  }>('SELECT company_slug, title, url, last_seen FROM research_jobs WHERE closed_at IS NULL');
  const companies = new Set(MARKET_PARTICIPANTS.map((p) => p.slug));
  const stale = Date.now() - 3 * 86_400_000;
  const row = (r: (typeof rows)[number]) => `${r.company_slug}: ${r.title.slice(0, 70)}`;
  return [
    result(
      {
        dataset: 'jobs',
        criterion: 'provenance',
        check: 'jobs/posting-link',
        label: 'Every open role links its posting',
      },
      rows.length,
      rows
        .filter((r) => !/^https?:\/\//.test(r.url))
        .map((r) => ({ row: row(r), problem: 'no posting link' })),
    ),
    result(
      {
        dataset: 'jobs',
        criterion: 'freshness',
        check: 'jobs/seen-recently',
        label: 'Every open role was on its board within three days',
      },
      rows.length,
      rows
        .filter((r) => r.last_seen.getTime() < stale)
        .map((r) => ({
          row: row(r),
          problem: `last seen ${r.last_seen.toISOString().slice(0, 10)}`,
          link: r.url,
        })),
    ),
    result(
      {
        dataset: 'jobs',
        criterion: 'consistency',
        check: 'jobs/company-exists',
        label: 'Every open role belongs to a directory company',
      },
      rows.length,
      rows
        .filter((r) => !companies.has(r.company_slug))
        .map((r) => ({ row: row(r), problem: 'company not in the directory', link: r.url })),
    ),
  ];
}

/** Scheduled feeds' freshness, from the one freshness report. */
async function feeds(): Promise<CheckResult[]> {
  const report = await freshnessReport();
  return QUALITY_DATASETS.filter((d) => d.freshness.feeds?.length).map((d) => {
    const rows = report.feeds.filter((f) => d.freshness.feeds!.includes(f.feed.id));
    return result(
      {
        dataset: d.id,
        criterion: 'freshness',
        check: `${d.id}/feed`,
        label: 'The feed ran on its schedule (config/substrata-freshness.ts)',
      },
      rows.length,
      rows
        .filter((f) => BAD_STATES.has(f.state))
        .map((f) => ({
          row: f.feed.label,
          problem: STATE_LABEL[f.state],
          page: '/data/freshness',
        })),
    );
  });
}

/** Every database check; a failed read comes back as a note, not an exception. */
export async function databaseResults(): Promise<{ results: CheckResult[]; unreadable: string[] }> {
  const parts = await Promise.allSettled([officialSeries(), science(), jobs(), feeds()]);
  const names = ['official series', 'science feed', 'open roles', 'feed freshness'];
  return {
    results: parts.flatMap((p) => (p.status === 'fulfilled' ? [p.value].flat() : [])),
    unreadable: parts.flatMap((p, i) => (p.status === 'rejected' ? [names[i]] : [])),
  };
}
