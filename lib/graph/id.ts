import type { Relation } from './types';

/** A commodity as it appears in an id: lowercase words joined by hyphens. */
export function commoditySlug(commodity: string): string {
  return commodity
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The one rule for a relation's stable id.
 *
 * A flow names what moved: uranium and refined copper from the same country to
 * the same partner in the same year are two relations, so the commodity is part
 * of the id whenever the source states one. A relation without a stated
 * commodity keeps the id it always had.
 */
export function relationId(
  r: Pick<Relation, 'from' | 'type' | 'to' | 'asOf'> & {
    volume?: Pick<NonNullable<Relation['volume']>, 'commodity'>;
  },
): string {
  const base = `${r.from}|${r.type}|${r.to}|${r.asOf}`;
  const commodity = r.volume?.commodity ? commoditySlug(r.volume.commodity) : '';
  return commodity ? `${base}|${commodity}` : base;
}
