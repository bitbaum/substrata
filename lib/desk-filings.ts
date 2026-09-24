/**
 * SEC filings as desk rows. A filing lands on every rail its company holds,
 * so a Wolfspeed 8-K shows under silicon carbide and nowhere it has no stake.
 */
import type { DeskItem } from '@/lib/desk';
import { exposureRows } from '@/lib/exposure';
import { filingHeadline, type Filing } from '@/lib/filings';

export interface Registrant {
  /** The name the desk shows: the directory's, not EDGAR's upper-case one. */
  company: string;
  bottlenecks: string[];
}

/** CIK → directory company and the bottlenecks it holds, restricted to `rails`. */
export function registrantsOn(rails: ReadonlySet<string>): Map<number, Registrant> {
  const out = new Map<number, Registrant>();
  for (const row of exposureRows()) {
    const l = row.listing;
    const cik = l && (l.status === 'listed' || l.status === 'parent') ? l.us?.cik : undefined;
    if (!cik || !rails.has(row.bottleneck)) continue;
    const name = l && l.status === 'parent' && l.parent ? l.parent : row.company;
    const seen = out.get(cik);
    if (!seen) out.set(cik, { company: name, bottlenecks: [row.bottleneck] });
    else if (!seen.bottlenecks.includes(row.bottleneck)) seen.bottlenecks.push(row.bottleneck);
  }
  return out;
}

export function filingItems(
  filings: readonly Filing[],
  registrants: Map<number, Registrant>,
): DeskItem[] {
  return filings.flatMap((f): DeskItem[] => {
    const r = registrants.get(f.cik);
    if (!r) return [];
    return [
      {
        source: 'filing',
        id: f.accession,
        at: f.acceptedAt,
        title: filingHeadline(f, r.company),
        url: f.url,
        host: 'sec.gov',
        bottlenecks: r.bottlenecks,
        effect: 'neutral',
        form: f.form,
        dateOnly: false,
      },
    ];
  });
}
