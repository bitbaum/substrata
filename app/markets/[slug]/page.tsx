import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CHAIN_LAYERS } from '@/config/substrata-participants';
import { MARKET_PARTICIPANTS, participantBySlug } from '@/lib/participants';
import { marketsBy } from '@/lib/links';
import { companyProfile } from '@/lib/company-profile';
import { Page, Shell } from '@/components/portal/Shell';
import { currentSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { parseFollows } from '@/lib/follows';
import { EntityProfile, type ExtraSection } from '@/components/portal/EntityProfile';
import { resolveIn } from '@/lib/entities/registry';
import { t } from '@/lib/i18n/messages';
import { CompanyHeader } from './_sections/CompanyHeader';
import { LeadList, leadsOn } from './_sections/leads';
import { FilingList, filingsOf } from './_sections/filings';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return MARKET_PARTICIPANTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const p = participantBySlug(slug);
  if (!p) return {};
  const profile = companyProfile(slug);
  const held = profile?.held.map((h) => h.bottleneck.name) ?? [];
  return {
    title: p.name,
    description: held.length
      ? `${p.name}: ${held.join(', ')} — how hard each binds, who else makes it, and the sources.`
      : (p.why ?? `${p.name} in the ${p.layer} layer of the chain, and how it is evidenced.`),
  };
}

/**
 * A company profile: what it is, which chokepoints it holds and how hard each
 * binds, then the shared modules.
 */
export default async function ParticipantPage({ params }: RouteParams) {
  const { slug } = await params;
  const p = participantBySlug(slug);
  const profile = companyProfile(slug);
  if (!p || !profile) notFound();

  const session = await currentSession();
  let following = false;
  if (session?.actorId) {
    try {
      const row = await database().query<{ topics: unknown }>(
        'SELECT topics FROM research_preferences WHERE actor_id=$1',
        [session.actorId],
      );
      following = parseFollows(row.rows[0]?.topics).companies.includes(p.slug);
    } catch {
      following = false;
    }
  }
  const layer = CHAIN_LAYERS.find((l) => l.id === p.layer);
  const entity = resolveIn('company', p.slug);
  const [leads, filings] = await Promise.all([leadsOn(profile), filingsOf(p.slug)]);
  const extra: ExtraSection[] = [
    ...(filings.length > 0
      ? [
          {
            id: 'filings',
            title: t('profile.filings.title'),
            importance: 50,
            evidence: `${filings.length} most recent, from SEC EDGAR`,
            node: <FilingList filings={filings} company={p.name} />,
          },
        ]
      : []),
    ...(leads.length > 0
      ? [
          {
            id: 'leads',
            title: t('profile.leads.title'),
            importance: 45,
            evidence: `${leads.length} found by the sweep, unread`,
            node: <LeadList leads={leads} />,
          },
        ]
      : []),
  ];

  return (
    <Shell currentPath="markets">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/markets" className="hover:text-fg-primary">
            Markets
          </Link>
          <span className="mx-2">/</span>
          <Link href={marketsBy('layer', p.layer)} className="hover:text-fg-primary">
            {layer?.name}
          </Link>
        </nav>

        <CompanyHeader
          p={p}
          profile={profile}
          layerName={layer?.name}
          signedIn={Boolean(session?.actorId)}
          following={following}
        />

        {entity && <EntityProfile entity={entity} extra={extra} />}
      </Page>
    </Shell>
  );
}
