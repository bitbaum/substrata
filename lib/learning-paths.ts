/**
 * Public learning paths into these chains (research/learning-paths.json):
 * programmes, apprenticeships, academies and government schemes, each linked
 * to the official page that was opened (HTTP 200, content matching) on the
 * date shown. Format and entry facts are copied from that page; where the page
 * did not say, the field is absent rather than filled in.
 *
 * `careerChangers` is true only where the page itself addresses people moving
 * from other work (mid-career, veterans, re-employment), false where it
 * requires an affiliation or prior experience, and null where it does not say.
 * A listing is not an endorsement: Substrata has not attended or reviewed any.
 */
import data from '@/research/learning-paths.json';
import type { RoleFamilyId } from '@/config/careers-roles';

export interface LearningPath {
  id: string;
  name: string;
  provider: string;
  kind: 'university' | 'college' | 'apprenticeship' | 'academy' | 'government' | 'online';
  families: RoleFamilyId[];
  /** ISO-2, "EU", or "online". */
  country: string;
  /** As the page states it; absent when it does not. */
  format?: string;
  careerChangers: boolean | null;
  url: string;
  checkedOn: string;
  note: string;
}

export const LEARNING_PATHS = (data as { paths: LearningPath[] }).paths;

export const KIND_LABEL: Record<LearningPath['kind'], string> = {
  university: 'University',
  college: 'College',
  apprenticeship: 'Apprenticeship',
  academy: 'Industry academy',
  government: 'Public programme',
  online: 'Online',
};

export function pathsFor(families: readonly RoleFamilyId[]): LearningPath[] {
  return LEARNING_PATHS.filter((p) => p.families.some((f) => families.includes(f)));
}
