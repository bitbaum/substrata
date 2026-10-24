/**
 * A research front's dossier (`science:<id>`, config/substrata-science.ts):
 * four boxes. This was the lab dossier's stand-in until labs became an entity
 * kind (./lab.ts); it is kept as it was for the fronts, whose rows are
 * science entries rather than labs. The thresholds are the lab's.
 */
import type { BoxDefinition } from '../definitions';
import { FUNDING_FULL, JOIN_FULL, WHERE_FULL, WORKS_ON_FULL } from './lab';
import { RUN, SOURCE, byPerson, writeTo } from './shared';

export const SCIENCE_BOXES: readonly BoxDefinition[] = [
  {
    id: 'works_on',
    kind: 'science',
    label: 'What it works on',
    question: 'What does it work on, and which bottleneck would that relieve?',
    unit: 'sourced line of work',
    units: 'sourced lines of work',
    thresholds: { full: WORKS_ON_FULL, thin: 1 },
    allowedSources: [
      'peer-reviewed paper',
      'lab or university page',
      'grant award abstract',
      'company pilot announcement',
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
  {
    id: 'where',
    kind: 'science',
    label: 'Where',
    question: 'Which institutions and countries does the work happen in?',
    unit: 'stated place',
    units: 'stated places',
    thresholds: { full: WHERE_FULL, thin: 1 },
    allowedSources: [
      'paper affiliation line',
      'grant award record (awardee, country)',
      'Wikidata item with an official website',
    ],
    writeTo: writeTo('relations'),
    relations: [{ types: ['researches'], direction: 'in' }],
    noSourceYet: true,
    example: {
      from: 'company:example-institute',
      to: 'science:example-recovery-route',
      type: 'researches',
      asOf: '2025',
      evidence: [
        { source: 'https://www.example.edu/', quote: SOURCE.shapeOnly, readOn: '2026-10-24' },
      ],
    },
  },
  {
    id: 'how_to_join',
    kind: 'science',
    label: 'How to join',
    question: 'How does someone get to work on it?',
    unit: 'way in',
    units: 'ways in',
    thresholds: { full: JOIN_FULL, thin: 1 },
    allowedSources: [
      'vacancy board (Greenhouse, Lever, Ashby, university jobs)',
      'fellowship or doctoral programme page',
      'funder call for proposals',
    ],
    writeTo: byPerson(
      'research/job-boards.json',
      'a person adds the board; the careers sweep reads it',
    ),
    noSourceYet: true,
    example: { careersUrl: 'https://www.example.edu/jobs', ats: 'greenhouse', board: 'example' },
  },
  {
    id: 'funding',
    kind: 'science',
    label: 'Funding',
    question: 'Who pays for it?',
    unit: 'stated funder',
    units: 'stated funders',
    thresholds: { full: FUNDING_FULL, thin: 1 },
    allowedSources: [
      'grant award record (NSF, CORDIS via OpenAIRE, DOE via USAspending)',
      'paper acknowledgement',
      'funder press release',
    ],
    writeTo: writeTo('relations'),
    relations: [{ types: ['finances'], direction: 'in' }],
    noSourceYet: true,
    example: {
      from: 'capital:example-funder',
      to: 'science:example-recovery-route',
      type: 'finances',
      asOf: '2025',
      evidence: [
        {
          source: 'https://www.nsf.gov/awardsearch/',
          quote: SOURCE.shapeOnly,
          readOn: '2026-10-24',
        },
      ],
    },
  },
];
