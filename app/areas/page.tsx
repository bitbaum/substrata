import Link from 'next/link';
import type { Metadata } from 'next';

import { AutoSubmitForm } from '@/components/portal/AutoSubmitForm';
import { PageHeader } from '@/components/portal/PageHeader';
import { Empty, Page, Shell } from '@/components/portal/Shell';
import { areaCards } from '@/lib/registry/area-view';
import { searchAreas } from '@/lib/registry/area-search';
import { registry } from '@/lib/registry/load';

export const metadata: Metadata = {
  title: 'Areas',
  description:
    'The technology areas Substrata tracks, from frontier AI labs and chips to robotics, power, space and biotech: what each is, why it matters, and the companies registered in it.',
};
export const dynamic = 'force-dynamic';

export default async function Areas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { q = '' } = await searchParams;
  const typed = q.trim().slice(0, 80);
  const hits = typed ? searchAreas(typed) : null;
  const total = registry().companies.length;
  const cards = areaCards(null);
  return (
    <Shell>
      <Page>
        <PageHeader
          kicker="Areas"
          title="Where the frontier is being built"
          status={
            <>
              {cards.length} areas · {registry().areas.length - cards.length} sub-areas · {total}{' '}
              registered companies
            </>
          }
          note={
            <>
              An area is a part of the trajectory toward transformative technology. Its definition
              and why it matters are our framing and are labelled so; every company in it is
              registered with its sources, and a number appears only with a citation. A company can
              sit in several areas.
            </>
          }
        />
        <AutoSubmitForm action="/areas" className="desk-filters">
          <label className="desk-filter desk-filter-q">
            <span className="sr-only">Search areas</span>
            <input
              type="search"
              name="q"
              defaultValue={typed}
              placeholder="Area or company: humanoids, HBM, fusion, Figure…"
              maxLength={80}
            />
          </label>
        </AutoSubmitForm>
        {hits ? (
          hits.length ? (
            <ul className="divide-y divide-subtle border-y border-subtle">
              {hits.map((a) => (
                <li key={a.slug} className="py-3">
                  <Link
                    href={`/areas/${a.slug}`}
                    className="tap font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {a.name}
                  </Link>
                  <p className="mt-1 text-sm text-fg-secondary">{a.definition}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              what={`No area or registered company matches "${typed}".`}
              next="It may not be registered yet. Adding a company is one command."
              action={<Link href="/areas">All areas</Link>}
            />
          )
        ) : (
          <ul className="divide-y divide-subtle border-y border-subtle">
            {cards.map(({ area, members, described, children }) => (
              <li key={area.slug} className="py-4">
                <Link
                  href={`/areas/${area.slug}`}
                  className="tap font-heading text-lg font-semibold text-fg-primary underline-offset-4 hover:underline"
                >
                  {area.name}
                </Link>
                <p className="mt-1 max-w-prose text-sm text-fg-secondary">{area.definition}</p>
                <p className="mt-1 font-mono text-xs text-fg-muted">
                  {members} registered · {described} with a cited description
                </p>
                {children.length > 0 && (
                  <p className="mt-2 text-sm text-fg-secondary">
                    {children.map((c, i) => (
                      <span key={c.area.slug}>
                        {i > 0 && ' · '}
                        <Link
                          href={`/areas/${c.area.slug}`}
                          className="tap underline-offset-4 hover:underline"
                        >
                          {c.area.name} ({c.members})
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Page>
    </Shell>
  );
}
