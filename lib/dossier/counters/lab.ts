/**
 * Row counts for a lab's boxes. Only "what it works on" has a source in the
 * repository today; where, how to join and funding count relations only.
 */
import { SCIENCE } from '@/config/substrata-science';
import type { RowCounts } from '../definitions';
import type { Subject } from '../subjects';
import { NOTHING, gradeOf, tally } from './shared';

function worksOn(s: Subject): RowCounts {
  const entry = SCIENCE.find((e) => e.id === s.key);
  if (!entry) return { ...NOTHING, basis: 'not in the science register' };
  const sourced = entry.source !== null && gradeOf(entry) === 'stated';
  return tally(
    entry.relieves,
    () => (sourced ? 'stated' : 'lead'),
    `${entry.relieves.length} bottleneck${entry.relieves.length === 1 ? '' : 's'} it would relieve, ${sourced ? 'with a source' : 'no source yet'}`,
  );
}

export const LAB_COUNTERS: Record<string, (s: Subject) => RowCounts> = {
  works_on: worksOn,
};
