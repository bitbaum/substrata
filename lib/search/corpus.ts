/**
 * The search corpus: every entity in the registry plus the records that are
 * not entities but that a reader searches for all the same — accepted events,
 * evidence-engine candidates and glossary terms.
 */
import { GLOSSARY } from '@/config/substrata-glossary';
import { EVENTS, EVENT_EFFECT_LABEL, EVENT_KIND_LABEL } from '@/config/substrata-events';
import { EVIDENCE } from '@/config/substrata-evidence';
import { allEntities } from '../entities/registry';
import type { EntityKind } from '../entities/types';
import { bottleneckHref, glossaryHref } from '../links';
import { allLearn, allNotes, type Note } from '../notes';
import type { SearchType } from '../search-types';

const KIND_TO_TYPE: Record<EntityKind, SearchType> = {
  bottleneck: 'bottleneck',
  company: 'company',
  science: 'science',
  policy: 'policy',
  country: 'country',
  capital: 'capital',
  loop: 'loop',
  facility: 'facility',
  talent: 'talent',
  learn: 'note',
  article: 'note',
};

export interface SearchDoc {
  id: string;
  type: SearchType;
  title: string;
  aka: string[];
  /** One line shown under the title when no better passage matched. */
  summary: string;
  /** Everything else worth matching. Never shown whole. */
  body: string;
  href: string;
  /** Short context for the kicker: an evidence state, a date. */
  meta: string;
}

/** Plain text of a note's blocks, whatever their shape: every string that is not a type tag. */
function noteText(note: Note): string {
  const out: string[] = [];
  const walk = (value: unknown, key = ''): void => {
    if (typeof value === 'string') {
      if (key !== 'type' && key !== 'href' && key !== 'src') out.push(value);
    } else if (Array.isArray(value)) value.forEach((v) => walk(v));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(note.blocks);
  return out.join(' ');
}

function noteBodies(): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const n of allNotes()) bodies.set(`article:${n.slug}`, noteText(n));
  for (const n of allLearn()) bodies.set(`learn:${n.slug}`, noteText(n));
  return bodies;
}

/**
 * Source URLs are in the retrieval text for the assistant's benefit; to a
 * search they are noise ("asml" matched inside "www.asml.com", and every
 * document gained the words "https" and "com").
 */
function withoutUrls(text: string): string {
  return text.replace(/\bhttps?:\/\/\S+/g, '').replace(/\s+\(\s*\)/g, '');
}

export function searchDocuments(): SearchDoc[] {
  const bodies = noteBodies();
  const entities: SearchDoc[] = allEntities().map((e) => ({
    id: e.id,
    type: KIND_TO_TYPE[e.kind],
    title: e.name,
    // A country's ISO code is an alias, and "cn" or "us" are real searches.
    aka: e.aka,
    summary: e.summary,
    body: withoutUrls(`${e.retrievalText} ${e.topics.join(' ')} ${bodies.get(e.id) ?? ''}`),
    href: e.href,
    meta: e.evidence,
  }));

  const events: SearchDoc[] = EVENTS.map((ev) => ({
    id: `event:${ev.id}`,
    type: 'event' as const,
    title: ev.headline,
    aka: [],
    summary: ev.quote,
    body: [
      ev.bottlenecks.join(' '),
      ev.participants.join(' '),
      ev.jurisdictions.join(' '),
      EVENT_KIND_LABEL[ev.kind],
      EVENT_EFFECT_LABEL[ev.effect],
    ].join(' '),
    href: `/events#${ev.id}`,
    meta: `${ev.date} · ${EVENT_EFFECT_LABEL[ev.effect]}`,
  }));

  const evidence: SearchDoc[] = EVIDENCE.rows
    .filter((row) => row.candidates.length > 0)
    .map((row) => ({
      id: `evidence:${row.material}:${row.producer}`,
      type: 'evidence' as const,
      title: `${row.producer} · ${row.material}`,
      aka: [],
      summary: row.candidates[0].excerpt,
      body: row.candidates.map((c) => `${c.title} ${c.excerpt}`).join(' '),
      href: bottleneckHref(row.material),
      meta: `${row.candidates.length} page${row.candidates.length === 1 ? '' : 's'} found, not yet read`,
    }));

  const glossary: SearchDoc[] = GLOSSARY.map((g) => ({
    id: `glossary:${g.term}`,
    type: 'glossary' as const,
    title: g.term,
    aka: [],
    summary: g.detail,
    body: g.seeAlso?.length ? `See also: ${g.seeAlso.join(', ')}.` : '',
    href: glossaryHref(g.term),
    meta: 'definition',
  }));

  return [...entities, ...events, ...evidence, ...glossary];
}
