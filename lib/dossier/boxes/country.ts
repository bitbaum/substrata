/**
 * A country's dossier: seven boxes. Thresholds are named so a change is a
 * reviewed edit with its reason beside it.
 */
import type { BoxDefinition } from '../definitions';
import { LAB_BOXES } from './lab';
import { RUN, SOURCE, writeTo } from './shared';

/**
 * Every resource the directory names for the country must be measured by a
 * table before the box is full (the box carries `expected`), so one measured
 * row is enough only for a single-resource country. Niger led with oil at
 * 0.1% while the directory said uranium; this is what makes that gap visible.
 */
export const ENDOWMENT_FULL = 1;

/**
 * A USGS Minerals Yearbook "structure of the mineral industry" table for a
 * small producer runs to roughly five to fifteen rows. Ten means the table (or
 * a cadastre) has actually been read, not that one site was noticed.
 */
export const FACILITIES_FULL = 10;

/**
 * Five distinct named operators: enough that the companies box names more than
 * the one champion a news story mentions, few enough for a one-mine country.
 */
export const COMPANIES_FULL = 5;

/**
 * Three rules (instruments it issues, export measures it applies), one of
 * which must be how it licenses extraction or processing: a country with
 * twenty export measures and no mining code on record is not covered.
 */
export const LAW_FULL = 3;
export const LAW_CORE = 1;

/** Three named counterparties: the top destinations of the leading export, as customs tables print them. */
export const TRADE_FULL = 3;

/** Five dated events: about a year of news for a producer that matters. */
export const COUNTRY_EVENTS_FULL = 5;

/** Three labs or people: a field, not one name. */
export const PEOPLE_FULL = 3;

