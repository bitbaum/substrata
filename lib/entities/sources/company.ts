import { MARKET_PARTICIPANTS } from '../../participants';
import { marketHref } from '../../links';
import { entityId, type Entity } from '../types';
/**
 * Alternative spellings, minus the name itself and minus duplicates.
 *
 * A country with no display name falls back to its ISO code, which made the
 * code both the name and its own alias — harmless-looking, and exactly the kind
 * of self-referential join that makes "same organisation?" unanswerable.
 */
function aliasesOf(aliases: string[] | undefined, name: string): string[] {
  return [...new Set(aliases ?? [])].filter((alias) => alias && alias !== name);
}

function companies(): Entity[] {
  return MARKET_PARTICIPANTS.map((p) => ({
    id: entityId('company', p.slug),
    kind: 'company' as const,
    key: p.slug,
    name: p.name,
    // The alias list existed in the data and was used by nothing, which is how
    // one firm spelled two ways stayed two firms.
    aka: aliasesOf((p as { aliases?: string[] }).aliases, p.name),
    href: marketHref(p.slug),
    summary: p.why ?? p.role ?? `An organisation recorded in the ${p.layer} layer.`,
    evidence:
      p.directorySource || p.existenceVerifiedBy
        ? 'partly sourced; replaceability is a judgement'
        : 'unverified',
    sources: [
      ...(p.directorySource ? [p.directorySource] : []),
      ...(p.existenceVerifiedBy ? [p.existenceVerifiedBy.url] : []),
    ],
    topics: [...p.technologies, ...p.industries],
    retrievalText: `Directory interpretation, not independently verified: ${p.role ?? ''} ${p.why ?? ''} Jurisdictions recorded: ${p.jurisdictions.join(' ')}. Mapped products: ${p.produces.map((x) => `${x.bottleneck} (${x.verification})`).join(', ')}. ${p.directorySource ? `Source for this organisation's role in the chain: ${p.directorySource}.` : ''} ${p.existenceVerifiedBy ? `A separate source establishes that this organisation makes ${p.existenceVerifiedBy.bottleneck}.` : ''} Neither source establishes market share, rank, revenue, or replaceability — the scarcity grade above is this project's judgement, not a cited fact.`,
  }));
}

export const source = { kind: 'company' as const, build: companies };
