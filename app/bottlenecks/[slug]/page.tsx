import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { RESEARCH_PROGRAMMES } from '@/config/substrata-programmes';
import { BOTTLENECKS, CURVE_LABEL, KIND_LABEL, bottleneckBySlug } from '@/lib/bottlenecks';
import { correctionUrl } from '@/lib/site';
import { Heading, Page, Shell } from '@/components/portal/Shell';
import { Status } from '@/components/portal/Status';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return BOTTLENECKS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const b = bottleneckBySlug(slug);
  return b ? { title: b.name, description: b.why } : {};
}

/**
 * One bottleneck: why it gates, who holds it, and the evidence row by row.
 * Candidate pages are linked with their excerpt, so an analyst can promote a
 * row from here in one read.
 */
export default async function BottleneckPage({ params }: RouteParams) {
  const { slug } = await params;
  const b = bottleneckBySlug(slug);
  if (!b) notFound();

  const layers = RESEARCH_PROGRAMMES.flatMap((programme) =>
    programme.layers.filter((layer) => layer.gatedBy.includes(b.name)),
  );

  return (
    <Shell currentPath="">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/" className="hover:text-fg-primary">
            Board
          </Link>
          <span className="mx-2">/</span>
          {CURVE_LABEL[b.curve]}
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {KIND_LABEL[b.kind]}
            {b.area ? ` · ${b.area}` : ''}
            {b.jurisdictions.length ? ` · ${b.jurisdictions.join(' ')}` : ''}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {b.name}
          </h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-fg-secondary">{b.why}</p>
          {b.spec && (
            <p className="mt-3 max-w-prose text-sm text-fg-tertiary">
              <span className="font-mono text-xs uppercase tracking-caps">Grade that ships · </span>
              {b.spec}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Status state={b.state} />
            <a
              href={correctionUrl(b.name)}
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              Report a wrong row
            </a>
          </div>
        </header>

        {b.producers.length > 0 && (
          <section className="mb-12">
            <Heading
              index="01"
              title="Who makes it"
              aside={`${b.counts.sourced} sourced · ${b.counts.candidate} candidate · ${b.counts.total} rows`}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left" style={{ minWidth: '640px' }}>
                <thead>
                  <tr className="border-b border-strong">
                    {['Company', 'Where', 'Step', 'State', 'Evidence'].map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {b.producers.map((p) => (
                    <tr key={p.name}>
                      <td className="py-3 pr-4 align-top text-fg-primary">{p.name}</td>
                      <td className="py-3 pr-4 align-top font-mono text-xs tabular-nums text-fg-secondary">
                        {p.jurisdictions.join(' ')}
                      </td>
                      <td className="py-3 pr-4 align-top text-sm text-fg-secondary">{p.role}</td>
                      <td className="py-3 pr-4 align-top">
                        <Status state={p.verification} compact />
                      </td>
                      <td className="py-3 align-top text-sm">
                        {p.source ? (
                          <a
                            href={p.source}
                            className="text-accent underline-offset-4 hover:underline"
                            rel="noreferrer"
                          >
                            Source ↗
                          </a>
                        ) : p.candidates.length > 0 ? (
                          <details className="group">
                            <summary className="cursor-pointer text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline">
                              {p.candidates.length} candidate page
                              {p.candidates.length > 1 ? 's' : ''}
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
                          <span className="text-fg-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {layers.length > 0 && (
          <section>
            <Heading index={b.producers.length > 0 ? '02' : '01'} title="Which loops wait on it" />
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
