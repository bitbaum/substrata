/**
 * A raw resource's dossier (uranium, lithium, copper …): six boxes.
 */
import type { BoxDefinition } from '../definitions';
import { RUN, SOURCE, byPerson, writeTo } from './shared';

/**
 * Five producing countries in a world table, and at least one named facility
 * row: a share table says where, only a facility says who.
 */
export const PRODUCERS_FULL = 5;
export const PRODUCERS_CORE = 1;

/** Five countries with a stated reserve: the published tables list that many even for niche metals. */
export const RESERVES_FULL = 5;

/** Two uses: a resource feeding one tracked bottleneck only is a lead on its wider demand. */
export const USES_FULL = 2;

/** Two substitutes with a source: one candidate is a hope, two is a comparison. */
export const SUBSTITUTES_FULL = 2;

/** Three export measures: the OECD inventory's critical metals typically carry several. */
export const RESTRICTIONS_FULL = 3;

/** Two sourced science entries that would relieve what it feeds. */
export const SCIENCE_FULL = 2;

export const RESOURCE_BOXES: readonly BoxDefinition[] = [
  {
    id: 'producers',
    kind: 'resource',
    label: 'Producers',
    question: 'Which countries produce it, and which facilities?',
    unit: 'producing country',
    units: 'producing countries',
    thresholds: { full: PRODUCERS_FULL, thin: 1, core: PRODUCERS_CORE },
    coreNeed: 'one facility named with its operator',
    allowedSources: [
      'USGS Mineral Commodity Summaries, world production table',
      'World Nuclear Association or IAEA (uranium); EIA (energy)',
      'USGS Minerals Yearbook, country chapters (facilities)',
      'company annual report',
    ],
    writeTo: writeTo('endowments'),
    example: {
      evidence: 'candidate',
      asOf: '2024',
      source: {
        url: 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-helium.pdf',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      material: 'liquid-helium-he-4',
      stage: 'mine',
      describes: 'helium extracted from natural gas',
      place: 'qa',
      production: { value: 63, unit: 'Mcm', year: 2024, basis: 'estimated' },
    },
  },
  {
    id: 'reserves',
    kind: 'resource',
    label: 'Reserves',
    question: 'Where are the stated reserves?',
    unit: 'country with a stated reserve',
    units: 'countries with a stated reserve',
    thresholds: { full: RESERVES_FULL, thin: 1 },
    allowedSources: [
      'USGS Mineral Commodity Summaries, reserves column',
      'IAEA/NEA Red Book (uranium resources)',
      'national geological survey',
      'company reserve statement (JORC, NI 43-101)',
    ],
    writeTo: writeTo('endowments'),
    example: {
      evidence: 'candidate',
      asOf: '2024',
      source: {
        url: 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-helium.pdf',
        quote: SOURCE.shapeOnly,
        readOn: '2026-10-24',
      },
      submittedBy: RUN,
      material: 'liquid-helium-he-4',
      stage: 'mine',
      place: 'qa',
      reserves: { value: 10000, unit: 'Mcm', year: 2024, basis: 'estimated' },
    },
  },
  {
    id: 'uses',
    kind: 'resource',
    label: 'Uses',
    question: 'What does it go into on the path we track?',
    unit: 'tracked use',
    units: 'tracked uses',
    thresholds: { full: USES_FULL, thin: 1 },
    allowedSources: [
      'USGS Mineral Commodity Summaries, "Domestic production and use"',
      'industry association end-use breakdown',
      'agency outlook (IEA critical minerals)',
    ],
    writeTo: byPerson('config/substrata-resources.ts', 'a person adds RESOURCE_TO_BOTTLENECKS'),
    example: { resource: 'uranium', feeds: ['Uranium conversion and enrichment'] },
  },
  {
    id: 'substitutes',
    kind: 'resource',
    label: 'Substitutes',
    question: 'What could replace it, and what blocks that?',
    unit: 'sourced substitute',
    units: 'sourced substitutes',
    thresholds: { full: SUBSTITUTES_FULL, thin: 1 },
    allowedSources: [
      'USGS Mineral Commodity Summaries, "Substitutes"',
      'peer-reviewed review article',
      'company qualification announcement',
    ],
    writeTo: byPerson('config/substrata-substitutes.ts', 'a person adds a SUBSTITUTES row'),
    example: {
      material: 'gallium-refined',
      candidate: 'Silicon carbide in power devices',
      status: 'qualified for some uses',
      blockedBy: ['qualification'],
    },
  },
  {
    id: 'restrictions',
    kind: 'resource',
    label: 'Restrictions',
    question: 'Who holds back its exports, and how?',
    unit: 'export measure',
    units: 'export measures',
    thresholds: { full: RESTRICTIONS_FULL, thin: 1 },
    allowedSources: [
      'OECD Inventory of Export Restrictions on Critical Raw Materials',
      'national export-control notice',
      'EU and US sanctions lists',
    ],
    writeTo: byPerson('research/oecd-export-restrictions.json', 'pnpm run research:restrictions'),
    example: {
      iso2: 'cn',
      resource: 'gallium',
      measure: 'export licensing requirement',
      since: 2023,
    },
  },
  {
    id: 'science',
    kind: 'resource',
    label: 'Science',
    question: 'What research would relieve what it feeds?',
    unit: 'sourced science entry',
    units: 'sourced science entries',
    thresholds: { full: SCIENCE_FULL, thin: 1 },
    allowedSources: [
      'peer-reviewed paper',
      'national lab or university release',
      'grant award record (NSF, CORDIS, DOE)',
      'company pilot-plant announcement',
    ],
    writeTo: writeTo('science'),
    example: {
      evidence: 'candidate',
      asOf: '2025',
      source: { url: 'https://www.energy.gov/', quote: SOURCE.shapeOnly, readOn: '2026-10-24' },
      submittedBy: RUN,
      id: 'example-recovery-route',
      name: 'A new recovery route',
      front: 'energy',
      industries: ['mining-materials'],
      plain: 'Recovers the metal from a waste stream that is discarded today.',
      relieves: [
        { bottleneck: 'Gallium, refined', mechanism: 'adds supply outside the incumbent route' },
      ],
      readiness: 4,
      readinessWhy: 'Pilot results published; no plant yet.',
      nextMilestone: null,
    },
  },
];
