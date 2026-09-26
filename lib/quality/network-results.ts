/**
 * Stored network verdicts turned into check results, per dataset: link health
 * from 'link' rows, quotes still on their pages from 'quote' rows, tickers
 * from 'sec' and 'figi', USGS table rows from 'usgs-pdf'.
 *
 * A row nobody has looked at yet is `unchecked`; a look that could not tell
 * (a robot refused, a PDF unreadable here) is neither passed nor failed. Both
 * are shown, so a high score over a small sample cannot pass for coverage.
 */
import mcs from '@/research/usgs-mcs.json';
import { marketHref } from '@/lib/links';
import type { StoredCheck } from './store';
import { linkTargets, quoteTargets, type LinkTarget } from './targets';
import { figiSlugs, secLines } from './network-registries';
import type { CheckResult, Failure } from './types';

type Row = { row: string; link?: string; page?: string; verdict: StoredCheck | undefined };

function tally(
  meta: Omit<CheckResult, 'checked' | 'passed' | 'failures' | 'kind'>,
  rows: Row[],
): CheckResult {
  const judged = rows.filter((r) => r.verdict && r.verdict.ok !== null);
  const failures: Failure[] = judged
    .filter((r) => r.verdict!.ok === false)
    .map((r) => ({
      row: r.row,
      problem: r.verdict!.detail || r.verdict!.status,
      link: r.link,
      page: r.page,
    }));
  const dates = rows.flatMap((r) => (r.verdict ? [r.verdict.checkedAt] : [])).sort();
  return {
    ...meta,
    kind: 'network',
    checked: judged.length,
    passed: judged.length - failures.length,
    failures,
    unchecked: rows.filter((r) => !r.verdict).length,
    cannotTell: rows.filter((r) => r.verdict?.ok === null).length,
    asOf: dates[0],
  };
}

function byDataset<T extends { dataset: string }>(items: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of items) out.set(t.dataset, [...(out.get(t.dataset) ?? []), t]);
  return out;
}

export function networkResults(stored: readonly StoredCheck[]): CheckResult[] {
  const index = new Map(stored.map((s) => [`${s.kind} ${s.key}`, s]));
  const get = (kind: string, key: string) => index.get(`${kind} ${key}`);
  const out: CheckResult[] = [];

  for (const [dataset, targets] of byDataset<LinkTarget>(linkTargets()))
    out.push(
      tally(
        {
          dataset,
          criterion: 'links',
          check: `${dataset}/links`,
          label: 'Source links answer (3 tries; 401/403/429 counted apart)',
        },
        targets.map((t) => ({
          row: t.row,
          link: t.url,
          page: t.page,
          verdict: get('link', t.url),
        })),
      ),
    );
  for (const [dataset, targets] of byDataset(quoteTargets()))
    out.push(
      tally(
        {
          dataset,
          criterion: 'correctness',
          check: `${dataset}/quote-on-page`,
          label: 'The quoted sentence is still on the source page',
        },
        targets.map((t) => ({
          row: t.row,
          link: t.url,
          page: t.page,
          verdict: get('quote', t.key),
        })),
      ),
    );

  out.push(
    tally(
      {
        dataset: 'listings',
        criterion: 'correctness',
        check: 'listings/sec-ticker',
        label: 'The SEC ticker file still gives each CIK its recorded ticker',
      },
      secLines().map(({ key, line }) => ({
        row: key.replace(':', ' '),
        link: line.source,
        page: marketHref(key.split(':')[0]),
        verdict: get('sec', key),
      })),
    ),
    tally(
      {
        dataset: 'listings',
        criterion: 'correctness',
        check: 'listings/figi-mapping',
        label: 'OpenFIGI still maps each FIGI to the recorded ticker and exchange',
      },
      figiSlugs().map((slug) => ({
        row: slug,
        link: get('figi', slug)?.url,
        page: marketHref(slug),
        verdict: get('figi', slug),
      })),
    ),
    tally(
      {
        dataset: 'usgs-mcs',
        criterion: 'correctness',
        check: 'usgs-mcs/pdf-row',
        label: 'Each row’s values are on that country’s row in the chapter PDF',
      },
      mcs.chapters.flatMap((c) =>
        c.rows
          .filter((r) =>
            Object.values(r.cells).some((cell) => /\d/.test((cell as { raw: string }).raw)),
          )
          .map((r) => {
            const key = `${c.slug}:${r.name}`;
            return {
              row: `${c.commodity}: ${r.name}`,
              link: c.url,
              page: `/resources/${c.resource}`,
              verdict: get('usgs-pdf', key),
            };
          }),
      ),
    ),
  );
  return out;
}
