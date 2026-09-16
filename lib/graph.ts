/**
 * Derived graph of the corpus. Config files remain the producer. This module
 * is the join a researcher actually wants: given a node, what else is it
 * touching. A graph database is the next store; until then this is the SSOT
 * query surface.
 */
import { SCIENCE } from '@/config/substrata-science';
import { CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import { COUNTRY_RESOURCES } from '@/config/substrata-resources';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref, marketHref, policyHref, scienceHref, capitalHref } from '@/lib/links';

export type GraphKind = 'country' | 'company' | 'bottleneck' | 'science' | 'capital';

export type GraphNode = {
  kind: GraphKind;
  id: string;
  label: string;
  href: string;
};

export type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
  rel: string;
};

function bottleneckNode(name: string): GraphNode | null {
  const b = BOTTLENECKS.find((row) => row.name === name);
  if (!b) return null;
  return { kind: 'bottleneck', id: b.slug, label: b.name, href: bottleneckHref(b.slug) };
}

export function neighbors(kind: GraphKind, id: string): GraphEdge[] {
  const key = id.toLowerCase();
  const edges: GraphEdge[] = [];
  const push = (from: GraphNode, to: GraphNode | null, rel: string) => {
    if (to) edges.push({ from, to, rel });
  };

  if (kind === 'country') {
    const from: GraphNode = {
      kind: 'country',
      id: key,
      label: key.toUpperCase(),
      href: `/atlas?view=world&country=${key}`,
    };
    const endowment = COUNTRY_RESOURCES.find((r) => r.iso2 === key);
    for (const name of endowment?.relatedBottlenecks ?? []) {
      push(from, bottleneckNode(name), 'related to');
    }
    for (const org of MARKET_PARTICIPANTS) {
      if (org.jurisdictions.some((j) => j.toLowerCase() === key)) {
        push(
          from,
          { kind: 'company', id: org.slug, label: org.name, href: marketHref(org.slug) },
          'hosts',
        );
      }
    }
    for (const instrument of INSTRUMENTS) {
      if (instrument.jurisdiction === key) {
        push(
          from,
          {
            kind: 'capital',
            id: instrument.id,
            label: instrument.title,
            href: policyHref(instrument.jurisdiction),
          },
          'governs',
        );
      }
    }
  }

  if (kind === 'company') {
    const org = MARKET_PARTICIPANTS.find((p) => p.slug === key || p.name.toLowerCase() === key);
    if (!org) return edges;
    const from: GraphNode = {
      kind: 'company',
      id: org.slug,
      label: org.name,
      href: marketHref(org.slug),
    };
    for (const code of org.jurisdictions) {
      push(
        from,
        {
          kind: 'country',
          id: code.toLowerCase(),
          label: code.toUpperCase(),
          href: `/atlas?view=world&country=${code.toLowerCase()}`,
        },
        'located in',
      );
    }
    for (const row of org.produces) {
      push(from, bottleneckNode(row.bottleneck), 'makes');
    }
  }

  if (kind === 'bottleneck') {
    const b = BOTTLENECKS.find((row) => row.slug === key || row.name.toLowerCase() === key);
    if (!b) return edges;
    const from = bottleneckNode(b.name)!;
    for (const p of b.producers) {
      const org = MARKET_PARTICIPANTS.find((m) => m.name === p.name);
      if (org) {
        push(
          from,
          { kind: 'company', id: org.slug, label: org.name, href: marketHref(org.slug) },
          'produced by',
        );
      }
    }
    for (const entry of SCIENCE.filter((s) => s.relieves.some((r) => r.bottleneck === b.name))) {
      push(
        from,
        { kind: 'science', id: entry.id, label: entry.name, href: scienceHref(entry.id) },
        'relieved by',
      );
    }
    for (const provider of CAPITAL_PROVIDERS.filter((c) => c.canMove.includes(b.name))) {
      push(
        from,
        {
          kind: 'capital',
          id: provider.id,
          label: provider.name,
          href: capitalHref(provider.id),
        },
        'fundable by',
      );
    }
  }

  return edges;
}
