/**
 * The "worst right now" board — the most binding current constraints, and
 * which of them an event in the window moved — shared by the homepage and the
 * industry view so the two cannot rank differently.
 */
import { eventsSince } from '@/config/substrata-events';
import { BOTTLENECKS, type Bottleneck } from './bottlenecks';

export const WINDOW_DAYS = 30;

export interface WorstNow {
  worst: Bottleneck[];
  tightening: Set<string>;
  loosening: Set<string>;
}

export function worstNow(limit = 8): WorstNow {
  const recent = eventsSince(WINDOW_DAYS);
  return {
    worst: [...BOTTLENECKS]
      .filter((b) => b.horizon === 'now')
      .sort((a, b) => b.binding - a.binding)
      .slice(0, limit),
    tightening: new Set(
      recent.filter((e) => e.effect === 'tightens').flatMap((e) => e.bottlenecks),
    ),
    loosening: new Set(recent.filter((e) => e.effect === 'loosens').flatMap((e) => e.bottlenecks)),
  };
}
