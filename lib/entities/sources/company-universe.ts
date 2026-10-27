/**
 * Tier B companies: admitted to the universe on cited identity, theme and
 * size (lib/universe), with no profile and no chain role claimed. Built in the
 * derived pass, before the stubs: a stub the universe identifies is promoted
 * (same slug, built here) and the stub source skips it.
 */
import { THEMES } from '@/config/universe-themes';
import { allAreas } from '@/lib/registry/areas';
import { registeredCompany } from '@/lib/registry/load';
import { KIND_LABEL } from '@/lib/registry/schema';
import { universeEntries } from '@/lib/universe/store';
import type { UniverseEntry } from '@/lib/universe/types';
import { graphNode } from '@/lib/graph/index';
import { printedAs } from '@/lib/graph/aliases';
import { marketHref } from '../../links';
import { stubRelations, stubSummary } from './company-stubs';
import { participantBySlug } from '../../participants';
import { IDENTIFIED_EVIDENCE, entityId, type Entity } from '../types';

/** Admitted tier B entries that are not directory companies. */
export function identifiedEntries(): UniverseEntry[] {
  return universeEntries().filter((e) => e.tier === 'B' && !participantBySlug(e.slug));
}

let slugs: Set<string> | null = null;
export function identifiedSlugs(): Set<string> {
  if (!slugs) slugs = new Set(identifiedEntries().map((e) => e.slug));
  return slugs;
}

/** A registered company in its own words: what it is, its kind and areas. Null for a migrated row with no summary. */
function registeredSummary(e: UniverseEntry): string | null {
  const c = e.registered ? registeredCompany(e.slug) : undefined;
  if (!c?.summary) return null;
  const areas = c.areas.map((a) => allAreas().find((x) => x.slug === a.area)?.name ?? a.area);
  return `${c.summary} ${KIND_LABEL[c.kind]}${areas.length ? `, tracked in ${areas.join(', ')}` : ''}. Registered, not profiled: no role in any supply chain is claimed.`;
}

function summaryOf(e: UniverseEntry): string {
  const own = registeredSummary(e);
  if (own) return own;
  const themes = e.themes.map((t) => THEMES.find((x) => x.id === t)!.label);
  return `Identified, not profiled: admitted under ${themes.join(', ')} on cited identity, theme and size. No role in any supply chain is claimed.`;
}

/**
 * A company the relation graph already named (a stub, same slug) keeps what
 * the graph said: its printed name and reviewed spellings, the relations
 * sentence, the countries and commodities of its rows. Promotion adds; it
 * never loses what the sources said.
 */
function promoted(e: UniverseEntry) {
  const id = `company:${e.slug}`;
  const relations = stubRelations(id);
  if (!relations.length) return null;
  const node = graphNode(id);
  return {
    name: node.name,
    aka: [...new Set([...printedAs(id), ...e.aliases, e.name])].filter((n) => n !== node.name),
    summary: stubSummary(id, relations),
    topics: [...node.iso2, ...(node.commodities ?? [])],
  };
}

function identified(e: UniverseEntry): Entity {
  const was = promoted(e);
  const size = e.tests.materiality.evidence[0];
  const ids = Object.entries(e.ids)
    .filter(([k]) => ['ticker', 'cik', 'lei', 'qid', 'registry'].includes(k))
    .map(([k, v]) => `${k.toUpperCase()} ${v}`);
  const themes = e.themes.map((t) => THEMES.find((x) => x.id === t)!);
  return {
    id: entityId('company', e.slug),
    kind: 'company',
    key: e.slug,
    name: was?.name ?? e.name,
    aka: was?.aka ?? e.aliases,
    href: marketHref(e.slug),
    summary: was ? `${was.summary} ${summaryOf(e)}` : summaryOf(e),
    evidence: IDENTIFIED_EVIDENCE,
    sources: [...new Set(e.admittedBy.map((a) => a.source))],
    topics: [
      ...new Set([
        'company',
        ...(was?.topics ?? []),
        ...e.themes,
        ...themes.flatMap((t) => t.topics),
        ...(e.country ? [e.country.toLowerCase()] : []),
      ]),
    ],
    retrievalText:
      registeredSummary(e) ??
      `${e.name}: identified, not profiled. Admitted to the Substrata company universe (tier B) because cited sources place it in ${themes.map((t) => t.label).join(', ')}, ${size ? `show ${size.detail.replace(/\.$/, '')}` : 'clear a size floor'}, and identify it (${ids.join(', ')}). Theme evidence is fund holdings, filed industry codes or programme lists: it shows interest in the theme, not a role in any chain. ${e.admittedBy
        .filter((a) => a.test === 'theme')
        .map((a) => a.detail)
        .join(' ')}`,
  };
}

export const source = {
  kind: 'company' as const,
  build: () => identifiedEntries().map(identified),
};
