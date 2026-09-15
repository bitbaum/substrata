import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CHAIN_LAYERS, SCARCITY_DETAIL } from '@/config/substrata-participants';
import { INDUSTRY_LABEL, TECHNOLOGY_LABEL } from '@/config/substrata-taxonomy';
import { MARKET_PARTICIPANTS, SCARCITY_LABEL, participantBySlug } from '@/lib/participants';
import { slugOf } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { EventList } from '@/components/portal/EventList';
import { Empty, Heading, Page, Shell } from '@/components/portal/Shell';
import { Status } from '@/components/portal/Status';

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

export default async function ParticipantPage({ params }: RouteParams) {
  const { slug } = await params;
  const p = participantBySlug(slug);
  if (!p) notFound();

  const layer = CHAIN_LAYERS.find((l) => l.id === p.layer);
  let n = 0;
  const next = () => String(++n).padStart(2, '0');

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
            <a
              href={correctionUrl(p.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
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

        <section className="mb-12">
          <Heading
            index={next()}
            title="What it makes"
            aside={p.produces.length > 0 ? `${p.produces.length} mapped` : undefined}
          />
          {p.produces.length === 0 ? (
            <Empty
              what="No covered material is mapped to this organisation yet."
              next="It appears here as context for the chain it sits in."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-strong">
                    {['Material', 'Step', 'Evidence'].map((c) => (
                      <th
                        key={c}
                        scope="col"
                        className="py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {p.produces.map((item) => (
                    <tr key={item.bottleneck} className="align-top">
                      <td className="py-3 pr-4">
                        <Link
                          href={bottleneckHref(item.slug)}
                          className="text-fg-primary underline-offset-4 hover:underline"
                        >
                          {item.bottleneck}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-sm text-fg-secondary">{item.step}</td>
                      <td className="py-3 text-sm">
                        {item.source ? (
                          <a
                            href={item.source}
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1.5 w-1.5 rounded-full bg-status-positive"
                            />
                            Verified source ↗
                          </a>
                        ) : (
                          <Status
                            state={item.verification}
                            label={
                              item.candidateCount > 0
                                ? `${item.candidateCount} source${item.candidateCount > 1 ? 's' : ''} found, unchecked`
                                : undefined
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {(p.technologies.length > 0 || p.industries.length > 0) && (
          <section className="mb-12">
            <Heading index={next()} title="Where this matters" />
            <div className="flex flex-wrap gap-2">
              {p.technologies.map((t) => (
                <Link
                  key={t}
                  href={`/bottlenecks?tech=${t}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-strong px-3 text-sm text-fg-secondary hover:border-accent hover:text-fg-primary"
                >
                  {TECHNOLOGY_LABEL[t]}
                </Link>
              ))}
              {p.industries.map((i) => (
                <Link
                  key={i}
                  href={`/markets?industry=${i}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-strong px-3 text-sm text-fg-secondary hover:border-accent hover:text-fg-primary"
                >
                  {INDUSTRY_LABEL[i]}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <Heading
            index={next()}
            title="Timeline"
            aside={
              <Link
                href="/events"
                className="underline-offset-4 hover:text-fg-primary hover:underline"
              >
                All events →
              </Link>
            }
          />
          {p.events.length === 0 ? (
            <Empty
              what="Nothing recorded about this organisation yet."
              next="Events are added when a source is read and accepted."
            />
          ) : (
            <EventList events={p.events} />
          )}
        </section>

        {p.scarcity && (
          <p className="mt-10 max-w-prose text-xs leading-relaxed text-fg-muted">
            {SCARCITY_DETAIL[p.scarcity]}
          </p>
        )}
      </Page>
    </Shell>
  );
}
