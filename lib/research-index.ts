/** One searchable projection for discovery, visual exploration and AI retrieval.
 * All claims remain owned by the research corpus; this module only joins them.
 */
import { BOTTLENECKS } from './bottlenecks';
import { MARKET_PARTICIPANTS } from './participants';
import { allLearn, allNotes } from './notes';
import { bottleneckHref, marketHref, learnHref, noteHref, scienceHref, policyHref } from './links';
import { SCIENCE } from '@/config/substrata-science';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { JOIN } from '@/config/substrata-join';
import {
  COUNTRY_RESOURCES,
  RESOURCE_DIRECTORY_NOTE,
  resourceLabel,
} from '@/config/substrata-resources';
import { WORLD_PATHS } from '@/config/world-paths';

export interface ResearchDocument {
  id: string;
  kind:
    'bottleneck' | 'company' | 'learn' | 'article' | 'science' | 'policy' | 'talent' | 'country';
  title: string;
  href: string;
  text: string;
  sources: string[];
  evidence: string;
  topics: string[];
}

export function researchDocuments(): ResearchDocument[] {
  return [
    ...SCIENCE.map((s) => ({
      id: `science:${s.id}`,
      kind: 'science' as const,
      title: s.name,
      href: scienceHref(s.id),
      text: `${s.plain} ${s.relieves.map((r) => `${r.bottleneck}: ${r.mechanism}`).join(' ')} Readiness ${s.readiness}/9: ${s.readinessWhy}. Analyst judgement dated ${s.judgedOn}. Next milestone: ${s.nextMilestone ?? 'not specified'}`,
      sources: s.source ? [s.source] : [],
      evidence: s.source ? 'source-backed readiness judgement' : 'unsourced judgement',
      topics: [s.front, ...s.industries],
    })),
    ...INSTRUMENTS.map((i) => ({
      id: `policy:${i.id}`,
      kind: 'policy' as const,
      title: i.title,
      href: policyHref(i.jurisdiction),
      text: `${i.summary} ${i.body}. Status: ${i.status}; instrument date: ${i.date}; read on ${i.readOn}. ${i.statusNote ?? ''}`,
      sources: [i.source],
      evidence: i.primary ? 'primary source' : 'secondary source',
      topics: [...i.technologies, ...i.industries, i.jurisdiction],
    })),
    ...JOIN.roles.map((r, i) => ({
      id: `talent:${i}`,
      kind: 'talent' as const,
      title: r.title,
      href: '/talent',
      text: `Research contribution opportunity, not employment. ${r.what} ${r.why}`,
      sources: [],
      evidence: 'project research need',
      topics: ['talent'],
    })),
    ...BOTTLENECKS.map((b) => ({
      id: `bottleneck:${b.slug}`,
      kind: 'bottleneck' as const,
      title: b.name,
      href: bottleneckHref(b.slug),
      text: `Explanation and analyst interpretation (not verified by the producer links): ${b.plain} ${b.why} ${b.rationale} Assessment ${b.binding}/12, judgement dated ${b.judgedOn}. Producer claims, each separately labelled: ${b.producers.map((p) => `${p.name}: ${p.verification}${p.source ? ` for making this material (${p.source})` : ''}`).join('; ')}. Producer pages do not establish total market share or the completeness of this list.`,
      sources: [...new Set(b.producers.flatMap((p) => (p.source ? [p.source] : [])))],
      evidence: b.state,
      topics: [...b.technologies, b.stage, ...b.industries],
    })),
    ...MARKET_PARTICIPANTS.map((p) => ({
      id: `company:${p.slug}`,
      kind: 'company' as const,
      title: p.name,
      href: marketHref(p.slug),
      text: `Directory interpretation, not independently verified: ${p.role ?? ''} ${p.why ?? ''} Jurisdictions recorded: ${p.jurisdictions.join(' ')}. Mapped products: ${p.produces.map((x) => `${x.bottleneck} (${x.verification})`).join(', ')}. ${p.existenceVerifiedBy ? `The source establishes only that this organisation makes ${p.existenceVerifiedBy.bottleneck}; it does not establish market share, rank, revenue, or replaceability.` : ''}`,
      sources: p.existenceVerifiedBy ? [p.existenceVerifiedBy.url] : [],
      evidence: p.existenceVerifiedBy
        ? 'partly sourced; replaceability is a judgement'
        : 'unverified',
      topics: [...p.technologies, ...p.industries],
    })),
    ...allLearn().map((n) => ({
      id: `learn:${n.slug}`,
      kind: 'learn' as const,
      title: n.title,
      href: learnHref(n.slug),
      text: n.summary,
      sources: [],
      evidence: 'explanation',
      topics: n.tags,
    })),
    ...COUNTRY_RESOURCES.map((row) => {
      const name = WORLD_PATHS.find((p) => p.iso2 === row.iso2)?.name ?? row.iso2.toUpperCase();
      return {
        id: `country:${row.iso2}`,
        kind: 'country' as const,
        title: name,
        href: `/atlas?view=world&country=${row.iso2}`,
        text: `${name} (${row.iso2.toUpperCase()}). ${row.why} Directory resources: ${row.resources.map(resourceLabel).join(', ') || 'none listed'}. Related bottlenecks named in the directory: ${row.relatedBottlenecks.join(', ') || 'none yet'}. ${RESOURCE_DIRECTORY_NOTE}`,
        sources: [],
        evidence: 'directory, not a finding',
        topics: ['country', row.iso2, ...row.resources],
      };
    }),
    ...allNotes().map((n) => ({
      id: `article:${n.slug}`,
      kind: 'article' as const,
      title: n.title,
      href: noteHref(n.slug),
      text: n.summary,
      sources: [],
      evidence: 'editorial',
      topics: n.tags,
    })),
  ];
}

export function searchResearch(documents: ResearchDocument[], query: string): ResearchDocument[] {
  const words = query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return documents;
  return documents
    .map((document) => {
      const title = document.title.toLocaleLowerCase();
      const text = `${title} ${document.text} ${document.topics.join(' ')}`.toLocaleLowerCase();
      return {
        document,
        score: words.every((w) => text.includes(w))
          ? words.reduce((n, w) => n + (title.includes(w) ? 4 : 1), 0)
          : 0,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .map((x) => x.document);
}
