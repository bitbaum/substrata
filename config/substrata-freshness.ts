/**
 * Every feed and committed dataset the site shows, with how often each is
 * supposed to move — the declarations /data/freshness measures against.
 *
 * A date on a page says when something was last true; it cannot say whether
 * that is late. That takes an expectation, and the expectation lives here, in
 * one place, so the page, `/api/health/freshness`, the footer badge and the
 * build (`test/freshness.test.ts`) all judge by the same rule.
 *
 * Cadences match the box timers (`systemctl list-timers 'appcron-substrata-*'`)
 * as installed on 2026-09-25. The sweep's cadence is read from its settings
 * row instead, because a reviewer changes it at /account/settings#sweep.
 */
import claims from '../research/claims.json';
import events from '../research/events.json';
import evidence from '../research/evidence.json';
import jobBoards from '../research/job-boards.json';
import learningPaths from '../research/learning-paths.json';
import listings from '../research/listings.json';
import occupations from '../research/occupations.json';
import series from '../research/series.json';
import usgs from '../research/usgs-mcs.json';
import { ASSESSMENTS } from './substrata-assessment';

export type FeedId = 'sweep' | 'source' | 'filings' | 'science' | 'series' | 'drafts' | 'jobs';

export interface Feed {
  id: FeedId;
  label: string;
  /** What it fetches, from where. */
  what: string;
  /** Where a reader sees what it brings in. */
  shows: { label: string; href: string };
  table: string;
  /**
   * Hours between scheduled runs, or null when nothing on the box schedules
   * it — which is reported as "not scheduled", never as fresh.
   * `'settings'` reads the sweep's own interval from the database.
   */
  everyHours: number | 'settings' | null;
  /**
   * SQL over one row of `table`: true when a finished run achieved nothing
   * because every look failed. A run with SOME failures still counts as a run;
   * a run that crashed (never finished) is caught separately.
   */
  failedWhen: string;
  /**
   * Set when the feed runs when a reader asks, not on a clock — then it is
   * reported as "on demand" with this reason, never as late. Drafting is one:
   * it runs only on readers' own AI keys (George, 2026-09-25).
   */
  onDemand?: string;
}

export const FEEDS: readonly Feed[] = [
  {
    id: 'sweep',
    label: 'Research sweep',
    what: 'Web search per bottleneck for news that may tighten or loosen it; finds leads, publishes nothing.',
    shows: { label: 'Leads on the desk and in /review', href: '/review' },
    table: 'research_sweep_runs',
    everyHours: 'settings',
    failedWhen: 'nodes_swept > 0 AND could_not_look >= nodes_swept',
  },
  {
    id: 'drafts',
    label: 'Event drafts',
    what: 'Reads sweep leads and drafts an event from each, quote checked against the page — on a reader’s own AI key, never the free AI.',
    shows: { label: 'Unreviewed drafts in /review', href: '/review' },
    table: 'research_event_draft_runs',
    everyHours: null,
    onDemand:
      'Runs when a reader presses “Summarise with AI”, and hourly only for readers who switched on automatic updates — each time on their own key.',
    failedWhen: 'drafted = 0 AND could_not_read > 0',
  },
  {
    id: 'filings',
    label: 'SEC filings',
    what: 'New 8-K, 6-K, 10-Q, 10-K and 20-F filings from SEC EDGAR for every listed holder.',
    shows: { label: 'Filings on the desk and company pages', href: '/for/equities' },
    table: 'research_filing_runs',
    everyHours: 1,
    failedWhen: 'failed > 0 AND failed >= registrants',
  },
  {
    id: 'science',
    label: 'Science feeds',
    what: 'Papers, preprints and grants from OpenAlex, arXiv, NSF, OpenAIRE and USAspending.',
    shows: { label: 'Science pipeline', href: '/science/pipeline' },
    table: 'research_science_runs',
    everyHours: 1,
    failedWhen: 'fetched = 0 AND cardinality(failed) > 0',
  },
  {
    id: 'jobs',
    label: 'Job boards',
    what: 'Open roles from the public Greenhouse, Lever and Ashby boards of directory companies.',
    shows: { label: 'Careers', href: '/careers' },
    table: 'research_job_runs',
    everyHours: 24,
    failedWhen: 'failed > 0 AND failed >= boards',
  },
  {
    id: 'series',
    label: 'Official statistics',
    what: 'Price and output series from the BLS public API.',
    shows: { label: 'Data series', href: '/data/series?origin=official' },
    table: 'research_series_runs',
    everyHours: 24,
    failedWhen: 'failed > 0 AND series = 0',
  },
  {
    id: 'source',
    label: 'Producer sourcing',
    what: 'Searches for a primary source for each unsourced producer row; candidates wait for review.',
    shows: { label: 'Data quality', href: '/data' },
    table: 'research_source_runs',
    // Every six hours at :52 (appcron-substrata-source, loki install-app-crons.sh).
    everyHours: 6,
    failedWhen: 'rows_examined > 0 AND could_not_look >= rows_examined',
  },
];

