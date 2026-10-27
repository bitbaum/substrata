/**
 * The corpus, as the exposure model reads it. A parameter object so a test
 * can hand the model a small world; `corpus()` is the real one.
 */
import { DEPENDENCIES, type Dependency } from '@/config/substrata-dependencies';
import { SUBSTITUTES, type Substitute } from '@/config/substrata-substitutes';
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';
import { resolveEntity } from '@/lib/entities/registry';
import { neighbours, type Neighbour } from '@/lib/graph/index';
import { slugify } from '@/lib/links';
import { MARKET_PARTICIPANTS, participantBySlug } from '@/lib/participants';

export interface Held {
  bottleneck: string;
  step: string;
  supplier: boolean;
}

export interface ExposureData {
  dependencies: readonly Dependency[];
  bottlenecks: readonly Bottleneck[];
  substitutes: readonly Substitute[];
  /** What the directory says the company holds. */
  held(slug: string): Held[];
  /** Counted company-to-company supply edges the relation graph holds for `id`. */
  supplyEdges(id: string): Neighbour[];
  /** The page slug of a printed name, or null when it has none. */
  slugOf(name: string): string | null;
}

const SLUG_BY_NAME = new Map(MARKET_PARTICIPANTS.map((p) => [p.name, p.slug]));

export function corpus(): ExposureData {
  return {
    dependencies: DEPENDENCIES,
    bottlenecks: BOTTLENECKS,
    substitutes: SUBSTITUTES,
    held: (slug) =>
      (participantBySlug(slug)?.produces ?? []).map((r) => ({
        bottleneck: r.bottleneck,
        step: r.step,
        supplier: r.supplier,
      })),
    supplyEdges: (id) =>
      neighbours(id, { minGrade: 'stated' }).filter(
        (n) =>
          n.node.id.startsWith('company:') && ['supplies', 'buys_from'].includes(n.relation.type),
      ),
    slugOf: (name) => {
      const known = SLUG_BY_NAME.get(name);
      if (known) return known;
      const slug = slugify(name);
      return resolveEntity(`company:${slug}`) ? slug : null;
    },
  };
}
