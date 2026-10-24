/**
 * What every kind's box file shares: where a facet's rows are written, and
 * the parts of a worked example that do not change from box to box.
 */
import type { Facet } from '@/lib/entry/candidate';
import type { WriteTo } from '../definitions';

const ADD = 'pnpm exec tsx scripts/research/add.ts';

/** The candidate path for a facet (`relations` is one: config/candidates/relations.json). */
export function writeTo(facet: Facet): WriteTo {
  return {
    facet,
    file: `config/candidates/${facet}.json`,
    command: `${ADD} ${facet} rows.json --dry-run`,
  };
}

/** A box no candidate file feeds: a person edits config, or a script regenerates a research file. */
export function byPerson(file: string, command: string): WriteTo {
  return { facet: null, file, command };
}

/** Who wrote an example row. A real row names the agent, model and run. */
export const RUN = { agent: 'data-agent', model: 'the-model-id', runId: 'run-0001' } as const;

export const SOURCE = {
  /**
   * Every worked example carries this in place of a quote. The examples show
   * the SHAPE of a good row; a quote is only ever copied from the page read.
   */
  shapeOnly: 'Shape only: copy the exact sentence or table cell from the page you read.',
  eventExample: {
    evidence: 'candidate',
    asOf: '2025-12-03',
    source: {
      url: 'https://www.coherent.com/news',
      quote: 'Shape only: copy the exact sentence or table cell from the page you read.',
      readOn: '2026-10-24',
    },
    submittedBy: RUN,
    id: '2025-12-03-example-capacity-announcement',
    date: '2025-12-03',
    headline: 'Producer announces new capacity for a tracked material',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Gallium, refined'],
    participants: [],
    jurisdictions: ['US'],
    primary: true,
  },
} as const;
