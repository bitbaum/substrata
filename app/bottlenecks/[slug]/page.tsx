import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  INSTRUMENT_EFFECT_LABEL,
  JURISDICTION_LABEL,
  instrumentsFor,
} from '@/config/substrata-policy';
import { callsAbout } from '@/config/substrata-calls';
import { RESEARCH_PROGRAMMES } from '@/config/substrata-programmes';
import { readinessLabel, scienceFor } from '@/config/substrata-science';
import { STAGE_LABEL, stageById } from '@/config/substrata-stages';
import { INDUSTRY_LABEL, TECHNOLOGY_LABEL } from '@/config/substrata-taxonomy';
import { BOTTLENECKS, KIND_LABEL, bottleneckBySlug, slugOf } from '@/lib/bottlenecks';
import { EVIDENCE, SEVERITY, WHEN, WHEN_LABEL } from '@/lib/labels';
import { correctionUrl } from '@/lib/site';
import { EventList } from '@/components/portal/EventList';
import { Empty, Heading, Page, Shell } from '@/components/portal/Shell';
import { SeverityBar, Status, rowLabel } from '@/components/portal/Status';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return BOTTLENECKS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const b = bottleneckBySlug(slug);
  return b ? { title: b.name, description: b.plain } : {};
}

const TESTS = [
  ['concentration', 'How few suppliers qualify'],
  ['substitution', 'How hard to replace'],
  ['leadTime', 'Decision to new capacity'],
  ['inelasticity', 'Can the buyer walk away'],
] as const;

/**
 * One bottleneck, in a fixed order every entity page on the site follows:
 * what it is, how hard it binds, who makes it, what rules govern it, what
 * would remove it, what has happened, and how to correct it.
 */
