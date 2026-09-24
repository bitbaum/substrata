/**
 * Markets: the organisations in the chain, and what each one actually makes.
 *
 * Two files describe companies for different reasons. `substrata-participants`
 * grades roughly a hundred organisations by how hard they are to replace, ore
 * to buyer. `substrata-coverage` lists, per material, the firms that make it,
 * each row separately verified. A reader does not care about that split: they
 * want one page per organisation showing what it makes, how well that is
 * evidenced, and what has happened to it.
 *
 * This module is that join. Two honesty rules it keeps:
 *
 *   1. A directory row's SCARCITY GRADE is always a judgement, never a
 *      finding, however well the row is sourced — grading how hard a company
 *      is to replace is analysis, not a fact a citation can settle. Every row
 *      started at `source: null`; a 2026-09 pass sourced all of them (each
 *      row now cites the company's own page for its role in the chain), and
 *      the pages say exactly that: the company's existence and role are
 *      sourced, the grade next to it is still this project's judgement.
 *   2. A producer row's verification comes from the coverage file and the
 *      evidence file, exactly as it does on a bottleneck page — the same fact
 *      cannot read differently in two places.
 *
 * Created: 2026-09-15
 */

import type { ListSpec } from 'listkit';

import {
  CHAIN_LAYERS,
  PARTICIPANTS,
  SCARCITY_LABEL,
  type ChainLayer,
  type Participant,
  type ScarcityGrade,
} from '@/config/substrata-participants';
import { slugify } from '@/lib/links';
import { buildMarketParticipants, type MarketParticipant } from './participants-build';

export type { MarketParticipant, Produces } from './participants-build';

export const MARKET_PARTICIPANTS: readonly MarketParticipant[] = buildMarketParticipants();

const BY_SLUG = new Map(MARKET_PARTICIPANTS.map((p) => [p.slug, p]));

/**
 * Whether an organisation named anywhere on the site has a page under Markets.
 *
 * Matched on the slug, not the name. Policy records a proponent as
 * "thyssenkrupp Electrical Steel" and the directory carries "ThyssenKrupp
 * Electrical Steel"; an exact-name lookup calls that a miss and silently
 * renders the one lobbying record on the site as unlinkable plain text.
 */
export function hasMarketPage(nameOrSlug: string): boolean {
  return BY_SLUG.has(slugify(nameOrSlug));
}

export function participantBySlug(slug: string): MarketParticipant | undefined {
  return BY_SLUG.get(slug);
}

/** Everyone who makes a given bottleneck, in coverage order. */
export function makersOf(bottleneck: string): MarketParticipant[] {
  return MARKET_PARTICIPANTS.filter((p) => p.produces.some((x) => x.bottleneck === bottleneck));
}

export const MARKET_SPEC: ListSpec<MarketParticipant> = {
  facets: [
    {
      key: 'layer',
      kind: 'one',
      value: (p) => p.layer,
      options: CHAIN_LAYERS.map((l) => l.id),
    },
    {
      key: 'grade',
      kind: 'one',
      value: (p) => p.scarcity ?? '',
      options: ['chokepoint', 'concentrated', 'competitive'],
    },
    {
      key: 'industry',
      kind: 'many',
      value: (p) => p.industries,
      options: [
        'semiconductors',
        'power-grid',
        'mining-materials',
        'gases-chemicals',
        'data-centres',
        'machinery',
      ],
    },
    {
      key: 'where',
      kind: 'many',
      value: (p) => p.jurisdictions,
    },
  ],
  search: {
    text: (p) => [
      p.name,
      p.role ?? '',
      p.why ?? '',
      ...p.jurisdictions,
      ...p.produces.map((x) => x.bottleneck),
    ],
  },
  sorts: [
    { key: 'chain', by: [(p) => p.name] },
    { key: 'name', by: [(p) => p.name] },
    { key: 'makes', by: [(p) => -p.produces.length, (p) => p.name] },
  ],
  defaultSort: 'chain',
  defaultPageSize: 250,
};

export interface MarketTotals {
  organisations: number;
  graded: number;
  chokepoints: number;
  withProducerRows: number;
  /** Directory rows whose existence and role are backed by a source. */
  existenceVerified: number;
  jurisdictions: number;
}

export function marketTotals(): MarketTotals {
  return {
    organisations: MARKET_PARTICIPANTS.length,
    graded: MARKET_PARTICIPANTS.filter((p) => p.scarcity !== null).length,
    chokepoints: MARKET_PARTICIPANTS.filter((p) => p.scarcity === 'chokepoint').length,
    withProducerRows: MARKET_PARTICIPANTS.filter((p) => p.produces.length > 0).length,
    existenceVerified: MARKET_PARTICIPANTS.filter((p) => p.existenceVerifiedBy !== null).length,
    jurisdictions: new Set(MARKET_PARTICIPANTS.flatMap((p) => p.jurisdictions)).size,
  };
}

export { SCARCITY_LABEL };

// Views over the raw directory in config/substrata-participants.ts.

export interface ParticipantProgress {
  total: number;
  sourced: number;
  chokepoints: number;
  concentrated: number;
  competitive: number;
  jurisdictions: number;
}

export function participantProgress(): ParticipantProgress {
  const grade = (g: ScarcityGrade) => PARTICIPANTS.filter((item) => item.scarcity === g).length;
  return {
    total: PARTICIPANTS.length,
    sourced: PARTICIPANTS.filter((item) => item.source !== null).length,
    chokepoints: grade('chokepoint'),
    concentrated: grade('concentrated'),
    competitive: grade('competitive'),
    jurisdictions: new Set(PARTICIPANTS.flatMap((item) => item.jurisdictions)).size,
  };
}

/** Participants in one layer, in the order they were written. */
export function participantsInLayer(layer: ChainLayer): Participant[] {
  return PARTICIPANTS.filter((item) => item.layer === layer);
}

/** Every participant graded a hard constraint — the point of the exercise. */
export function bindingParticipants(): Participant[] {
  return PARTICIPANTS.filter((item) => item.scarcity === 'chokepoint');
}
