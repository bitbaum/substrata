/**
 * One entity of a kind, for tests that walk every kind. A kind whose source
 * declares `allowEmpty` (lib/entities/sources) may have no rows yet — labs
 * land before the data pilot fills them — so it gets a fixture of its own
 * shape instead of an `undefined` that hides what the test checks.
 */
import { entitiesOfKind } from '../../lib/entities/registry';
import { ENTITY_SOURCES } from '../../lib/entities/sources';
import { entityId, type Entity, type EntityKind } from '../../lib/entities/types';
import { labHref } from '../../lib/links';

const FIXTURE: Partial<Record<EntityKind, Entity>> = {
  lab: {
    id: entityId('lab', 'fixture-lab'),
    kind: 'lab',
    key: 'fixture-lab',
    name: 'Fixture Lab',
    aka: [],
    href: labHref('fixture-lab'),
    summary: 'A fixture for tests; not in the corpus.',
    evidence: 'candidate',
    sources: [],
    topics: ['lab'],
    retrievalText: 'A fixture for tests.',
  },
};

export function sampleOf(kind: EntityKind): Entity {
  const real = entitiesOfKind(kind)[0];
  if (real) return real;
  const source = ENTITY_SOURCES.find((s) => s.kind === kind);
  const fixture = FIXTURE[kind];
  if (!source?.allowEmpty || !fixture)
    throw new Error(`no ${kind} entity, and its source does not declare allowEmpty`);
  return fixture;
}
