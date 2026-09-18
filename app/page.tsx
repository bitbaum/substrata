import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { COMPANY } from '@/config/substrata';
import {
  EVENTS,
  candidatesAwaiting,
  eventsNewestFirst,
  eventsSince,
} from '@/config/substrata-events';
import { instrumentsNewestFirst, policyTotals } from '@/config/substrata-policy';
import { SCIENCE } from '@/config/substrata-science';
import { INDUSTRIES, TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { WHEN_LABEL } from '@/lib/labels';
import { marketTotals } from '@/lib/participants';
import { EventList } from '@/components/portal/EventList';
import { Empty, Heading, Page, Shell } from '@/components/portal/Shell';
import { SeverityBar, Status, rowLabel } from '@/components/portal/Status';
import { bottleneckHref, policyHref } from '@/lib/links';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — the bottlenecks between here and much faster technology` },
  description:
    'What is holding back compute, energy, materials and robots: what each constraint is, who makes it, which rules govern it and what would remove it.',
};

const WINDOW_DAYS = 30;

/**
 * Today: what moved, and the four ways into the rest of the site.
 *
 * The front page answers three questions in order — what changed, what is
 * worst right now, and where do I start — and nothing else. Everything below
 * the fold is a route into a section rather than an essay.
 */
export default function TodayPage() {
  const totals = portalTotals();
  const markets = marketTotals();
  const policy = policyTotals();
  const recent = eventsSince(WINDOW_DAYS);
  const tightening = new Set(
    recent.filter((e) => e.effect === 'tightens').flatMap((e) => e.bottlenecks),
  );
  const loosening = new Set(
    recent.filter((e) => e.effect === 'loosens').flatMap((e) => e.bottlenecks),
  );
  const worst = [...BOTTLENECKS]
    .filter((b) => b.horizon === 'now')
    .sort((a, b) => b.binding - a.binding)
    .slice(0, 8);
  const latestEvent = eventsNewestFirst()[0];
  const latestRule = instrumentsNewestFirst()[0];
  const featured =
    worst.find((b) => b.producers.length > 0) ?? BOTTLENECKS.find((b) => b.producers.length > 0);

  const tiles = [
    {
      label: 'Bottlenecks mapped',
      value: String(totals.bottlenecks),
      note: `${totals.bindingNow} judged to be binding right now`,
      href: '/bottlenecks',
    },
    {
      label: 'Makers verified',
      value: `${totals.sourced}/${totals.producers}`,
      note: `across ${markets.organisations} organisations`,
      href: '/markets',
    },
    {
      label: 'Rules tracked',
      value: String(policy.instruments),
      note: `${policy.tightening} slow building, ${policy.loosening} speed it`,
      href: '/policy',
    },
    {
      label: 'Possible fixes',
      value: String(SCIENCE.length),
      note: 'technologies that would relieve a constraint',
      href: '/science',
    },
  ];

  return (
    <Shell currentPath="">
      <Page>
        <div className="hero-split mb-10">
          <header>
            {/* This date is the newest RECORD in the corpus, not the last time
                anything was looked at — labelling it "Updated" made a quiet week
                and a dead research sweep read identically. What was actually
                looked at, and when, is measured on /data. */}
            <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              Newest record {latestEvent ? latestEvent.date : latestRule?.date} ·{' '}
              <Link href="/data" className="underline underline-offset-2">
                how fresh is this?
              </Link>
            </p>
            <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-5xl">
              What is holding technology back, and what is changing.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-secondary">
              Substrata maps the constraints on building more compute, more power, better materials
              and better machines. Every row says how well it is evidenced, and every claim links to
              a source you can open.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/atlas" className="research-button">
                Open the map
              </Link>
              <Link href="/chat" className="research-button-ghost">
                Ask
              </Link>
            </div>
          </header>
          {featured && (
            <figure className="hero-chain">
              <figcaption className="hero-chain-caption">
                <span className="research-kicker">Checkable chain</span>
                <strong>{featured.name}</strong>
                <span>
                  {featured.counts.sourced} of {featured.producers.length} producer rows sourced ·
                  analyst score {featured.binding}/12
                </span>
              </figcaption>
              <div
                className="hero-chain-frame"
                tabIndex={0}
                aria-label={`${featured.name} chain diagram, scroll horizontally on a small screen`}
              >
                {/* Native SVG from the corpus; same figure as the atlas download. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/research/diagram?slug=${featured.slug}`}
                  alt={`Mapped producers and technologies for ${featured.name}. ${featured.counts.sourced} sourced of ${featured.producers.length} producer rows.`}
                />
              </div>
              <p className="hero-chain-links">
                <Link href={`/atlas?chain=${featured.slug}`}>Open in the atlas →</Link>
                <Link href={bottleneckHref(featured.slug)}>Full evidence →</Link>
              </p>
            </figure>
          )}
        </div>

        <dl className="mb-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className="group bg-surface-raised px-4 py-4 transition-colors hover:bg-surface-page sm:px-5"
            >
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {tile.label}
              </dt>
              <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums text-fg-primary group-hover:text-accent sm:text-4xl">
                {tile.value}
              </dd>
              <dd className="mt-1 text-xs leading-snug text-fg-muted">{tile.note}</dd>
            </Link>
          ))}
        </dl>

        <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
          <div>
            <section className="mb-12">
              <Heading
                index="01"
                title={`What changed, last ${WINDOW_DAYS} days`}
                aside={
                  <Link
                    href="/events"
                    className="underline-offset-4 hover:text-fg-primary hover:underline"
                  >
                    All {EVENTS.length} events →
                  </Link>
                }
              />
              {recent.length === 0 ? (
                <Empty
                  what={`Nothing recorded in the last ${WINDOW_DAYS} days.`}
                  next={`${candidatesAwaiting()} candidates found by the automated sweep are waiting to be read.`}
                />
              ) : (
                <EventList events={recent} />
              )}
            </section>

            <section>
              <Heading
                index="02"
                title="Worst right now"
                aside={
                  <Link
                    href="/bottlenecks?horizon=now"
                    className="underline-offset-4 hover:text-fg-primary hover:underline"
                  >
                    All {totals.bindingNow} →
                  </Link>
                }
              />
              <ol className="divide-y divide-subtle border-y border-subtle">
                {worst.map((b) => (
                  <li key={b.slug} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <Link
                        href={bottleneckHref(b.slug)}
                        className="font-medium text-fg-primary underline-offset-4 hover:underline"
                      >
                        {b.name}
                      </Link>
                      <span className="flex items-center gap-4">
                        <SeverityBar value={b.binding} />
                        <Status state={b.state} compact label={rowLabel(b.counts)} />
                      </span>
                    </div>
                    <p className="mt-0.5 max-w-prose text-xs leading-snug text-fg-tertiary">
                      {b.plain}
                      {tightening.has(b.name) && (
                        <span className="ml-2 font-mono uppercase tracking-caps text-status-negative">
                          got worse
                        </span>
                      )}
                      {loosening.has(b.name) && (
                        <span className="ml-2 font-mono uppercase tracking-caps text-status-positive">
                          eased
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-3 font-mono text-xs text-fg-muted">
                {WHEN_LABEL.now} · ranked by severity · judged {worst[0]?.judgedOn}
              </p>
            </section>
          </div>

          <div>
            <section className="mb-12">
              <Heading index="03" title="Start with a technology" />
              <ul className="flex flex-wrap gap-2">
                {TECHNOLOGIES.map((t) => {
                  const count = BOTTLENECKS.filter((b) => b.technologies.includes(t.id)).length;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/bottlenecks?tech=${t.id}`}
                        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-strong px-3 text-sm text-fg-secondary transition-colors hover:border-accent hover:text-fg-primary"
                      >
                        {t.name}
                        <span className="font-mono text-xs tabular-nums text-fg-muted">
                          {count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <h3 className="mt-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                Or an industry
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {INDUSTRIES.map((i) => {
                  const count = BOTTLENECKS.filter((b) => b.industries.includes(i.id)).length;
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/bottlenecks?industry=${i.id}`}
                        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-strong px-3 text-sm text-fg-secondary transition-colors hover:border-accent hover:text-fg-primary"
                      >
                        {i.name}
                        <span className="font-mono text-xs tabular-nums text-fg-muted">
                          {count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <Heading index="04" title="Latest rule" />
              {latestRule ? (
                <Link
                  href={policyHref(latestRule.jurisdiction)}
                  className="block rounded-lg border border-subtle bg-surface-raised p-5 transition-colors hover:border-strong"
                >
                  <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                    {latestRule.date} · {latestRule.body}
                  </p>
                  <p className="mt-2 font-medium text-fg-primary">{latestRule.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
                    {latestRule.summary}
                  </p>
                </Link>
              ) : (
                <Empty what="No rules tracked yet." />
              )}
              <p className="mt-3 text-sm">
                <Link href="/policy" className="text-accent underline-offset-4 hover:underline">
                  Which rules slow building, and who asked for them →
                </Link>
              </p>
            </section>
          </div>
        </div>
      </Page>
    </Shell>
  );
}
