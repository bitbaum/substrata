import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntityProfile } from '@/components/portal/EntityProfile';
import { Page, Shell } from '@/components/portal/Shell';
import { resolveIn } from '@/lib/entities/registry';
import { formatShare } from '@/lib/resources/format';
import { countryPages } from '@/lib/world/pages';
import { countryProfile } from '@/lib/world/profile';
import { CountryHeader } from './_sections/CountryHeader';

interface RouteParams {
  params: Promise<{ iso2: string }>;
}

export function generateStaticParams(): Array<{ iso2: string }> {
  return countryPages().map((iso2) => ({ iso2 }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { iso2 } = await params;
  const p = countryProfile(iso2);
  if (!p) return {};
  const lead = p.produces[0];
  return {
    title: `${p.name}: what it produces, who operates there, what it restricts`,
    description: lead
      ? `${p.name}: ${lead.share !== null ? `${formatShare(lead.share)} of world ${lead.label.toLowerCase()}` : lead.label}, ${p.companies.length} companies, ${p.instruments.length} rules, ${p.restricts.all.length} export measures — from USGS, EIA, the policy register and the OECD inventory.`
      : `${p.name} in the chain: ${p.companies.length} companies, ${p.instruments.length} rules, ${p.restricts.all.length} export measures.`,
  };
}

/**
 * A country profile: its head, then the shared modules — what it produces,
 * the companies here, the rules it sets, where it restricts and is
 * restricted, what has happened, what it connects to, discussion. The
 * sections are the registry's; this page only knows the head.
 */
export default async function CountryPage({ params }: RouteParams) {
  const { iso2 } = await params;
  const id = iso2.toLowerCase();
  const p = countryProfile(id);
  const entity = resolveIn('country', id);
  if (!p || !entity || !countryPages().includes(id)) notFound();
  return (
    <Shell>
      <Page sections>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/atlas?view=world" className="hover:text-fg-primary">
            Atlas
          </Link>
          <span className="mx-2">/</span>
          <span>{p.region}</span>
        </nav>
        <CountryHeader p={p} />
        <EntityProfile entity={entity} />
      </Page>
    </Shell>
  );
}
