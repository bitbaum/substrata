/** What a registered company does not yet show: derived from the file, never stored. */
import type { Company } from './schema';

export interface Gap {
  field: string;
  label: string;
  /** Where evidence for it would come from. */
  from: string;
}

export function gapsOf(c: Company): Gap[] {
  const has = new Set(c.evidence.map((e) => e.field));
  const gaps: Gap[] = [];
  const need = (field: string, label: string, from: string, present: unknown) => {
    if (!present || !has.has(field)) gaps.push({ field, label, from });
  };
  need(
    'summary',
    'What it is',
    "its own about page, or a filing's business description",
    c.summary,
  );
  need('country', 'Country', 'a filing cover page, company register or Wikidata', c.country);
  need('hq', 'Headquarters', 'its contact page, a filing cover page or Wikidata', c.hq);
  if (!c.areas.length)
    gaps.push({ field: 'areas', label: 'Areas', from: 'a sentence saying what it works on' });
  const listed = c.kind === 'public';
  if (!listed && c.kind !== 'subsidiary' && !c.figures.length)
    gaps.push({
      field: 'figures',
      label: 'Funding, valuation, headcount',
      from: 'its own post, a Form D or S-1, or a named publisher quoted',
    });
  if (listed)
    for (const k of ['isin', 'lei', 'cik'] as const) {
      if (!c.ids[k] && (k !== 'cik' || c.country === 'US'))
        gaps.push({
          field: `ids.${k}`,
          label: k.toUpperCase(),
          from: 'GLEIF, SEC or the exchange',
        });
    }
  if (!c.parent && c.kind === 'subsidiary')
    gaps.push({ field: 'parent', label: 'Owner', from: 'a filing subsidiary list or a register' });
  return gaps;
}
