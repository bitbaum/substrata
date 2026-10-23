/**
 * How much an entity matters, 0..1, for the index's tie-break.
 *
 * PR 1 of the knowledge-system ADR delivers `significance(id)` in
 * `lib/known-for.ts` — the same rules, derived from the same tables, next to
 * the "known for" line that uses them. Until it lands this file carries the
 * rules the ADR states (§2.1), so the index can rank today; the day
 * `lib/known-for` exists, `entitySignificance` becomes one import. // PR 1
 */
import { bottleneckByName, bottleneckBySlug } from '../../bottlenecks';
import type { Entity } from '../../entities/types';
import { participantBySlug } from '../../participants';
import { countryResources } from '../../resources/country';

/** A bottleneck's assessment on its twelve-point scale, as a fraction. */
export function bottleneckSignificance(slug: string): number {
  const b = bottleneckBySlug(slug);
  return b ? b.binding / 12 : 0;
}

/** A country's largest share of world output; 0.2 when the directory alone names it. */
export function countrySignificance(iso2: string): number {
  const { measured, unmeasured } = countryResources(iso2);
  const share = measured[0]?.significance ?? null;
  if (share !== null && share > 0) return share;
  return unmeasured.length ? 0.2 : 0;
}

/** A company's weight is the heaviest bottleneck it is recorded as making. */
export function companySignificance(slug: string): number {
  const p = participantBySlug(slug);
  if (!p) return 0;
  return Math.max(
    0,
    ...p.produces.map((x) => {
      const b = bottleneckByName(x.bottleneck);
      return b ? b.binding / 12 : 0;
    }),
  );
}

export function entitySignificance(entity: Pick<Entity, 'kind' | 'key'>): number {
  switch (entity.kind) {
    case 'bottleneck':
      return bottleneckSignificance(entity.key);
    case 'country':
      return countrySignificance(entity.key);
    case 'company':
      return companySignificance(entity.key);
    default:
      return 0.3;
  }
}
