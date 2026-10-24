/**
 * A lab or person's dossier: four boxes.
 *
 * Labs and people are not an entity kind yet. Until they are, this dossier is
 * computed for the research fronts in config/substrata-science.ts
 * (`science:<id>`), the corpus's nearest thing: a line of work with a
 * readiness judgement. The boxes are the ones a lab will have, so nothing
 * changes here when the kind arrives except the subject list (../subjects.ts).
 */
import type { BoxDefinition } from '../definitions';
import { RUN, SOURCE, byPerson, writeTo } from './shared';

/** One sourced line of work: a front is either stood up by a source or it is not. */
export const WORKS_ON_FULL = 1;

/** One stated place: a lab is somewhere. */
export const WHERE_FULL = 1;

/** One way in (a programme, a vacancy board, a fellowship) a reader can act on. */
export const JOIN_FULL = 1;

/** Two funders: one grant says it exists, two say someone keeps paying for it. */
export const FUNDING_FULL = 2;

export const LAB_BOXES: readonly BoxDefinition[] = [
  {
    id: 'works_on',
    kind: 'lab',
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
    kind: 'lab',
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
    kind: 'lab',
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
    kind: 'lab',
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
