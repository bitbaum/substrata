/**
 * Row counts for a lab's boxes, from its row (config/substrata-labs.ts). A
 * candidate row reads `lead`, so a lab the pilot adds shows in the counts and
 * fills no box until a person promotes it. Funding counts relations only.
 */
import { labById, type Lab } from '@/config/substrata-labs';
import type { RowCounts } from '../definitions';
import type { Subject } from '../subjects';
import { NOTHING, gradeOf, tally } from './shared';

const on = (f: (lab: Lab) => RowCounts) => (s: Subject) => {
  const lab = labById(s.key);
  return lab ? f(lab) : { ...NOTHING, basis: 'not in the lab register' };
};

export const LAB_COUNTERS: Record<string, (s: Subject) => RowCounts> = {
  works_on: on((lab) =>
    tally(
      lab.worksOn,
      () => gradeOf(lab),
      `${lab.worksOn.length} line${lab.worksOn.length === 1 ? '' : 's'} of work on its row`,
    ),
  ),
  where: on((lab) => tally([lab.place], () => gradeOf(lab), 'its country, from its row')),
  how_to_join: on((lab) =>
    tally(
      lab.join ? [lab.join] : [],
      () => gradeOf(lab),
      lab.join ? 'a page to apply' : 'no way in recorded',
    ),
  ),
};
