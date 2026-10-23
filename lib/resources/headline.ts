/**
 * A country in one sentence of computed facts: its significant shares of
 * world output, from the USGS, EIA and WNA tables. Used where a one-line
 * summary is needed (search, Ask, the country entity) in place of the
 * directory's hand-written blurb.
 *
 * A share leads only when it is significant (lib/resources/country.ts: at
 * least 1% of the world and within the top ten). A country whose measured
 * rows are all small is introduced by what the directory names it for, and
 * the small rows follow as "also produces": asking about Niger used to
 * answer "0.1% of world oil (42nd)" because uranium had no table and oil was
 * the only measured row. People do not ask about Niger and expect oil.
 */
import { resourceLabel, resourcesFor } from '@/config/substrata-resources';
import { countryResources, leadOf, type ResourceFacts } from './country';
import { formatShare, ordinal } from './format';

function clause(f: ResourceFacts): string {
  const lead = leadOf(f.production)!;
  const what = `${f.label.toLowerCase()} (${lead.label.toLowerCase()})`;
  return `${formatShare(lead.current.share ?? 0)} of world ${what}, ${lead.year} (${ordinal(lead.current.rank ?? 0)})`;
}

export function countryHeadline(iso2: string, count = 3): string | null {
  const measured = countryResources(iso2).measured.filter((f) => (f.significance ?? 0) > 0);
  const leading = measured.filter((f) => f.significant).slice(0, count);
  const small = measured.filter((f) => !f.significant).slice(0, count);
  if (leading.length > 0) {
    const also =
      small.length > 0
        ? ` Also produces, small shares: ${small.map((f) => f.label.toLowerCase()).join(', ')}.`
        : '';
    return `Largest shares of world output, computed from USGS, EIA and WNA tables: ${leading.map(clause).join('; ')}.${also}`;
  }
  const named = (resourcesFor(iso2)?.resources ?? []).map(resourceLabel);
  if (named.length === 0 && small.length === 0) return null;
  const lead =
    named.length > 0 ? `Named in the directory for ${named.join(', ').toLowerCase()}.` : '';
  const also =
    small.length > 0
      ? ` Also produces, small shares (computed from USGS, EIA and WNA tables): ${small.map(clause).join('; ')}.`
      : '';
  return `${lead}${also}`.trim();
}
