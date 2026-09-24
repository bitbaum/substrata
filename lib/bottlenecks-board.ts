/**
 * The board's order and its list spec: how bottlenecks are ranked by default
 * and what a reader can narrow them by.
 */

import type { ListSpec } from 'listkit';

import { NODE_TYPE_LABEL } from '@/config/substrata-coverage';
import type { Horizon } from '@/config/substrata-assessment';
import { INDUSTRIES, TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { STAGES, type StageId } from '@/config/substrata-stages';
import type { Bottleneck } from './bottlenecks-build';

const STAGE_ORDER: Record<StageId, number> = Object.fromEntries(
  STAGES.map((stage, index) => [stage.id, index]),
) as Record<StageId, number>;

const HORIZON_ORDER: Record<Horizon, number> = { now: 0, 'two-years': 1, beyond: 2 };

/** Stage order, then hardest-binding first, then soonest, then name. */
export function compareBottlenecks(a: Bottleneck, b: Bottleneck): number {
  return (
    STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
    b.binding - a.binding ||
    HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon] ||
    a.name.localeCompare(b.name)
  );
}

/** What the board can be narrowed by. Empty selection is the whole board. */
export const BOARD_SPEC: ListSpec<Bottleneck> = {
  facets: [
    { key: 'stage', kind: 'one', value: (b) => b.stage, options: STAGES.map((s) => s.id) },
    {
      key: 'horizon',
      kind: 'one',
      value: (b) => b.horizon,
      options: ['now', 'two-years', 'beyond'],
    },
    {
      key: 'state',
      kind: 'one',
      value: (b) => b.state,
      options: ['sourced', 'candidate', 'unverified'],
    },
    {
      key: 'tech',
      kind: 'many',
      value: (b) => b.technologies,
      options: TECHNOLOGIES.map((t) => t.id),
    },
    {
      key: 'industry',
      kind: 'many',
      value: (b) => b.industries,
      options: INDUSTRIES.map((i) => i.id),
    },
    {
      key: 'kind',
      kind: 'many',
      value: (b) => b.kind,
      options: Object.keys(NODE_TYPE_LABEL),
    },
  ],
  search: {
    text: (b) => [b.name, b.plain, b.why, ...b.jurisdictions, ...b.producers.map((p) => p.name)],
  },
  sorts: [
    {
      key: 'stage',
      by: [
        (b) => STAGE_ORDER[b.stage],
        (b) => -b.binding,
        (b) => HORIZON_ORDER[b.horizon],
        (b) => b.name,
      ],
    },
    { key: 'binding', by: [(b) => -b.binding, (b) => HORIZON_ORDER[b.horizon], (b) => b.name] },
    { key: 'name', by: [(b) => b.name] },
  ],
  defaultSort: 'stage',
  defaultPageSize: 100,
};
