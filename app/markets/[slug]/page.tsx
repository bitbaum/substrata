import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CHAIN_LAYERS, SCARCITY_DETAIL } from '@/config/substrata-participants';
import { MARKET_PARTICIPANTS, SCARCITY_LABEL, participantBySlug } from '@/lib/participants';
import { bottleneckHref, marketsBy } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { bindingSum, companyProfile, type CompanyProfile } from '@/lib/company-profile';
import { buildFeed, hostOf, whenLabel, type DeskItem } from '@/lib/desk';
import { leadsFor } from '@/lib/sweep-store';
import { FollowButton } from '@/components/portal/FollowButton';
import { Page, Shell } from '@/components/portal/Shell';
import { currentSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { parseFollows } from '@/lib/follows';
import { EntityProfile, type ExtraSection } from '@/components/portal/EntityProfile';
import { Figure } from '@/components/portal/Figure';
import { resolveIn } from '@/lib/entities/registry';
import { t } from '@/lib/i18n/messages';

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

type Lead = Extract<DeskItem, { source: 'lead' }>;

/**
 * Sweep leads on the chokepoints this company holds.
 *
 * A lead is a page the sweep found and nobody has read, so it is labelled as
 * exactly that and never counted as an event. The database is optional here:
 * a build, or a box without it, simply shows no leads.
 */
async function leadsOn(profile: CompanyProfile): Promise<Lead[]> {
  const names = profile.held.map((h) => h.bottleneck.name);
  if (names.length === 0) return [];
  try {
    const feed = buildFeed(profile.events, await leadsFor(names));
    return feed.filter((item): item is Lead => item.source === 'lead').slice(0, 6);
  } catch {
    return [];
  }
}

function LeadList({ leads }: { leads: Lead[] }) {
  const now = new Date();
  return (
    <>
      <ul className="divide-y divide-subtle border-y border-subtle">
        {leads.map((lead) => (
          <li key={lead.id} className="py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="rounded border border-strong px-1.5 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
                title="Found by the sweep on the open web. Not yet read by an analyst."
              >
                Unread lead
              </span>
              <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                {whenLabel(lead.at, now)}
                {lead.dated ? '' : ' (found)'}
              </span>
              {lead.bottlenecks[0] && (
                <Link
                  href={bottleneckHref(lead.bottlenecks[0])}
                  className="font-mono text-xs uppercase tracking-caps text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  {lead.bottlenecks[0]}
                </Link>
              )}
            </div>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-primary">
              <a href={lead.url} rel="noreferrer" className="underline-offset-4 hover:underline">
                {lead.title}
              </a>{' '}
              <span className="text-xs text-fg-tertiary">{lead.host} ↗</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
        Pages the sweep found on these chokepoints. Nobody here has read them yet; they are not
        events and not evidence.
      </p>
    </>
  );
}

function Fact({
  label,
  value,
  note,
  href,
  title,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  href?: string;
  title?: string;
}) {
  const inner = (
    <>
      <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">{label}</span>
      <span className="mt-1 block font-heading text-2xl font-semibold tabular-nums text-fg-primary">
        {value}
      </span>
      {note && <span className="mt-0.5 block text-xs leading-snug text-fg-tertiary">{note}</span>}
    </>
  );
  const cls = 'block bg-surface-raised px-4 py-3';
  return href ? (
    <Link href={href} title={title} className={`${cls} group hover:bg-surface-page`}>
      {inner}
    </Link>
  ) : (
    <div title={title} className={cls}>
      {inner}
    </div>
  );
}

/** What it is and why it matters to the chain, from the joins, not from prose. */
function Lede({ profile }: { profile: CompanyProfile }) {
  const { participant: p, held, soleRecorded, trackedBottlenecks } = profile;
  const what = p.role ?? held.map((h) => h.step).join(', ');
  const tracked = <Figure method="bottleneck-count">{trackedBottlenecks}</Figure>;
  if (held.length === 0)
    return (
      <>
        {what}. Holds none of the {tracked} bottlenecks tracked here; listed as context for its step
        of the chain.
      </>
    );
  return (
    <>
      {what} — holds <Figure method="bottlenecks-held">{held.length}</Figure> of the {tracked}{' '}
      bottlenecks tracked here
      {soleRecorded.length > 0 && (
        <>
          , and is the only maker recorded for{' '}
          {soleRecorded.map((h, i) => (
            <React.Fragment key={h.bottleneck.slug}>
              {i > 0 && ' and '}
              <Link
                href={bottleneckHref(h.bottleneck.slug)}
                className="text-fg-primary hover:underline"
              >
                {h.bottleneck.name}
              </Link>
            </React.Fragment>
          ))}
        </>
      )}
      .
    </>
  );
}

/**
 * A company profile: what it is, which chokepoints it holds and how hard each
 * binds, then the shared modules.
 *
 * The header is derived. Every figure in it links to the rows it counts or to
 * the assessment it sums, and the evidence note is one line rather than a
 * warning box, because the sections below carry each row's own evidence.
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
  const leads = await leadsOn(profile);
  const extra: ExtraSection[] =
    leads.length > 0
      ? [
          {
            id: 'leads',
            title: t('profile.leads.title'),
            importance: 45,
            evidence: `${leads.length} found by the sweep, unread`,
            node: <LeadList leads={leads} />,
          },
        ]
      : [];

  const { held, soleRecorded, hardest } = profile;
  const related = profile.relatedEvents.length;
  const citation = p.directorySource ?? p.existenceVerifiedBy?.url ?? null;

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

        <header className="mb-4 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {layer?.name}
            {profile.places.length > 0 && ' · '}
            {profile.places.map((place, i) => (
              <React.Fragment key={place.code}>
                {i > 0 && ', '}
                {place.href ? (
                  <Link href={place.href} className="hover:text-fg-primary hover:underline">
                    {place.name}
                  </Link>
                ) : (
                  place.name
                )}
              </React.Fragment>
            ))}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <h1 className="max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
              {p.name}
            </h1>
            {session?.actorId && (
              <FollowButton type="company" id={p.slug} following={following} label={p.name} />
            )}
          </div>
          <p className="mt-3 max-w-prose text-lg leading-relaxed text-fg-secondary">
            <Lede profile={profile} />
          </p>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">
            <Fact
              label="Bottlenecks held"
              value={
                <>
                  <Figure method="bottlenecks-held" inLink>
                    {held.length}
                  </Figure>
                  <span className="text-sm font-normal text-fg-muted">
                    {' '}
                    of {profile.trackedBottlenecks}
                  </span>
                </>
              }
              note={
                held.length === 0
                  ? 'none of the tracked rows'
                  : soleRecorded.length > 0
                    ? `${soleRecorded.length} with no other maker recorded`
                    : 'each with another maker recorded'
              }
              href={held.length > 0 ? '#chokepoints' : '/bottlenecks'}
            />
            {hardest && (
              <Fact
                label="Hardest binding"
                value={
                  <>
                    <Figure
                      inLink
                      estimate={{
                        by: 'Substrata',
                        on: hardest.bottleneck.judgedOn,
                        basis: bindingSum(hardest.bottleneck),
                      }}
                    >
                      {hardest.bottleneck.binding}
                    </Figure>
                    <span className="text-sm font-normal text-fg-muted">/12</span>
                  </>
                }
                note={`${hardest.bottleneck.name} · judged ${hardest.bottleneck.judgedOn}`}
                href={`${bottleneckHref(hardest.bottleneck.slug)}#severity`}
                title={bindingSum(hardest.bottleneck)}
              />
            )}
            {p.scarcity && (
              <Fact
                label="Directory grade"
                value={<span className="text-xl">{SCARCITY_LABEL[p.scarcity]}</span>}
                note="a judgement, not a sourced fact"
                href={marketsBy('grade', p.scarcity)}
                title={SCARCITY_DETAIL[p.scarcity]}
              />
            )}
            {(profile.events.length > 0 || related > 0) && (
              <Fact
                label="Events"
                value={
                  <Figure method="company-events" inLink>
                    {profile.events.length}
                  </Figure>
                }
                note={related > 0 ? `name it · ${related} more on what it holds` : 'name it'}
                href="#events"
              />
            )}
          </div>

          {p.why && (
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-tertiary">
              <span className="font-mono text-xs uppercase tracking-caps">Why graded so · </span>
              {p.why}
            </p>
          )}
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
            {citation ? (
              <>
                Role cited from{' '}
                <a href={citation} rel="noreferrer" className="text-accent hover:underline">
                  {hostOf(citation)} ↗
                </a>
                .{' '}
              </>
            ) : (
              'Role not yet sourced; a lead, not a finding. '
            )}
            {p.scarcity && 'The grade is this project’s judgement. '}
            <a href={correctionUrl(p.name)} className="text-accent hover:underline">
              Report an error
            </a>
          </p>
        </header>

        {entity && <EntityProfile entity={entity} extra={extra} />}
      </Page>
    </Shell>
  );
}
