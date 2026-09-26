/**
 * What "correct and full" means, per dataset — written down, so it can be
 * measured.
 *
 * George, 2026-09-26: "double and triple check if the data is correct and
 * full. and we should have criteria for this and measure such things and
 * there should be links." This file is the criteria. Every dataset the site
 * shows gets a row, and every one of the six criteria is either a rule that
 * a check in lib/quality/ measures, or `na` with the reason it is not
 * measured — so a gap is stated, never implied away. test/quality.test.ts
 * holds each rule to at least one check and each check to a declared rule.
 *
 * Freshness is not re-declared here: `freshness.datasets` and `.feeds` point
 * at config/substrata-freshness.ts, which stays the one place ages live.
 */
import type { FeedId } from './substrata-freshness';
import type { CriterionId } from '@/lib/quality/types';

export const CRITERION_LABEL: Record<CriterionId, { label: string; question: string }> = {
  completeness: { label: 'Completeness', question: 'Is everything that should be here, here?' },
  correctness: { label: 'Correctness', question: 'Can each value be re-derived from its source?' },
  provenance: {
    label: 'Provenance',
    question: 'Does every row say where it came from, with a date?',
  },
  freshness: { label: 'Freshness', question: 'Was it checked within its declared age?' },
  links: { label: 'Link health', question: 'Do the source links still resolve?' },
  consistency: { label: 'Consistency', question: 'Does the same fact agree across datasets?' },
};

export type Rule = string | { na: string };

export interface QualityDataset {
  id: string;
  label: string;
  /** Where it lives: committed files, or a database table. */
  files: string[];
  /** The page a reader sees it on. */
  page: string;
  freshness: { datasets?: string[]; feeds?: FeedId[] };
  criteria: Record<CriterionId, Rule>;
}

const LINKS =
  'Every source URL the rows cite answers without a 4xx, 5xx or timeout after three tries; a publisher refusing robots (401/403/429) is reported apart, not counted as broken.';

