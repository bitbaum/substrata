/** Turn a resolved identity into a registry company file. Pure. */
import { slugify } from '@/lib/links';
import type { Company, Kind } from './schema';
import type { Resolved } from './resolve';

export interface DraftOptions {
  name?: string;
  slug?: string;
  kind?: Kind;
  areas: { area: string; role?: string }[];
  aliases?: string[];
  today: string;
  by?: string;
}

/** An area placement rests on the sentence that says what the company does: same quote, field area:<slug>. */
function areaRows(r: Resolved, o: DraftOptions) {
  const s = r.evidence.find((e) => e.field === 'summary');
  if (!s) return [];
  return o.areas.map((a) => ({ ...s, field: `area:${a.area}` }));
}

export function draftCompany(r: Resolved, o: DraftOptions): Company {
  const name = o.name ?? r.page.title.replace(/\s*\(.*\)$/, '');
  const summary = r.evidence.find((e) => e.field === 'summary')?.quote;
  const kind: Kind = o.kind ?? (r.ids.ticker && r.ids.exchange ? 'public' : 'unclassified');
  const has = new Set(r.evidence.map((e) => e.field));
  const c: Company = {
    slug: o.slug ?? slugify(name),
    name,
    aliases: o.aliases ?? [],
    kind,
    status: 'active',
    jurisdictions: [],
    ids: r.ids,
    areas: o.areas,
    figures: [],
    evidence: [...r.evidence, ...areaRows(r, o)],
    origin: { by: o.by ?? 'company:add', on: o.today },
    ...(summary && summary.length >= 20 ? { summary } : {}),
    ...(has.has('country') && r.record?.country ? { country: r.record.country } : {}),
    ...(has.has('hq') && r.record?.hq ? { hq: r.record.hq } : {}),
  };
  if (kind === 'public' && !(c.ids.ticker && c.ids.exchange)) c.kind = 'unclassified';
  return c;
}
