/**
 * A lab's dossier (`lab:<id>`, config/substrata-labs.ts): four boxes — what
 * it works on, where, how to join, funding. Research fronts keep the same four
 * boxes under their own kind (./science.ts), with these thresholds.
 *
 * A lab row (`add.ts labs`) fills the first three at once when its source
 * states them; funding is `finances` relations into the lab, one quote each.
 */
import type { BoxDefinition } from '../definitions';
import { RUN, SOURCE, writeTo } from './shared';

/** One sourced line of work: a lab is either stood up by a source or it is not. */
export const WORKS_ON_FULL = 1;

/** One stated place: a lab is somewhere. */
export const WHERE_FULL = 1;

/** One way in (a programme, a vacancy board, a fellowship) a reader can act on. */
export const JOIN_FULL = 1;

/** Two funders: one grant says it exists, two say someone keeps paying for it. */
export const FUNDING_FULL = 2;

const LAB_ROW = {
  evidence: 'candidate',
  asOf: '2025',
  source: { url: 'https://www.example.edu/', quote: SOURCE.shapeOnly, readOn: '2026-10-24' },
  submittedBy: RUN,
  id: 'example-institute-of-nuclear-physics',
  name: 'Example Institute of Nuclear Physics',
  type: 'institute',
  place: 'kz',
  where: 'Almaty',
  worksOn: [
    {
      bottleneck: 'Uranium conversion and enrichment',
      what: 'Studies in-situ recovery chemistry for uranium deposits.',
    },
  ],
  url: 'https://www.example.edu/',
  join: 'https://www.example.edu/jobs',
};

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
      'the lab or university page',
      'peer-reviewed paper',
      'grant award abstract',
      'national research funder award list',
    ],
    writeTo: writeTo('labs'),
    example: LAB_ROW,
  },
  {
    id: 'where',
    kind: 'lab',
    label: 'Where',
    question: 'Which country and city is it in?',
    unit: 'stated place',
    units: 'stated places',
    thresholds: { full: WHERE_FULL, thin: 1 },
    allowedSources: [
      'the lab or university page (address or contact page)',
      'paper affiliation line',
      'Wikidata item with an official website',
    ],
    writeTo: writeTo('labs'),
    example: LAB_ROW,
  },
  {
    id: 'how_to_join',
    kind: 'lab',
    label: 'How to join',
    question: 'How does someone get to work or study there?',
    unit: 'way in',
    units: 'ways in',
    thresholds: { full: JOIN_FULL, thin: 1 },
    allowedSources: [
      'vacancy board on its own site (Greenhouse, Lever, Ashby, university jobs)',
      'fellowship or doctoral programme page',
      'funder call for proposals',
    ],
    writeTo: writeTo('labs'),
    example: LAB_ROW,
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
      'the lab’s annual report',
      'paper acknowledgement',
      'funder press release',
    ],
    writeTo: writeTo('relations'),
    relations: [{ types: ['finances'], direction: 'in' }],
    example: {
      from: 'capital:example-funder',
      to: 'lab:example-institute-of-nuclear-physics',
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
