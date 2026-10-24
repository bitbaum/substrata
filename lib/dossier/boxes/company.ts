/**
 * A company's dossier: eight boxes.
 */
import type { BoxDefinition } from '../definitions';
import { RUN, SOURCE, byPerson, writeTo } from './shared';

/**
 * Every producer row the company has must carry a source (the box carries
 * `expected`); one sourced row is enough for a firm that makes one thing.
 */
export const MAKES_FULL = 1;

/** Three named sites: a producer with one plant is thin until its other sites are checked. */
export const LOCATIONS_FULL = 3;

/**
 * Owners are full when control is known: stated stakes sum to a majority, or
 * (for a widely held listed firm, where no holder reaches that) at least
 * three holders from the filing's notifiable-holder list, which says the list
 * was read rather than one name lifted from a news story.
 */
export const OWNERS_FULL = 1;
export const OWNERS_CONTROL_SHARE = 50;
export const OWNERS_LISTED_HOLDERS = 3;

/** Three named customers or suppliers: concentration questions start at the top three. */
export const COUNTERPARTIES_FULL = 3;

/**
 * Filings are full when a machine-readable filing index is known (an SEC
 * registrant id) or the firm is stated to be private — then "no public
 * filings" is itself the answer.
 */
export const FILINGS_FULL = 1;
export const FILINGS_CORE = 1;

/** Three stated risk events (outages, policy actions against it). */
export const RISKS_FULL = 3;

/** Three dated events naming the company. */
export const COMPANY_EVENTS_FULL = 3;

const counterparty = (type: 'customers' | 'suppliers'): Record<string, unknown> => ({
  from: type === 'customers' ? 'company:example-producer' : 'company:example-buyer',
  to: type === 'customers' ? 'company:example-buyer' : 'company:example-producer',
  type: 'supplies',
  asOf: '2025',
  evidence: [
    {
      source: 'https://www.sec.gov/edgar/search/',
      quote: SOURCE.shapeOnly,
      readOn: '2026-10-24',
    },
  ],
});

const FILING_SOURCES = [
  '10-K customers over 10% of revenue, 20-F related parties',
  'offtake, royalty or supply agreement announced on an exchange feed',
  'NI 43-101 or JORC report (mines)',
  'the counterparty’s own filing naming the company',
] as const;

