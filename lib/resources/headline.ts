/**
 * A country in one sentence of computed facts: its largest shares of world
 * output, from the USGS/EIA tables. Used where a one-line summary is needed
 * (search, Ask) in place of the directory's hand-written blurb.
 */
import { countryResources, leadOf } from './country';
import { formatShare, ordinal } from './format';

export function countryHeadline(iso2: string, count = 3): string | null {
  const parts = countryResources(iso2)
    .measured.filter((f) => (f.significance ?? 0) > 0)
    .slice(0, count)
    .map((f) => {
      const lead = leadOf(f.production)!;
      const what = `${f.label.toLowerCase()} (${lead.label.toLowerCase()})`;
      return `${formatShare(lead.current.share ?? 0)} of world ${what}, ${lead.year} (${ordinal(lead.current.rank ?? 0)})`;
    });
  if (parts.length === 0) return null;
  return `Largest shares of world output, computed from USGS and EIA tables: ${parts.join('; ')}.`;
}