export default async function BottleneckPage({ params }: RouteParams) {
  const { slug } = await params;
  const b = bottleneckBySlug(slug);
  if (!b) notFound();

  const stage = stageById(b.stage);
  const rules = instrumentsFor(b.name);
  const fixes = scienceFor(b.name);
  const calls = callsAbout(b.name);
  const layers = RESEARCH_PROGRAMMES.flatMap((programme) =>
    programme.layers.filter((layer) => layer.gatedBy.includes(b.name)),
  );
  let n = 0;
  const next = () => String(++n).padStart(2, '0');

  return (
    <Shell currentPath="bottlenecks">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/bottlenecks" className="hover:text-fg-primary">
            Bottlenecks
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/bottlenecks?stage=${b.stage}`} className="hover:text-fg-primary">
            {STAGE_LABEL[b.stage]}
          </Link>
        </nav>

        <header className="mb-10 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {KIND_LABEL[b.kind]}
            {b.area ? ` · ${b.area}` : ''}
            {b.jurisdictions.length ? ` · ${b.jurisdictions.join(' ')}` : ''}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {b.name}
          </h1>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-fg-secondary">{b.plain}</p>

          <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle sm:grid-cols-3">
            <div className="bg-surface-raised px-4 py-3">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {SEVERITY.label}
              </dt>
              <dd className="mt-1.5">
                <SeverityBar value={b.binding} />
              </dd>
              <dd className="mt-1 text-xs text-fg-muted">{SEVERITY.short}</dd>
            </div>
            <div className="bg-surface-raised px-4 py-3">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {WHEN.label}
              </dt>
              <dd className="mt-1.5 text-sm text-fg-primary">{WHEN_LABEL[b.horizon]}</dd>
              <dd className="mt-1 text-xs text-fg-muted">judged {b.judgedOn}</dd>
            </div>
            <div className="bg-surface-raised px-4 py-3">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {EVIDENCE.label}
              </dt>
              <dd className="mt-1.5">
                <Status state={b.state} label={rowLabel(b.counts)} />
              </dd>
              <dd className="mt-1 text-xs text-fg-muted">
                {b.counts.total > 0 ? `${b.counts.total} maker rows` : 'single node, no maker list'}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {b.technologies.map((t) => (
              <Link
                key={t}
                href={`/bottlenecks?tech=${t}`}
                className="text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
              >
                {TECHNOLOGY_LABEL[t]}
              </Link>
            ))}
            {b.industries.map((i) => (
              <Link
                key={i}
                href={`/bottlenecks?industry=${i}`}
                className="text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
              >
                {INDUSTRY_LABEL[i]}
              </Link>
            ))}
            <a
              href={correctionUrl(b.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
        </header>

        <section className="mb-12">
          <Heading index={next()} title="Why it holds things up" />
          <p className="max-w-prose text-base leading-relaxed text-fg-secondary">{b.why}</p>
          {b.spec && (
            <p className="mt-3 max-w-prose text-sm text-fg-tertiary">
              <span className="font-mono text-xs uppercase tracking-caps">Grade that ships · </span>
              {b.spec}
            </p>
          )}
          <p className="mt-3 max-w-prose text-sm text-fg-tertiary">
            <span className="font-mono text-xs uppercase tracking-caps">
              Part of the process ·{' '}
            </span>
            {stage.name}, which takes {stage.reliefTime.toLowerCase()} to loosen once somebody
            decides to.
          </p>
        </section>

        <section className="mb-12">
          <Heading
            index={next()}
            title={`${SEVERITY.label}: ${b.binding} of 12`}
            aside={`judged ${b.judgedOn} · a judgement, not a measurement`}
          />
          <div className="grid gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle sm:grid-cols-4">
            {TESTS.map(([key, label]) => (
              <div key={key} className="bg-surface-raised px-4 py-3">
                <div className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  {label}
                </div>
                <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-fg-primary">
                  {b.score[key]}
                  <span className="text-sm font-normal text-fg-muted"> / 3</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-fg-secondary">
            {b.rationale}
          </p>
        </section>

        {b.producers.length > 0 && (
          <section className="mb-12">
            <Heading
              index={next()}
              title="Who makes it"
              aside={`${b.counts.sourced} verified · ${b.counts.candidate} unchecked · ${b.counts.total} rows`}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-strong">
                    {['Organisation', 'Where', 'Step', 'Evidence'].map((column, i) => (
                      <th
                        key={column}
                        scope="col"
                        className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                          i === 1 ? 'hidden sm:table-cell' : ''
                        }`}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {b.producers.map((p) => (
                    <tr key={p.name} className="group align-top">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/markets/${slugOf(p.name)}`}
                          className="text-fg-primary underline-offset-4 group-hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="hidden py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary sm:table-cell">
                        {p.jurisdictions.join(' ')}
                      </td>
                      <td className="py-3 pr-4 text-sm text-fg-secondary">{p.role}</td>
                      <td className="py-3 text-sm">
                        {p.source ? (
                          <a
                            href={p.source}
                            className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
                            rel="noreferrer"
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1.5 w-1.5 rounded-full bg-status-positive"
                            />
                            Verified source ↗
                          </a>
                        ) : p.candidates.length > 0 ? (
                          <details>
                            <summary className="inline-flex cursor-pointer items-center gap-2 text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline">
                              <span
                                aria-hidden
                                className="inline-block h-1.5 w-1.5 rounded-full bg-status-warning"
                              />
                              {p.candidates.length} found, unchecked
                            </summary>
                            <ul className="mt-2 space-y-3">
                              {p.candidates.map((c) => (
                                <li key={c.url} className="max-w-prose">
                                  <a
                                    href={c.url}
                                    rel="noreferrer"
                                    className="text-accent underline-offset-4 hover:underline"
                                  >
                                    {c.title || c.url} ↗
                                  </a>
                                  <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">
                                    “{c.excerpt}”
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <Status state="unverified" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mb-12">
          <Heading
            index={next()}
            title="Rules that govern it"
            aside={
              <Link
                href="/policy"
                className="underline-offset-4 hover:text-fg-primary hover:underline"
              >
                All policy →
              </Link>
            }
          />
          {rules.length === 0 ? (
            <Empty
              what="No rule has been researched for this one yet."
              next="Policy coverage is being built jurisdiction by jurisdiction."
            />
          ) : (
            <ul className="divide-y divide-subtle border-y border-subtle">
              {rules.map((rule) => (
                <li key={rule.id} className="py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                      {rule.date}
                    </span>
                    <Link
                      href={`/policy/${rule.jurisdiction}`}
                      className="font-mono text-xs uppercase tracking-caps text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
                    >
                      {JURISDICTION_LABEL[rule.jurisdiction]}
                    </Link>
                    <span className="text-sm text-fg-secondary">
                      {INSTRUMENT_EFFECT_LABEL[rule.effect]}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-fg-primary">{rule.title}</p>
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                    {rule.summary}
                  </p>
                  <p className="mt-1 text-xs">
                    <a
                      href={rule.source}
                      rel="noreferrer"
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      {rule.body} ↗
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-12">
          <Heading
            index={next()}
            title="What would remove it"
            aside={
              <Link
                href="/science"
                className="underline-offset-4 hover:text-fg-primary hover:underline"
              >
                All science →
              </Link>
            }
          />
          {fixes.length === 0 ? (
            <Empty what="No candidate relief has been written up for this one yet." />
          ) : (
            <ul className="divide-y divide-subtle border-y border-subtle">
              {fixes.map((fix) => {
                const relief = fix.relieves.find((r) => r.bottleneck === b.name);
                return (
                  <li key={fix.id} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <Link
                        href={`/science/${fix.id}`}
                        className="font-medium text-fg-primary underline-offset-4 hover:underline"
                      >
                        {fix.name}
                      </Link>
                      <span className="font-mono text-xs text-fg-secondary">
                        {fix.readiness}/9 · {readinessLabel(fix.readiness)}
                      </span>
                    </div>
                    {relief && (
                      <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                        {relief.mechanism}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {calls.length > 0 && (
          <section className="mb-12">
            <Heading
              index={next()}
              title="What we have predicted"
              aside={
                <Link
                  href="/calls"
                  className="underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  All calls →
                </Link>
              }
            />
            <ul className="divide-y divide-subtle border-y border-subtle">
              {calls.map((call) => (
                <li key={call.id} className="py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                      {call.madeOn}
                    </span>
                    <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                      {call.resolution ? call.resolution.verdict : `open until ${call.resolveBy}`}
                    </span>
                  </div>
                  <p className="mt-1 max-w-prose text-fg-primary">{call.claim}</p>
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-fg-tertiary">
                    <span className="font-mono uppercase tracking-caps">Settled by · </span>
                    {call.settledBy}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-12">
          <Heading
            index={next()}
            title="What has happened"
            aside={
              <Link
                href="/events"
                className="underline-offset-4 hover:text-fg-primary hover:underline"
              >
                All events →
              </Link>
            }
          />
          {b.events.length === 0 ? (
            <Empty
              what="Nothing recorded for this one yet."
              next="Events are added when a source is read and accepted by hand."
            />
          ) : (
            <EventList events={b.events} showBottlenecks={false} />
          )}
        </section>

        {layers.length > 0 && (
          <section>
            <Heading index={next()} title="Which loops wait on it" />
            <ul className="divide-y divide-subtle border-y border-subtle">
              {layers.map((layer) => (
                <li
                  key={layer.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                >
                  <Link
                    href="/research"
                    className="text-fg-primary underline-offset-4 hover:underline"
                  >
                    {layer.name}
                  </Link>
                  <span className="font-mono text-xs text-fg-secondary">{layer.period}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Page>
    </Shell>
  );
}
