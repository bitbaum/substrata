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
    retrievalText: `${c.name} is ${CAPITAL_KIND_LABEL[c.kind]} in ${c.jurisdiction.toUpperCase()}. Mandate: ${c.mandate} Its own words: "${c.quote}" (read ${c.readOn}). Bottlenecks its mandate could fund relief for: ${c.canMove.join(', ')}. A mandate covering an asset is not a claim that it has funded one.`,
  }));
}

export const source = { kind: 'capital' as const, build: capital };
