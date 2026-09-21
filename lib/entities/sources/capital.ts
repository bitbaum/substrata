import { capitalHref } from '../../links';
import { CAPITAL_KIND_LABEL, CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import { entityId, type Entity } from '../types';
function capital(): Entity[] {
  return CAPITAL_PROVIDERS.map((c) => ({
    id: entityId('capital', c.id),
    kind: 'capital' as const,
    key: c.id,
    name: c.name,
    aka: [],
    href: capitalHref(c.id),
    summary: c.mandate,
    evidence: c.primary ? 'primary source' : 'secondary source',
    sources: [c.source],
    topics: ['capital', c.kind, c.jurisdiction],
    // "Sectors it could fund relief for" rather than "Bottlenecks its mandate
    // could fund relief for": the word "bottleneck" repeated across every
    // capital row (there are over a dozen) drowned out the actual bottleneck
    // entities in search — a generic connector word outscoring the real
    // subject matter because it appeared on more rows. The list of named
    // bottlenecks that follows is the real signal and stays.
    retrievalText: `${c.name} is ${CAPITAL_KIND_LABEL[c.kind]} in ${c.jurisdiction.toUpperCase()}. Mandate: ${c.mandate} Its own words: "${c.quote}" (read ${c.readOn}). Sectors it could fund relief for: ${c.canMove.join(', ')}. A mandate covering an asset is not a claim that it has funded one.`,
  }));
}

export const source = { kind: 'capital' as const, build: capital };
