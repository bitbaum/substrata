/**
 * Facet `quantity`: the hand-read figures — a material's output or reserves in
 * one country at one step of the chain — and the named places (fields, plants,
 * mines, fabs) that supply a bottleneck.
 */
import { FACILITIES, FACILITY_KIND_LABEL } from '@/config/substrata-facilities';
import {
  ENDOWMENTS,
  STAGE_LABEL,
  UNIT_LABEL,
  WORLD_TOTALS,
  type Endowment,
  type Quantity,
} from '@/config/substrata-quantities';
import { bottleneckBySlug } from '../../bottlenecks';
import { entityId } from '../../entities/types';
import { bottleneckHref, facilityHref } from '../../links';
import { resolveEntity } from '../../entities/registry';
import { chunkId, makeChunk, type Chunk } from '../chunk';
import { bottleneckIdBySlug, companyIdByName, countryId, countryName, uniqueIds } from './ids';

function quantityText(q: Quantity): string {
  if (q.basis === 'withheld') return `withheld by the source (${q.year})`;
  return `${q.value.toLocaleString('en')} ${UNIT_LABEL[q.unit]} ${q.year} (${q.basis})`;
}

/** The figure's share of the published world total, when the units and year agree. */
function worldShare(e: Endowment): number {
  const total = WORLD_TOTALS.find((w) => w.material === e.material)?.total;
  const q = e.production;
  if (!total || !q || q.basis === 'withheld' || total.basis === 'withheld') return 0;
  if (q.unit !== total.unit || q.year !== total.year || total.value <= 0) return 0;
  return q.value / total.value;
}

function endowmentChunk(e: Endowment): Chunk {
  const material = bottleneckBySlug(e.material)?.name ?? e.material;
  const place = countryName(e.place);
  const text = [
    `${material}, ${STAGE_LABEL[e.stage]} in ${place}:`,
    e.production ? ` production ${quantityText(e.production)}` : '',
    e.reserves ? `${e.production ? ';' : ''} reserves ${quantityText(e.reserves)}` : '',
    e.describes ? `. Counts ${e.describes}` : '',
    e.note ? `. ${e.note}` : '',
    '.',
  ].join('');
  const year = e.production?.year ?? e.reserves?.year;
  return makeChunk({
    id: chunkId('quantity', `${e.material}/${e.place}/${e.stage}`),
    facet: 'quantity',
    kind: 'bottleneck',
    entityIds: uniqueIds(bottleneckIdBySlug(e.material), countryId(e.place)),
    title: `${material} in ${place}`,
    text,
    href: bottleneckHref(e.material),
    sourceUrl: e.source,
    evidence: 'sourced',
    ...(year ? { asOf: String(year) } : {}),
    significance: worldShare(e),
  });
}

export function quantityChunks(): Chunk[] {
  const facilities = FACILITIES.map((f) => {
    const makes = f.makes.map((slug) => bottleneckBySlug(slug)?.name ?? slug);
    const self = entityId('facility', f.id);
    return makeChunk({
      id: chunkId('quantity', `facility/${f.id}`),
      facet: 'quantity',
      kind: 'facility',
      entityIds: uniqueIds(
        resolveEntity(self) ? [self] : [],
        ...f.makes.map(bottleneckIdBySlug),
        countryId(f.place),
        f.operator ? companyIdByName(f.operator) : [],
      ),
      title: f.name,
      text: `${f.name} (${FACILITY_KIND_LABEL[f.kind].toLowerCase()}, ${f.where}, ${countryName(f.place)}): operator ${f.operator ?? 'not recorded'}; supplies ${makes.join(', ')}. ${f.what}`,
      href: facilityHref(f.id),
      sourceUrl: f.source,
      evidence: 'sourced',
      asOf: f.readOn,
      significance: 0.4,
    });
  });
  return [...ENDOWMENTS.map(endowmentChunk), ...facilities];
}
