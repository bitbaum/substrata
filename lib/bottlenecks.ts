/**
 * The bottleneck — the one unit the portal shows.
 *
 * The research keeps materials and non-material chokepoints in two files
 * because they are verified differently: a material has producers, each
 * sourced or not; a machine, a process or a queue is one row. A reader does
 * not care about that split. They want every constraint on the path to
 * recursive self-improvement in one list, scannable, filterable by the stage
 * of the loop it sits on, scored, dated, and each one a click from its
 * evidence and its events. This module is that join, and the list spec that
 * drives the board.
 *
 * Created: 2026-09-14
 */

import { MANDATE_CURVES, type CurveId } from '@/config/substrata';
import { NODE_TYPE_LABEL } from '@/config/substrata-coverage';
import { VERIFICATION_LABEL } from '@/config/substrata-evidence';
import { chokepointBottlenecks, materialBottlenecks, type Bottleneck } from './bottlenecks-build';
import { compareBottlenecks } from './bottlenecks-board';

export { slugOf, type Bottleneck, type BottleneckProducer } from './bottlenecks-build';
export { BOARD_SPEC, compareBottlenecks } from './bottlenecks-board';

export const BOTTLENECKS: readonly Bottleneck[] = [
  ...materialBottlenecks(),
  ...chokepointBottlenecks(),
].sort(compareBottlenecks);

const BY_SLUG = new Map(BOTTLENECKS.map((b) => [b.slug, b]));
const BY_NAME = new Map(BOTTLENECKS.map((b) => [b.name, b]));

export function bottleneckBySlug(slug: string): Bottleneck | undefined {
  return BY_SLUG.get(slug);
}

export function bottleneckByName(name: string): Bottleneck | undefined {
  return BY_NAME.get(name);
}

export const CURVE_LABEL: Record<CurveId, string> = Object.fromEntries(
  MANDATE_CURVES.map((curve) => [curve.id, curve.label]),
) as Record<CurveId, string>;

export const KIND_LABEL = NODE_TYPE_LABEL;
export const STATE_LABEL = VERIFICATION_LABEL;

export interface PortalTotals {
  bottlenecks: number;
  bindingNow: number;
  producers: number;
  sourced: number;
  jurisdictions: number;
}

export function portalTotals(): PortalTotals {
  const producers = BOTTLENECKS.flatMap((b) => b.producers);
  return {
    bottlenecks: BOTTLENECKS.length,
    bindingNow: BOTTLENECKS.filter((b) => b.horizon === 'now').length,
    producers: producers.length,
    sourced: producers.filter((p) => p.verification === 'sourced').length,
    jurisdictions: new Set(BOTTLENECKS.flatMap((b) => b.jurisdictions)).size,
  };
}
