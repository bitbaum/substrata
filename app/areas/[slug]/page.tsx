import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/portal/PageHeader';
import { Empty, Page, Shell } from '@/components/portal/Shell';
import { bottleneckBySlug } from '@/lib/bottlenecks';
import { allAreas } from '@/lib/registry/areas';
import { areaPage } from '@/lib/registry/area-view';
import { KIND_LABEL } from '@/lib/registry/schema';
import { bottleneckHref, marketHref } from '@/lib/links';
import { countryNameOf } from '@/lib/world/pages';

interface RouteParams {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ n?: string }>;
}

export function generateStaticParams() {
  return allAreas().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Pick<RouteParams, 'params'>): Promise<Metadata> {
  const p = areaPage((await params).slug);
  return p ? { title: p.area.name, description: p.area.definition } : {};
}

const PAGE = 60;
const CAPS = 'font-mono text-xs uppercase tracking-caps text-fg-tertiary';

export default async function AreaPage({ params, searchParams }: RouteParams) {
  const { slug } = await params;
  const p = areaPage(slug);
  if (!p) notFound();
  const limit = Math.min(Math.max(Number((await searchParams).n) || PAGE, PAGE), 2000);
  const { area } = p;
  const bottlenecks = area.bottlenecks.flatMap((b) => {
    const x = bottleneckBySlug(b);
    return x ? [x] : [];
  });
  return (
    <Shell>
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/areas">Areas</Link>
              {p.trail.map((a) => (
                <span key={a.slug}>
                  {' / '}
                  <Link href={`/areas/${a.slug}`}>{a.name}</Link>
                </span>
              ))}
            </>
          }
          title={area.name}
          status={
            <>
              {p.members.length} registered · {p.described} with a cited description
            </>
          }
          note={<>{area.definition}</>}
        />
        <section className="mb-8">
          <p className={CAPS}>Why it matters (our framing)</p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-primary">{area.why}</p>
          {bottlenecks.length > 0 && (
            <p className="mt-3 text-sm text-fg-secondary">
              Bottlenecks tracked here:{' '}
              {bottlenecks.map((b, i) => (
                <span key={b.slug}>
                  {i > 0 && ', '}
                  <Link
                    href={bottleneckHref(b.slug)}
                    className="tap underline-offset-4 hover:underline"
                  >
                    {b.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </section>
        {area.keyNumbers.length > 0 && (
          <section className="mb-8">
            <p className={CAPS}>Key numbers</p>
            <ul className="mt-2 divide-y divide-subtle border-y border-subtle">
              {area.keyNumbers.map((k) => (
                <li key={k.label} className="py-2 text-sm">
                  <span className="text-fg-primary">
                    {k.label}: {k.value}
                  </span>{' '}
                  <a
                    href={k.evidence.source}
                    rel="noreferrer"
                    className="tap text-fg-tertiary underline-offset-4 hover:underline"
                  >
                    source
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {p.children.length > 0 && (
          <section className="mb-8">
            <p className={CAPS}>Sub-areas</p>
            <ul className="mt-2 divide-y divide-subtle border-y border-subtle">
              {p.children.map((c) => (
                <li key={c.area.slug} className="py-3">
                  <Link
                    href={`/areas/${c.area.slug}`}
                    className="tap font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {c.area.name}
                  </Link>
                  <span className="ml-3 font-mono text-xs text-fg-muted">
                    {c.members} registered
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <p className={CAPS}>Companies</p>
          {p.members.length === 0 ? (
            <Empty
              what="No company is registered in this area yet."
              next="Registering one is a single command; the page shows what is known and what is not."
              action={<Link href="/data/companies">How companies are chosen</Link>}
            />
          ) : (
            <ul className="mt-2 divide-y divide-subtle border-y border-subtle">
              {p.members.slice(0, limit).map(({ company: c, role }) => (
                <li key={c.slug} className="py-3">
                  <Link
                    href={marketHref(c.slug)}
                    className="tap font-medium text-fg-primary underline-offset-4 hover:underline wrap-anywhere"
                  >
                    {c.name}
                  </Link>
                  {c.ids.ticker && (
                    <span className="ml-3 font-mono text-xs text-fg-tertiary">{c.ids.ticker}</span>
                  )}
                  <p className="mt-1 font-mono text-xs text-fg-muted">
                    {KIND_LABEL[c.kind]}
                    {c.country ? ` · ${countryNameOf(c.country.toLowerCase()) ?? c.country}` : ''}
                  </p>
                  {(role || c.summary) && (
                    <p className="mt-1 max-w-prose text-sm text-fg-secondary">
                      {role ?? c.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {p.members.length > limit && (
            <p className="list-more">
              <Link
                href={`/areas/${slug}?n=${limit + PAGE}`}
                scroll={false}
                className="tap inline-flex items-center"
              >
                Show more ({p.members.length - limit} left)
              </Link>
            </p>
          )}
        </section>
      </Page>
    </Shell>
  );
}
