import { RESEARCH_PROGRAMMES } from '@/config/substrata-programmes';
import { loopHref } from '../../links';
import { entityId, type Entity } from '../types';
/**
 * The loops themselves, as entities.
 *
 * A loop — design, build, measure — is what the whole corpus is about: the site's
 * claim is that technology improves at the speed of the slowest turn, so the
 * loops are the KPI and everything else is upstream of one. They were the only
 * thing in the model that could not be linked to, searched for, discussed, or
 * reached from the web, which made the most important object in the system a
 * dead end.
 *
 * Their evidence label says what they are: this is the project's own framing,
 * not a measured quantity, and a reader should be told which they are reading.
 */
function loops(): Entity[] {
  return RESEARCH_PROGRAMMES.flatMap((programme) =>
    programme.layers.map((layer) => ({
      id: entityId('loop', layer.id),
      kind: 'loop' as const,
      key: layer.id,
      name: layer.name,
      aka: [],
      href: loopHref(layer.id),
      summary: layer.turn,
      evidence: "the project's own model, not a measurement",
      sources: [],
      topics: ['loop', programme.id],
      retrievalText: `${layer.name} is a loop in the ${programme.title} programme: one turn is ${layer.period} and consists of ${layer.turn} ${layer.note} It is gated by ${layer.gatedBy.join(', ') || 'nothing recorded'}. A loop is how fast a design can be tried, built and measured; the slowest one sets the pace.`,
    })),
  );
}

export const source = { kind: 'loop' as const, build: loops };