export const COUNTRY_BOXES: readonly BoxDefinition[] = [
  {
    id: 'endowment_output',
    kind: 'country',
    label: 'Endowment and output',
    question: 'What does it hold and produce, measured by a table?',
    unit: 'measured resource',
    units: 'measured resources',
    thresholds: { full: ENDOWMENT_FULL, thin: 1 },
    allowedSources: [
      'USGS Mineral Commodity Summaries, commodity table',
      'World Nuclear Association or IAEA Red Book (uranium)',
      'EIA International Energy Statistics (oil, gas, coal, power)',
      'national geological survey or statistics office yearbook',
    ],
    writeTo: writeTo('endowments'),
    example: {
      evidence: 'candidate',
      asOf: '2022',
      source: {
        url: 'https://world-nuclear.org/information-library/nuclear-fuel-cycle/mining-of-uranium/world-uranium-mining-production',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      material: 'uranium-conversion-and-enrichment',
      stage: 'mine',
      describes: 'uranium mined, tonnes U',
      place: 'ne',
      production: { value: 2020, unit: 't', year: 2022, basis: 'reported' },
    },
  },
  {
    id: 'facilities',
    kind: 'country',
    label: 'Facilities',
    question: 'Which mines, plants and refineries are there, and where?',
    unit: 'facility row',
    units: 'facility rows',
    thresholds: { full: FACILITIES_FULL, thin: 1 },
    allowedSources: [
      'USGS Minerals Yearbook, country chapter (structure table)',
      'national mining cadastre or licence register',
      'company technical report (NI 43-101 or JORC)',
      'exchange filing naming the site',
    ],
    writeTo: writeTo('facilities'),
    example: {
      evidence: 'candidate',
      asOf: '2025',
      source: {
        url: 'https://www.kazatomprom.kz/en',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      id: 'inkai-mine',
      name: 'Inkai',
      kind: 'mine',
      place: 'kz',
      where: 'Turkestan region, south Kazakhstan',
      operator: null,
      makes: ['uranium-conversion-and-enrichment'],
      what: 'In-situ recovery uranium mine named by the operator with its annual output.',
      primary: true,
    },
  },
  {
    id: 'companies',
    kind: 'country',
    label: 'Companies',
    question: 'Who operates there?',
    unit: 'named operator',
    units: 'named operators',
    thresholds: { full: COMPANIES_FULL, thin: 1 },
    allowedSources: [
      'USGS Minerals Yearbook, country chapter (operator column)',
      'company annual report or exchange filing',
      'national mining cadastre (licence holder)',
      'GLEIF LEI record',
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
    id: 'law_licensing',
    kind: 'country',
    label: 'Law and licensing',
    question: 'How does it license extraction, and what exports does it hold back?',
    unit: 'rule on record',
    units: 'rules on record',
    thresholds: { full: LAW_FULL, thin: 1, core: LAW_CORE },
    coreNeed: 'how it licenses extraction or processing (a licence regime, permit or procedure)',
    record:
      "one instrument per row, issued by this country: the subsoil or mining law that licenses extraction, a licence regime or permit for processing, or an export ban, quota, licence or duty on a mineral. Jurisdiction is the country's lower-case ISO2; the quote is a sentence from the law or the issuing body's page",
    allowedSources: [
      'the law, decree or order as published in the official gazette (subsoil or mining code, licensing regulation, export ban)',
      "the issuing ministry's or regulator's own page for the licence or the measure",
      'an OECD Inventory of Export Restrictions on Critical Raw Materials entry, recorded with the legal document it cites as the source',
      "a law firm's summary of the primary law, only as a secondary source: primary false, naming the law it summarises, and only where none of the above is reachable",
    ],
    writeTo: writeTo('instruments'),
    example: {
      evidence: 'candidate',
      asOf: '2023-12-21',
      source: {
        url: 'http://english.mofcom.gov.cn/',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      id: 'cn-graphite-export-licence',
      jurisdiction: 'cn',
      title: 'Export licence for graphite products',
      body: 'Ministry of Commerce',
      kind: 'licence-regime',
      status: 'in-force',
      date: '2023-12-01',
      effect: 'tightens',
      summary: 'Exports of listed graphite items need a licence from the ministry.',
      technologies: ['energy'],
      industries: ['mining-materials'],
      bottlenecks: [],
      primary: true,
      proponents: [],
    },
  },
  {
    id: 'trade',
    kind: 'country',
    label: 'Trade',
    question: 'Who buys what it ships, and from whom does it buy?',
    unit: 'named counterparty',
    units: 'named counterparties',
    thresholds: { full: TRADE_FULL, thin: 1 },
    allowedSources: [
      'UN Comtrade (free registration), by HS code',
      'national customs statistics',
      'USGS Minerals Yearbook, country chapter (trade section)',
      'company offtake or sales disclosure',
    ],
    writeTo: writeTo('relations'),
    relations: [
      { types: ['ships_to', 'supplies'], direction: 'out' },
      { types: ['buys_from'], direction: 'out' },
    ],
    noSourceYet: true,
    example: {
      from: 'country:kz',
      to: 'country:cn',
      type: 'ships_to',
      asOf: '2024',
      evidence: [
        { source: 'https://comtradeplus.un.org/', quote: SOURCE.shapeOnly, readOn: '2026-10-24' },
      ],
    },
  },
  {
    id: 'events',
    kind: 'country',
    label: 'Events',
    question: 'What has happened there that moves supply?',
    unit: 'dated event',
    units: 'dated events',
    thresholds: { full: COUNTRY_EVENTS_FULL, thin: 1 },
    allowedSources: [
      'government or regulator press release',
      'company announcement or exchange filing',
      'agency report (USGS, IEA, WNA)',
      'wire report quoting one of the above',
    ],
    writeTo: writeTo('events'),
    example: SOURCE.eventExample,
  },
  {
    id: 'people_labs',
    kind: 'country',
    label: 'People and labs',
    question: 'Who researches or trains people for this chain there?',
    unit: 'lab or person',
    units: 'labs or people',
    thresholds: { full: PEOPLE_FULL, thin: 1 },
    allowedSources: [
      'university or institute page',
      'national research funder award list',
      'paper or patent affiliation',
      'Wikidata item with an official website',
    ],
    // One lab row per lab (config/candidates/labs.json); `place` is the country.
    writeTo: writeTo('labs'),
    relations: [
      { types: ['employs', 'researches'], direction: 'in' },
      { types: ['employs', 'researches'], direction: 'out' },
    ],
    example: LAB_BOXES[0].example,
  },
];
