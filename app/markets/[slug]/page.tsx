import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CHAIN_LAYERS, SCARCITY_DETAIL } from '@/config/substrata-participants';
import { MARKET_PARTICIPANTS, SCARCITY_LABEL, participantBySlug } from '@/lib/participants';
import { bottleneckHref } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { FollowButton } from '@/components/portal/FollowButton';
import { Page, Shell } from '@/components/portal/Shell';
import { currentSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { parseFollows } from '@/lib/follows';
import { EntityProfile } from '@/components/portal/EntityProfile';
import { resolveIn } from '@/lib/entities/registry';

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
  return {
    title: p.name,
    description:
      p.why ??
      `What ${p.name} makes among the constrained materials, and how well each row is evidenced.`,
  };
}

/**
 * A company profile is its identity header plus the shared modules.
 *
 * What it makes, where it matters, what could relieve it, what the profile does
 * not answer and the timeline all used to be hand-written here. They are
 * modules now, so they are ordered and numbered by the registry, they vanish
 * when they have nothing to say, and offering one of them on another kind is a
 * change to `appliesTo` rather than a second copy of the markup.
 */
export default async function ParticipantPage({ params }: RouteParams) {
  const { slug } = await params;
  const p = participantBySlug(slug);
  if (!p) notFound();

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

  return (
    <Shell currentPath="markets">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/markets" className="hover:text-fg-primary">
            Markets
          </Link>
          <span className="mx-2">/</span>
          {layer?.name}
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {layer?.name}
            {p.jurisdictions.length ? ` · ${p.jurisdictions.join(' ')}` : ''}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {p.name}
          </h1>
          {session?.actorId && (
            <p className="mt-3">
              <FollowButton type="company" id={p.slug} following={following} label={p.name} />
            </p>
          )}
          {p.role && <p className="mt-3 text-base text-fg-secondary">{p.role}</p>}
          {p.why && (
            <p className="mt-3 max-w-prose text-base leading-relaxed text-fg-secondary">{p.why}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {p.scarcity ? (
              <span className="text-fg-secondary">
                <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  Replaceability ·{' '}
                </span>
                {SCARCITY_LABEL[p.scarcity]}
              </span>
            ) : (
              <span className="text-fg-muted">Not graded in the directory</span>
            )}
            {/* The grade means nothing without its definition, so it sits with
                the grade rather than at the foot of the page. */}
            <a
              href={correctionUrl(p.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
          {p.scarcity && (
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
              {SCARCITY_DETAIL[p.scarcity]}
            </p>
          )}
          {p.existenceVerifiedBy ? (
            <p className="mt-4 max-w-prose rounded border-l-2 border-status-positive bg-surface-raised px-4 py-2 text-xs leading-relaxed text-fg-tertiary">
              That this organisation makes{' '}
              <Link
                href={bottleneckHref(p.existenceVerifiedBy.bottleneck)}
                className="text-accent underline-offset-4 hover:underline"
              >
                {p.existenceVerifiedBy.bottleneck}
              </Link>{' '}
              is{' '}
              <a
                href={p.existenceVerifiedBy.url}
                rel="noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                backed by a source ↗
              </a>
              . The replaceability grade above is a judgement and is not sourced — no single page
              asserts how hard a company would be to replace.
            </p>
          ) : (
            p.inDirectory && (
              <p className="mt-4 max-w-prose rounded border-l-2 border-status-warning bg-surface-raised px-4 py-2 text-xs leading-relaxed text-fg-tertiary">
                Nothing on this row is sourced yet. The description and grade come from the
                directory and are leads, not findings.
              </p>
            )
          )}
        </header>

        {entity && <EntityProfile entity={entity} />}
      </Page>
    </Shell>
  );
}