export const COMPANY_BOXES: readonly BoxDefinition[] = [
  {
    id: 'makes',
    kind: 'company',
    label: 'What it makes',
    question: 'Which tracked materials or parts does it make, with a source for each?',
    unit: 'sourced producer row',
    units: 'sourced producer rows',
    thresholds: { full: MAKES_FULL, thin: 1 },
    allowedSources: [
      'company product or operations page',
      'annual report, segment note',
      'exchange filing',
      'agency table naming the producer (USGS, EIA)',
    ],
    writeTo: writeTo('producers'),
    example: {
      evidence: 'candidate',
      asOf: '2025',
      source: {
        url: 'https://lynasrareearths.com/',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      material: 'Didymium (Nd-Pr) metal, magnet feed',
      name: 'Lynas Rare Earths',
      jurisdictions: ['AU', 'MY'],
      role: 'refine',
    },
  },
  {
    id: 'locations',
    kind: 'company',
    label: 'Where',
    question: 'Which sites does it operate, and where are they?',
    unit: 'named site',
    units: 'named sites',
    thresholds: { full: LOCATIONS_FULL, thin: 1 },
    allowedSources: [
      'USGS Minerals Yearbook, country chapter (operator column)',
      'company technical report (NI 43-101 or JORC)',
      'annual report, list of operations',
      'national mining cadastre',
    ],
    writeTo: writeTo('facilities'),
    example: {
      evidence: 'candidate',
      asOf: '2025',
      source: {
        url: 'https://lynasrareearths.com/',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      id: 'lynas-kalgoorlie',
      name: 'Kalgoorlie Rare Earths Processing Facility',
      kind: 'plant',
      place: 'au',
      where: 'Kalgoorlie, Western Australia',
      operator: null,
      makes: ['didymium-nd-pr-metal-magnet-feed'],
      what: 'Cracking and leaching plant feeding the Malaysian separation plant.',
      primary: true,
    },
  },
  {
    id: 'owners',
    kind: 'company',
    label: 'Owners',
    question: 'Who owns it, and with what stake?',
    unit: 'stated holder',
    units: 'stated holders',
    thresholds: { full: OWNERS_FULL, thin: 1, core: 1 },
    coreNeed: `stakes summing to ${OWNERS_CONTROL_SHARE}% or ${OWNERS_LISTED_HOLDERS} holders from a listed firm’s notifiable-holder list`,
    allowedSources: [
      'annual report, major shareholders',
      'GLEIF LEI relationship record (parent)',
      'company registry (Companies House, national register)',
      'exchange filing (13D/13G, holder notifications)',
    ],
    writeTo: writeTo('ownership'),
    relations: [{ types: ['owns'], direction: 'in' }],
    example: {
      evidence: 'candidate',
      asOf: '2025-02-26',
      source: {
        url: 'https://www.sec.gov/Archives/edgar/data/937966/000093796625000011/a2024annualreportbasedon.htm',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      company: 'asml',
      status: 'listed',
      name: 'Capital Research and Management',
      share: 10.33,
      kind: 'fund',
    },
  },
  {
    id: 'customers',
    kind: 'company',
    label: 'Customers',
    question: 'Who buys from it?',
    unit: 'named customer',
    units: 'named customers',
    thresholds: { full: COUNTERPARTIES_FULL, thin: 1 },
    allowedSources: FILING_SOURCES,
    writeTo: writeTo('relations'),
    relations: [
      { types: ['supplies', 'ships_to'], direction: 'out' },
      { types: ['buys_from'], direction: 'in' },
    ],
    noSourceYet: true,
    example: counterparty('customers'),
  },
  {
    id: 'suppliers',
    kind: 'company',
    label: 'Suppliers',
    question: 'From whom does it buy its inputs?',
    unit: 'named supplier',
    units: 'named suppliers',
    thresholds: { full: COUNTERPARTIES_FULL, thin: 1 },
    allowedSources: FILING_SOURCES,
    writeTo: writeTo('relations'),
    relations: [
      { types: ['buys_from'], direction: 'out' },
      { types: ['supplies', 'ships_to'], direction: 'in' },
    ],
    noSourceYet: true,
    example: counterparty('suppliers'),
  },
  {
    id: 'filings',
    kind: 'company',
    label: 'Filings',
    question: 'Where are its filings, or is it stated to be private?',
    unit: 'listing reference',
    units: 'listing references',
    thresholds: { full: FILINGS_FULL, thin: 1, core: FILINGS_CORE },
    coreNeed: 'an SEC registrant id, or a stated private status',
    allowedSources: [
      'SEC EDGAR company search (free, descriptive user agent)',
      'OpenFIGI security record',
      'exchange listing page (ASX, SEDAR+, KASE, LSE RNS)',
      'company investor-relations page',
    ],
    writeTo: byPerson(
      'research/listings.json',
      'pnpm run research:listings (overrides in config/substrata-listing-overrides.ts)',
    ),
    example: {
      status: 'listed',
      primary: {
        ticker: 'ASML',
        exchange: 'NA',
        name: 'ASML HOLDING NV',
        source: 'https://www.openfigi.com/id/BBG000C1HT47',
      },
      us: {
        ticker: 'ASML',
        exchange: 'Nasdaq',
        name: 'ASML HOLDING NV',
        cik: 937966,
        source: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=937966',
      },
    },
  },
  {
    id: 'risks',
    kind: 'company',
    label: 'Risks',
    question: 'What has gone wrong or been imposed on it, as stated by a source?',
    unit: 'stated risk event',
    units: 'stated risk events',
    thresholds: { full: RISKS_FULL, thin: 1 },
    allowedSources: [
      'risk-factor section of an annual report',
      'regulator or sanctions list naming the company',
      'company announcement of an outage or force majeure',
      'export-control or licence notice naming it',
    ],
    writeTo: writeTo('events'),
    example: { ...SOURCE.eventExample, kind: 'outage', effect: 'tightens' },
  },
  {
    id: 'events',
    kind: 'company',
    label: 'Events',
    question: 'What has happened to it, dated and sourced?',
    unit: 'dated event',
    units: 'dated events',
    thresholds: { full: COMPANY_EVENTS_FULL, thin: 1 },
    allowedSources: [
      'company announcement or exchange filing',
      'regulator press release',
      'agency report',
      'wire report quoting one of the above',
    ],
    writeTo: writeTo('events'),
    example: SOURCE.eventExample,
  },
];