export const QUALITY_DATASETS: readonly QualityDataset[] = [
  {
    id: 'producers',
    label: 'Producer and holder rows',
    files: ['config/substrata-coverage.ts', 'config/substrata-participants.ts'],
    page: '/bottlenecks',
    freshness: {},
    criteria: {
      completeness: 'Every bottleneck has at least one maker row with a primary source.',
      correctness: {
        na: 'A producer row links its source but stores no sentence to re-find on it, so it cannot be re-derived mechanically yet. Dependencies, events and series do store one.',
      },
      provenance:
        'Every producer, holder and directory row links a primary source; every non-material chokepoint cites a source for why it binds.',
      freshness: {
        na: 'Rows carry no read date — git dates the commit, not the reading. A gap: adding readOn per row would make this measurable.',
      },
      links: LINKS,
      consistency:
        'A mining row agrees with USGS: its country produces the resource (Mineral Commodity Summaries), and the company is named in that country’s Minerals Yearbook table.',
    },
  },
  {
    id: 'listings',
    label: 'Tickers and listings',
    files: ['research/listings.json'],
    page: '/exposure',
    freshness: { datasets: ['listings'] },
    criteria: {
      completeness:
        'Every company with a Markets page has a listing row, and every listed company has a primary line.',
      correctness:
        'Every SEC line’s CIK still carries that ticker in the SEC ticker file; every FIGI still maps to the recorded ticker and exchange at OpenFIGI.',
      provenance: 'Every line carries its FIGI or CIK and a link to that record.',
      freshness: 'Every row was re-validated within the dataset’s maximum age.',
      links: LINKS,
      consistency:
        'Pinned home lines agree with the file, and no two companies claim the same security.',
    },
  },
  {
    id: 'series',
    label: 'Key-number series (corpus)',
    files: ['research/series.json'],
    page: '/data/series',
    freshness: { datasets: ['series-quotes'] },
    criteria: {
      completeness: 'Every bottleneck binding now has at least one key-number series.',
      correctness:
        'Each quoted sentence states the value its point records, and is still on the source page.',
      provenance:
        'Every point has a source URL, a verbatim quote, the publisher and its publication date.',
      freshness: 'Each series’ quotes were re-read within the declared maximum age.',
      links: LINKS,
      consistency: 'Every series belongs to a bottleneck that exists.',
    },
  },
  {
    id: 'official-series',
    label: 'Official statistics (BLS)',
    files: ['config/substrata-official-series.ts', 'research_series_points'],
    page: '/data/series?origin=official',
    freshness: { feeds: ['series'] },
    criteria: {
      completeness: 'Every declared series has points in the database.',
      correctness: {
        na: 'Values are the agency’s API response stored as published, re-fetched daily; a revision overwrites the value.',
      },
      provenance: 'Every series names its BLS series id, which is its source link.',
      freshness: 'The daily fetch ran within its schedule.',
      links: LINKS,
      consistency: 'Every official series belongs to a bottleneck that exists.',
    },
  },
  {
    id: 'claims',
    label: 'Claims checked against series',
    files: ['research/claims.json'],
    page: '/data',
    freshness: { datasets: ['claims'] },
    criteria: {
      completeness: {
        na: 'There is no list of every quantitative sentence in the corpus to measure against yet.',
      },
      correctness: {
        na: 'A claim’s correctness is its series agreeing with it — measured under consistency.',
      },
      provenance: 'Every claim has a verdict and says how it was checked.',
      freshness: 'Claims were re-checked within the declared maximum age.',
      links: { na: 'Claims cite series, whose links are checked under Series.' },
      consistency:
        'Each claim’s sentence is still in its file, on a real bottleneck, against series that exist.',
    },
  },
  {
    id: 'dependencies',
    label: 'Dependencies (what needs what)',
    files: ['config/substrata-dependencies.ts'],
    page: '/xray',
    freshness: {},
    criteria: {
      completeness: 'Every bottleneck binding now is joined to at least one dependent or input.',
      correctness: 'The quoted sentence is still on the source page.',
      provenance: 'Every row has a source URL, a verbatim sentence and a read date.',
      freshness: 'Every row was read within 180 days.',
      links: LINKS,
      consistency: 'Both ends name an existing bottleneck or directory company.',
    },
  },
  {
    id: 'events',
    label: 'Accepted events',
    files: ['config/substrata-events.ts', 'config/substrata-events-accepted.json'],
    page: '/events',
    freshness: {},
    criteria: {
      completeness: {
        na: 'The universe of events is open; what is found and not yet read is the review queue, measured on /data/freshness.',
      },
      correctness: 'The quoted sentence is still on the source page.',
      provenance:
        'Every event has a source URL, a quoted sentence, its date and the date it was accepted.',
      freshness: { na: 'An event is dated when it happened; it does not go stale.' },
      links: LINKS,
      consistency:
        'Events name existing bottlenecks and companies, and happened before they were accepted.',
    },
  },
  {
    id: 'usgs-mcs',
    label: 'World production and reserves (USGS MCS)',
    files: ['research/usgs-mcs.json'],
    page: '/atlas',
    freshness: { datasets: ['usgs-mcs'] },
    criteria: {
      completeness:
        'Every resource the atlas names has a world table (USGS or EIA), or its absence is declared.',
      correctness:
        'Countries add up to the printed world total, and every value is on its country’s row in the chapter PDF.',
      provenance:
        'Every value keeps the text it was printed as, and its table names its source and unit.',
      freshness: 'The edition was read within its declared maximum age.',
      links: LINKS,
      consistency: 'Every country row maps to an ISO country code and a known resource.',
    },
  },
  {
    id: 'eia-energy',
    label: 'Oil, gas, coal and hydro (EIA)',
    files: ['research/eia-energy.json'],
    page: '/atlas',
    freshness: { datasets: ['eia-energy'] },
    criteria: {
      completeness: {
        na: 'Checking against EIA’s full country list needs the bulk file; the script keeps every country EIA reports a value for.',
      },
      correctness: 'No country produces more than the world total EIA prints.',
      provenance:
        'Every value keeps the text it was printed as, and its table names its source and unit.',
      freshness: 'The bulk file was read within its declared maximum age.',
      links: LINKS,
      consistency: 'Every country row maps to an ISO country code and a known resource.',
    },
  },
  {
    id: 'usgs-producers',
    label: 'Producers per country (USGS Minerals Yearbook)',
    files: ['research/usgs-producers.json'],
    page: '/atlas',
    freshness: { datasets: ['usgs-producers'] },
    criteria: {
      completeness: 'Every facility names its operating company.',
      correctness:
        'Every company and location is a whole cell of the workbook, not a fragment of a wrapped line or a ditto mark.',
      provenance: 'Every facility comes from a dated Yearbook table with its workbook link.',
      freshness: 'The chapters were read within the declared maximum age.',
      links: LINKS,
      consistency: 'Every facility maps to a country code and a resource the site tracks.',
    },
  },
  {
    id: 'oecd-restrictions',
    label: 'Export restrictions (OECD)',
    files: ['research/oecd-export-restrictions.json'],
    page: '/atlas',
    freshness: { datasets: ['oecd-export-restrictions'] },
    criteria: {
      completeness: 'Every measure has the date it took effect.',
      correctness: {
        na: 'Re-deriving each measure means re-querying the SDMX API; the refresh script does that, not the scheduled check.',
      },
      provenance: 'Every measure names its legal instrument or legal basis.',
      freshness: 'The inventory was read within its declared maximum age.',
      links: LINKS,
      consistency: 'Every measure names a real country code and a resource the site tracks.',
    },
  },
  {
    id: 'sanctions',
    label: 'Sanctions regimes (EU, OFAC)',
    files: ['research/sanctions.json'],
    page: '/atlas',
    freshness: { datasets: ['sanctions'] },
    criteria: {
      completeness: {
        na: 'The UK publishes no machine-readable list per regime; that gap is declared in the file.',
      },
      correctness: {
        na: 'Re-deriving regimes means re-reading the EU map API; the refresh script does that.',
      },
      provenance: 'Every regime or programme has a title and a link to its official page.',
      freshness: 'Read within 60 days: regimes are amended every few weeks.',
      links: LINKS,
      consistency: 'Every regime is attached to a real country code.',
    },
  },
  {
    id: 'science',
    label: 'Science: readiness entries and the feed',
    files: ['config/substrata-science.ts', 'research_science_items'],
    page: '/science',
    freshness: { feeds: ['science'] },
    criteria: {
      completeness: 'Every bottleneck has at least one paper, preprint or grant in the feed.',
      correctness: {
        na: 'Feed items are machine-collected and labelled unreviewed on every page; readiness is a dated judgement.',
      },
      provenance: 'Every readiness entry cites a source; every feed item has a link and a date.',
      freshness: 'Readiness was judged within 90 days, and the feed ran on schedule.',
      links: LINKS,
      consistency: 'Every entry relieves a bottleneck that exists.',
    },
  },
  {
    id: 'jobs',
    label: 'Jobs and the boards they come from',
    files: ['research/job-boards.json', 'research_jobs'],
    page: '/careers',
    freshness: { datasets: ['job-boards'], feeds: ['jobs'] },
    criteria: {
      completeness: 'Every company with a Markets page has a job-board row.',
      correctness: {
        na: 'A role is shown as its board returns it; a role gone from its board is closed on the next run.',
      },
      provenance: 'Every board row says how it was found; every open role links its posting.',
      freshness: 'Every open role was still on its board within the last three days.',
      links: LINKS,
      consistency: 'Every open role belongs to a directory company.',
    },
  },
  {
    id: 'learning-paths',
    label: 'Training and learning paths',
    files: ['research/learning-paths.json'],
    page: '/learn',
    freshness: { datasets: ['learning-paths'] },
    criteria: {
      completeness: { na: 'There is no list of every programme to measure against.' },
      correctness: { na: 'Programme details are read from the provider page by a person.' },
      provenance: 'Every path links its provider page and says when it was checked.',
      freshness: 'Checked within the declared maximum age.',
      links: LINKS,
      consistency: { na: 'No other dataset states the same facts.' },
    },
  },
];

export function qualityDataset(id: string): QualityDataset | undefined {
  return QUALITY_DATASETS.find((d) => d.id === id);
}
