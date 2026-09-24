import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { Heading } from '@/components/portal/Shell';
import { Ticker } from '@/components/exposure/Ticker';
import type { OrgActivity } from '@/lib/science-read';
import { matchDirectory, type DirectoryMatch } from '@/lib/science-pipeline';
import { marketHref, pipelineOrgHref } from '@/lib/links';

export interface CompanyActivity {
  match: DirectoryMatch;
  /** Institution names as the sources spelled them. */
  spelled: string[];
  items: number;
  bottlenecks: string[];
  latest: string | null;
}

/** Institutions that are directory companies, merged across spellings, busiest first. */
export function companiesIn(orgs: readonly OrgActivity[]): CompanyActivity[] {
  const by = new Map<string, CompanyActivity>();
  for (const org of orgs) {
    const match = matchDirectory(org.name);
    if (!match) continue;
    const seen = by.get(match.name) ?? {
      match,
      spelled: [],
      items: 0,
      bottlenecks: [],
      latest: null,
    };
    if (!seen.spelled.includes(org.name)) seen.spelled.push(org.name);
    if (!seen.bottlenecks.includes(org.bottleneck)) seen.bottlenecks.push(org.bottleneck);
    seen.items += org.items;
    if (org.latest && (!seen.latest || org.latest > seen.latest)) seen.latest = org.latest;
    by.set(match.name, seen);
  }
  return [...by.values()].sort((a, b) => b.items - a.items);
}

/**
 * For a trader: which companies in the directory put their names on this
 * research, with where they trade. Publishing is a signal of where a company
 * spends research effort — it is not revenue, and it is not a patent count.
 */
export function CompaniesActive({ orgs }: { orgs: OrgActivity[] }) {
  const companies = companiesIn(orgs);
  if (companies.length === 0) return null;
  return (
    <section className="mb-12">
      <Heading
        title="Directory companies in this research"
        aside="Authors' or awardees' affiliations"
      />
      <ul className="sci-companies">
        {companies.map((c) => (
          <li key={c.match.name}>
            <Link href={marketHref(c.match.rows[0].slug)} className="sci-company-name">
              {c.match.name}
            </Link>
            <Ticker listing={c.match.listing} compact />
            <Link href={pipelineOrgHref(c.spelled[0])} className="sci-company-count">
              <Figure method="science-orgs" inLink>
                {c.items}
              </Figure>{' '}
              {c.items === 1 ? 'item' : 'items'}
            </Link>
            {c.latest && <span className="sci-company-latest">latest {c.latest}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 max-w-prose text-xs text-fg-muted">
        Named on a collected paper or grant, matched to the directory by the strict name rule. A
        company not in the directory, or spelled differently by the source, is not shown here.
      </p>
    </section>
  );
}