export interface Dataset {
  id: string;
  label: string;
  file: string;
  /** How it is refreshed, as a command or a person's job. */
  refresh: string;
  /** The date the file says it was last checked, YYYY-MM-DD. */
  checkedOn: string;
  /** Past this, the build fails: a committed file this old is not shown as current. */
  maxAgeDays: number;
}

const day = (iso: string | null | undefined) => (iso ?? '').slice(0, 10);
const oldest = (dates: readonly string[]) => [...dates].sort()[0] ?? '';

export const DATASETS: readonly Dataset[] = [
  {
    id: 'listings',
    label: 'Tickers and listings',
    file: 'research/listings.json',
    refresh: 'pnpm run research:listings -- --revalidate',
    checkedOn: day(listings.checkedOn),
    maxAgeDays: 30,
  },
  {
    id: 'series-quotes',
    label: 'Series read from sources (oldest quote check)',
    file: 'research/series.json',
    refresh: 'Re-read each source and match the quote: pnpm tsx scripts/research/check-series.ts',
    checkedOn: oldest(series.series.map((s) => s.checkedOn)),
    maxAgeDays: 30,
  },
  {
    id: 'claims',
    label: 'Claims checked against series',
    file: 'research/claims.json',
    refresh: 'Re-check each claim against its series and update checkedOn',
    checkedOn: day(claims.checkedOn),
    maxAgeDays: 30,
  },
  {
    id: 'job-boards',
    label: 'Which board each company hires on',
    file: 'research/job-boards.json',
    refresh: 'Re-check each careers page and update checkedOn',
    checkedOn: day(jobBoards.checkedOn),
    maxAgeDays: 30,
  },
  {
    id: 'producer-evidence',
    label: 'Producer sourcing worklist',
    file: 'research/evidence.json',
    refresh: 'pnpm run research:source',
    checkedOn: day(evidence.generatedAt),
    maxAgeDays: 30,
  },
  {
    id: 'events-worklist',
    label: 'Offline event sweep worklist',
    file: 'research/events.json',
    refresh: 'pnpm run research:sweep',
    checkedOn: day(events.generatedAt),
    maxAgeDays: 30,
  },
  {
    id: 'assessments',
    label: 'Binding assessments (oldest judgement)',
    file: 'config/substrata-assessment.ts',
    refresh: 'Re-judge each bottleneck and update its judgedOn',
    checkedOn: oldest(ASSESSMENTS.map((a) => a.judgedOn)),
    maxAgeDays: 90,
  },
  {
    id: 'learning-paths',
    label: 'Training and learning paths (oldest check)',
    file: 'research/learning-paths.json',
    refresh: 'Re-open each provider page and update checkedOn',
    checkedOn: oldest(learningPaths.paths.map((p) => p.checkedOn)),
    maxAgeDays: 90,
  },
  {
    id: 'occupations',
    label: 'Occupations (O*NET, ESCO)',
    file: 'research/occupations.json',
    refresh: 'pnpm run research:occupations (O*NET publishes yearly)',
    checkedOn: day(occupations.generatedOn),
    maxAgeDays: 365,
  },
  {
    id: 'usgs-mcs',
    label: 'World production and reserves (USGS MCS)',
    file: 'research/usgs-mcs.json',
    // USGS publishes a new edition every February; bump EDITION_YEAR and re-run.
    refresh: 'pnpm run research:usgs (new edition each February)',
    checkedOn: day(usgs.retrieved),
    maxAgeDays: 400,
  },
];

/** The review queue: leads a person has not read yet. Declared, like the rest. */
export const REVIEW_QUEUE_MAX_DAYS = 7;
