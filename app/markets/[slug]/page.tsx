import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CHAIN_LAYERS } from '@/config/substrata-participants';
import { MARKET_PARTICIPANTS, participantBySlug } from '@/lib/participants';
import { marketsBy } from '@/lib/links';
import { companyProfile } from '@/lib/company-profile';
import { COMPANY_SECTION_IMPORTANCE } from '@/lib/company-sections';
import { Page, Shell } from '@/components/portal/Shell';
import { currentSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { parseFollows } from '@/lib/follows';
import { EntityProfile, type ExtraSection } from '@/components/portal/EntityProfile';
import { resolveEntity, resolveIn } from '@/lib/entities/registry';
import { isIdentified, isStub, type Entity } from '@/lib/entities/types';
import { universeEntry } from '@/lib/universe/store';
import { IdentifiedCompany } from './_sections/IdentifiedCompany';
import { aliasEntry } from '@/lib/graph/aliases';
import { StubCompany } from './_sections/StubCompany';
import { t } from '@/lib/i18n/messages';
import { WhatHappened, happenedEvidence } from '@/lib/profile/modules/company-happened';
import { ChainRole, CompanyHeader } from './_sections/CompanyHeader';
import { LeadList, leadsOn } from './_sections/leads';
import { UpdateNews } from '@/components/updates/UpdateNews';
import { filingsOf } from './_sections/filings';
import { HiringSection, hiringOf } from './_sections/hiring';
import { TakePartSection } from './_sections/take-part';
import { takePartRoutes } from '@/lib/take-part';
import { listingFor } from '@/lib/listings';
import { marketSections } from '@/components/company/marketSections';
import { marketCompanyFor } from '@/lib/market-data/company';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Directory companies are built ahead; the ~1,200 stub companies (named only
 * by the relation graph) and the tier B companies (lib/universe) render on first request, so the build stays the size
 * it was. `dynamicParams` is Next's default; it is stated because the stubs
 * depend on it.
 */
export const dynamicParams = true;

export function generateStaticParams(): Array<{ slug: string }> {
  return MARKET_PARTICIPANTS.map((p) => ({ slug: p.slug }));
}

/** A company the relation graph names and the directory does not profile. */
function stubOf(slug: string): Entity | undefined {
  const entity = resolveEntity(`company:${slug}`);
  return entity && isStub(entity) ? entity : undefined;
}

/** A tier B company: admitted to the universe on cited evidence, not profiled. */
function identifiedOf(slug: string): Entity | undefined {
  const entity = resolveEntity(`company:${slug}`);
  return entity && isIdentified(entity) ? entity : undefined;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const p = participantBySlug(slug);
  if (!p) {
    const other = identifiedOf(slug) ?? stubOf(slug);
    return other ? { title: other.name, description: other.summary } : {};
  }
  const profile = companyProfile(slug);
  const held = profile?.held.map((h) => h.bottleneck.name) ?? [];
  return {
    title: p.name,
    description: held.length
      ? `${p.name}: ${held.join(', ')} — how hard each binds, who owns it, who else makes it, and the sources.`
      : (p.why ?? `${p.name} in the ${p.layer} layer of the chain, and how it is evidenced.`),
  };
}

/**
 * A company profile, in one reading order on every company: the header (for a
 * listed company the quote, then the share price, key statistics and its role
 * in the chain with the five tiles; otherwise the five tiles in the header),
 * what it holds (with a meter per row), who owns it,
 * the numbers it reports, what has happened (one axis, then the lists),
 * unread leads, what could loosen its grip, ways to take part, hiring, others
 * at its step, what it connects to, sources, discussion. The section menu
 * (a strip on a phone, a rail from 1280px) is built from the headings, so it
 * lists exactly what is on the page.
 */
export default async function ParticipantPage({ params }: RouteParams) {
  const { slug } = await params;
  const p = participantBySlug(slug);
  if (!p) {
    // A reviewed alias (config/entity-aliases.ts) is the same firm: one page.
    const alias = aliasEntry(`company:${slug}`);
    if (alias) permanentRedirect(`/markets/${alias.canonical.slice('company:'.length)}`);
    const identified = identifiedOf(slug);
    const entry = identified ? universeEntry(slug) : undefined;
    const stub = stubOf(slug);
    if (!stub && !(identified && entry)) notFound();
    return (
      <Shell>
        <Page sections>
          <nav
            aria-label="Breadcrumb"
            className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
          >
            <Link href="/markets" className="hover:text-fg-primary">
              Markets
            </Link>
          </nav>
          {identified && entry ? (
            <IdentifiedCompany entity={identified} entry={entry} />
          ) : (
            <StubCompany entity={stub!} />
          )}
        </Page>
      </Shell>
    );
  }
  const profile = companyProfile(slug);
  if (!profile) notFound();

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
  const [leads, filings, hiring] = await Promise.all([
    leadsOn(profile),
    filingsOf(p.slug),
    hiringOf(p.slug),
  ]);
  const routes = takePartRoutes({
    slug: p.slug,
    name: p.name,
    role: p.role,
    listing: listingFor(p.slug) ?? null,
    ownPage: p.directorySource,
    hiring,
    hasFilings: filings.length > 0,
  });
  // A listed company reads like a quote page: quote and chart first, its role
  // in the chain as a section below Key statistics (docs/design/company-page.md).
  const listed = marketCompanyFor(p.slug) !== null;
  const news =
    profile.held.length > 0 ? <UpdateNews scope={{ kind: 'company', slug: p.slug }} /> : null;
  const happened = profile.events.length + profile.relatedEvents.length + filings.length > 0;
  const extra: ExtraSection[] = [
    ...marketSections({ slug: p.slug, name: p.name }),
    ...(listed
      ? [
          {
            id: 'chain-role',
            title: 'Role in the chain',
            importance: COMPANY_SECTION_IMPORTANCE['chain-role'],
            evidence:
              'what it rests on, holds and constrains, its grade and where its role is cited',
            node: (
              <>
                <ChainRole p={p} profile={profile} />
                {news && <div className="mt-8">{news}</div>}
              </>
            ),
          },
        ]
      : []),
    // Replaces the registry's "what has happened": same id and anchor, with
    // the SEC filings (per request) on the same axis as the events.
    ...(happened
      ? [
          {
            id: 'events',
            title: t('profile.companyEvents.title'),
            importance: COMPANY_SECTION_IMPORTANCE.events,
            evidence: happenedEvidence(profile, filings.length),
            node: <WhatHappened p={profile} filings={filings} />,
          },
        ]
      : []),
    {
      id: 'take-part',
      title: t('profile.takePart.title'),
      importance: COMPANY_SECTION_IMPORTANCE['take-part'],
      evidence: 'how to reach it, not whether to',
      node: <TakePartSection routes={routes} />,
    },
    ...(hiring
      ? [
          {
            id: 'hiring',
            title: 'Hiring',
            importance: COMPANY_SECTION_IMPORTANCE.hiring,
            evidence: hiring.live ? 'from its public job board' : 'official careers page',
            node: <HiringSection hiring={hiring} slug={p.slug} />,
          },
        ]
      : []),
    ...(leads.length > 0
      ? [
          {
            id: 'leads',
            title: t('profile.leads.title'),
            importance: COMPANY_SECTION_IMPORTANCE.leads,
            evidence: `${leads.length} found by the sweep, unread`,
            node: <LeadList leads={leads} />,
          },
        ]
      : []),
  ];

  return (
    <Shell>
      <Page sections>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
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
          listed={listed}
        />

        {!listed && news && <div className="mb-10">{news}</div>}

        {entity && <EntityProfile entity={entity} extra={extra} />}
      </Page>
    </Shell>
  );
}
