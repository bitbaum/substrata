import { LAB_TYPE_LABEL, LABS, type Lab } from '@/config/substrata-labs';
import { countryNameOf } from '@/lib/world/pages';
import { labHref } from '../../links';
import { entityId, type Entity } from '../types';

/**
 * Labs, as entities: institutes, university groups and national laboratories
 * that research or train people for a tracked bottleneck
 * (config/substrata-labs.ts). Empty until the data pilot adds candidate rows,
 * which is why the source declares `allowEmpty` with its reason.
 */
export function labEntities(rows: readonly Lab[] = LABS): Entity[] {
  return rows.map((lab) => {
    const country = countryNameOf(lab.place);
    const work = lab.worksOn.map((w) => w.bottleneck);
    return {
      id: entityId('lab', lab.id),
      kind: 'lab' as const,
      key: lab.id,
      name: lab.name,
      aka: [],
      href: labHref(lab.id),
      summary: `${LAB_TYPE_LABEL[lab.type]} in ${country} working on ${work.join(', ')}.`,
      evidence: lab.evidence === 'candidate' ? 'candidate' : 'named by a primary source',
      sources: [lab.source],
      topics: ['lab', lab.type, lab.place, ...work],
      retrievalText: `${lab.name} is a ${LAB_TYPE_LABEL[lab.type].toLowerCase()} in ${lab.where ? `${lab.where}, ` : ''}${country}. ${lab.worksOn.map((w) => `${w.bottleneck}: ${w.what}`).join(' ')} ${lab.join ? 'It lists a way to apply.' : 'No way to apply is recorded.'}`,
    };
  });
}

export const source = {
  kind: 'lab' as const,
  build: () => labEntities(),
  allowEmpty: {
    since: '2026-10-24',
    reason: 'the kind exists before its data: the data pilot fills it through add.ts labs',
  },
};
