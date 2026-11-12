import Link from 'next/link';
import type { Metadata } from 'next';

import { AutoSubmitForm } from '@/components/portal/AutoSubmitForm';
import { Empty, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { THEMES, TIERS } from '@/config/universe-themes';
import { moreHref, rowsShown, shownQuery } from '@/lib/list-more';
import {
  DIRECTORY_MAX,
  DIRECTORY_PAGE,
  directoryRows,
  directorySpec,
  parseDirectory,
  queryDirectory,
} from '@/lib/universe/directory';
import { PAGE_KINDS, pageKindCounts } from '@/lib/universe/page-kinds';
import { universeEntries } from '@/lib/universe/store';
import { marketHref } from '@/lib/links';
import { countryNameOf } from '@/lib/world/pages';

export const metadata: Metadata = {
  title: 'Every company in the universe',
  description:
    'Every company Substrata covers, filterable by tier, theme and country and searchable by name, ticker or theme, with an honest count of what each page can show.',
};
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

const KIND = new Map(PAGE_KINDS.map((k) => [k.kind, k]));

export default async function CompanyDirectory({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const entries = universeEntries();
  const rows = directoryRows(entries);
  const kinds = pageKindCounts(entries);
  const spec = directorySpec(rows);
  const query = shownQuery(
    parseDirectory(params, spec),
    rowsShown(params, DIRECTORY_PAGE, DIRECTORY_MAX),
  );
  const result = queryDirectory(rows, spec, query);
  const chosen = (key: string) => query.facets[key]?.[0] ?? '';
  const countries = [...new Set(rows.flatMap((r) => (r.country ? [r.country] : [])))]
    .map((iso) => ({ iso, name: countryNameOf(iso.toLowerCase()) ?? iso }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const n = (facet: string, key: string) => result.counts[facet]?.[key] ?? 0;
  const left = result.matched - result.rows.length;

  return (
    <Shell>
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/markets">Markets</Link> / Directory
            </>
          }
          title="Every company in the universe"
          status={
            <>
              {result.total} companies in · {kinds.filer} with a quote and SEC filings ·{' '}
              {kinds.quote} with a quote only · {kinds.identity} identity only
            </>
          }
          note={
            <>
              Every row is a company on the list: registered on purpose in the frontier registry
              (the older ones from the three written tests: theme, size floor, registry identifier).
              The last line says what its page can actually show; the rule, the floors and what is
              left out are on <Link href="/data/companies">why a company is on the list</Link>.
            </>
          }
        />
        <AutoSubmitForm action="/markets/directory" className="desk-filters">
          <label className="desk-filter desk-filter-q">
            <span className="sr-only">Search companies</span>
            <input
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Name, ticker, theme: AMD, Rheinmetall, uranium…"
              maxLength={80}
            />
          </label>
          <label className="desk-filter">
            <span className="sr-only">Theme</span>
            <select name="theme" defaultValue={chosen('theme')}>
              <option value="">All themes</option>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({n('theme', t.id)})
                </option>
              ))}
            </select>
          </label>
          <label className="desk-filter">
            <span className="sr-only">Country</span>
            <select name="country" defaultValue={chosen('country')}>
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.name} ({n('country', c.iso)})
                </option>
              ))}
            </select>
          </label>
          <label className="desk-filter">
            <span className="sr-only">Tier</span>
            <select name="tier" defaultValue={chosen('tier')}>
              <option value="">Any tier</option>
              {TIERS.filter((t) => t.tier !== 'C').map((t) => (
                <option key={t.tier} value={t.tier}>
                  {t.label} ({n('tier', t.tier)})
                </option>
              ))}
            </select>
          </label>
          <label className="desk-filter">
            <span className="sr-only">What the page shows</span>
            <select name="kind" defaultValue={chosen('kind')}>
              <option value="">Any page</option>
              {PAGE_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label} ({n('kind', k.kind)})
                </option>
              ))}
            </select>
          </label>
        </AutoSubmitForm>
        <p className="mb-3 font-mono text-xs text-fg-muted" role="status">
          {result.matched === result.total
            ? `${result.total} companies`
            : `${result.matched} of ${result.total} companies match`}
        </p>
        {result.matched === 0 ? (
          <Empty
            what="No company in the universe matches these filters."
            next="It may be out on a test or not yet looked at; the rule page answers for any name and queues the look."
            action={
              <>
                <Link href="/markets/directory">Clear the filters</Link>
                <Link href="/data/companies">Why a company is on the list</Link>
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-subtle border-y border-subtle">
            {result.rows.map((r) => (
              <li key={r.slug} className="py-3">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <Link
                    href={marketHref(r.slug)}
                    className="tap font-medium text-fg-primary underline-offset-4 hover:underline wrap-anywhere"
                  >
                    {r.name}
                  </Link>
                  {r.ticker && (
                    <span className="font-mono text-xs text-fg-tertiary">
                      {r.ticker}
                      {r.venue ? ` · ${r.venue}` : ''}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-fg-secondary">{r.themeLabels.join(' · ')}</p>
                <p className="mt-1 font-mono text-xs text-fg-muted">
                  {TIERS.find((t) => t.tier === r.tier)!.label}
                  {r.country ? ` · ${countryNameOf(r.country.toLowerCase()) ?? r.country}` : ''}
                  {' · '}
                  {KIND.get(r.kind)!.label}
                </p>
              </li>
            ))}
          </ul>
        )}
        {left > 0 && (
          <p className="list-more">
            <Link
              href={moreHref('/markets/directory', params, query, spec, DIRECTORY_PAGE)}
              scroll={false}
              className="tap inline-flex items-center"
            >
              Show more ({left} left)
            </Link>
          </p>
        )}
      </Page>
    </Shell>
  );
}
