/**
 * Pure checks for the smaller datasets (directory, science entries, job
 * boards, learning paths) and the freshness criterion, which reads the ages
 * config/substrata-freshness.ts already declares rather than restating them.
 */
import jobBoards from '@/research/job-boards.json';
import learningPaths from '@/research/learning-paths.json';
import eia from '@/research/eia-energy.json';
import mcs from '@/research/usgs-mcs.json';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { PARTICIPANTS } from '@/config/substrata-participants';
import { DEPENDENCIES } from '@/config/substrata-dependencies';
import { SCIENCE } from '@/config/substrata-science';
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import { DATASETS } from '@/config/substrata-freshness';
import { QUALITY_DATASETS } from '@/config/substrata-quality';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { ageDays, datasetState } from '@/lib/freshness/status';
import { marketHref, scienceHref } from '@/lib/links';
import { judge, type CheckResult } from './types';

export const DEPENDENCY_MAX_DAYS = 180;
export const SCIENCE_MAX_DAYS = 90;
const web = (u: unknown) => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);
const BOTTLENECK_NAMES = new Set(BOTTLENECKS.map((b) => b.name));

function freshnessChecks(now: Date): CheckResult[] {
  return QUALITY_DATASETS.filter((d) => d.freshness.datasets?.length).map((q) =>
    judge(
      {
        dataset: q.id,
        criterion: 'freshness',
        check: `${q.id}/declared-age`,
        label: 'Within the maximum age declared in config/substrata-freshness.ts',
      },
      DATASETS.filter((d) => q.freshness.datasets?.includes(d.id)),
      (d) =>
        datasetState(d, now) === 'stale'
          ? {
              row: d.label,
              problem: `checked ${d.checkedOn}, older than ${d.maxAgeDays} days`,
              page: '/data/freshness',
            }
          : null,
    ),
  );
}

export function miscChecks(now = new Date()): CheckResult[] {
  const tables = new Set([...mcs.chapters, ...eia.chapters].map((c) => c.resource));
  const gaps = eia.gaps.join(' ').toLowerCase();
  const boards = jobBoards.companies as Record<
    string,
    { careersUrl: string | null; evidence: string; checkedOn: string }
  >;
  return [
    ...freshnessChecks(now),
    judge(
      {
        dataset: 'producers',
        criterion: 'provenance',
        check: 'producers/directory-source',
        label: 'Every directory company links a primary source for its role',
      },
      PARTICIPANTS,
      (p) =>
        web(p.source) ? null : { row: p.name, problem: 'no source', page: marketHref(p.name) },
    ),
    judge(
      {
        dataset: 'dependencies',
        criterion: 'freshness',
        check: 'dependencies/read-recently',
        label: `Every row was read within ${DEPENDENCY_MAX_DAYS} days`,
      },
      DEPENDENCIES,
      (d) =>
        ageDays(d.readOn, now) <= DEPENDENCY_MAX_DAYS
          ? null
          : { row: `${d.from} ${d.kind} ${d.on}`, problem: `read ${d.readOn}`, link: d.source },
    ),
    judge(
      {
        dataset: 'usgs-mcs',
        criterion: 'completeness',
        check: 'usgs-mcs/resource-has-table',
        label: 'Every resource the atlas names has a world table, or its absence is declared',
      },
      RESOURCE_KINDS,
      (r) =>
        tables.has(r.id) || gaps.includes(r.label.toLowerCase())
          ? null
          : {
              row: r.label,
              problem: 'no USGS or EIA world table, and no declared gap',
              page: `/resources/${r.id}`,
            },
    ),
    judge(
      {
        dataset: 'science',
        criterion: 'provenance',
        check: 'science/entry-source',
        label: 'Every readiness entry cites a source',
      },
      SCIENCE,
      (e) =>
        web(e.source)
          ? null
          : { row: e.name, problem: 'readiness is unsourced', page: scienceHref(e.id) },
    ),
    judge(
      {
        dataset: 'science',
        criterion: 'consistency',
        check: 'science/relieves-exists',
        label: 'Every entry relieves a bottleneck that exists',
      },
      SCIENCE,
      (e) => {
        const bad = e.relieves.filter((r) => !BOTTLENECK_NAMES.has(r.bottleneck));
        return bad.length
          ? { row: e.name, problem: `unknown: ${bad.map((r) => r.bottleneck).join(', ')}` }
          : null;
      },
    ),
    judge(
      {
        dataset: 'science',
        criterion: 'freshness',
        check: 'science/judged-recently',
        label: `Readiness judged within ${SCIENCE_MAX_DAYS} days`,
      },
      SCIENCE,
      (e) =>
        ageDays(e.judgedOn, now) <= SCIENCE_MAX_DAYS
          ? null
          : { row: e.name, problem: `judged ${e.judgedOn}`, page: scienceHref(e.id) },
    ),
    judge(
      {
        dataset: 'jobs',
        criterion: 'completeness',
        check: 'jobs/board-row',
        label: 'Every company with a Markets page has a job-board row',
      },
      MARKET_PARTICIPANTS,
      (p) =>
        boards[p.slug]
          ? null
          : { row: p.name, problem: 'no job-board row', page: marketHref(p.slug) },
    ),
    judge(
      {
        dataset: 'jobs',
        criterion: 'provenance',
        check: 'jobs/board-evidence',
        label: 'Every board row says how it was found, where, and when',
      },
      Object.entries(boards),
      ([slug, b]) =>
        b.evidence &&
        b.evidence.length > 10 &&
        /^\d{4}-\d{2}-\d{2}$/.test(b.checkedOn) &&
        (b.careersUrl === null || web(b.careersUrl))
          ? null
          : {
              row: slug,
              problem: 'no evidence, date or careers link',
              link: b.careersUrl ?? undefined,
              page: marketHref(slug),
            },
    ),
    judge(
      {
        dataset: 'learning-paths',
        criterion: 'provenance',
        check: 'learning-paths/provider-page',
        label: 'Every path links its provider page and says when it was checked',
      },
      learningPaths.paths,
      (p) =>
        web(p.url) && /^\d{4}-\d{2}-\d{2}$/.test(p.checkedOn)
          ? null
          : { row: p.name, problem: 'no link or date', link: p.url },
    ),
  ];
}
