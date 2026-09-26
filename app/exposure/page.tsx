import Link from 'next/link';
import type { Metadata } from 'next';

import { STAGES } from '@/config/substrata-stages';
import { currentSession } from '@/lib/auth';
import { readFollows } from '@/lib/desk-store';
import { railsOf } from '@/lib/follows';
import { exposureRows, isListed } from '@/lib/exposure';
import { LISTINGS } from '@/lib/listings';
import {
  parseExposureQuery,
  queryString,
  selectRows,
  SORTS,
  type Params,
} from '@/lib/exposure-query';
import { Empty, Page, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { PageHeader } from '@/components/portal/PageHeader';
import { AutoSubmitForm } from '@/components/portal/AutoSubmitForm';
import { ExposureTable } from '@/components/exposure/ExposureTable';
import './exposure.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Exposure',
  description:
    'Every bottleneck, who holds it, and where their shares trade — with the evidence for each row and a CSV download.',
};

const SORT_LABEL: Record<(typeof SORTS)[number], string> = {
  binding: 'Sort: hardest binding',
  pressure: 'Sort: most tightening',
  company: 'Sort: company A–Z',
  bottleneck: 'Sort: bottleneck A–Z',
};

export default async function ExposurePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = parseExposureQuery(params);
  const session = await currentSession();
  const rails = session?.actorId
    ? new Set(railsOf(await readFollows(session.actorId)).map((b) => b.name))
    : null;
  const all = exposureRows();
  const rows = selectRows(all, query, rails);
  const bottlenecks = new Set(rows.map((r) => r.bottleneck)).size;
  const listed = rows.filter(isListed).length;
  const qs = queryString(query);

  return (
    <Shell>
      <Page>
        <PageHeader
          kicker="Exposure"
          title="Who holds each bottleneck, and where it trades."
          status={
            <>
              <Figure method="exposure-rows">{String(bottlenecks)}</Figure> bottleneck
              {bottlenecks === 1 ? '' : 's'} ·{' '}
              <Figure method="exposure-rows">{String(rows.length)}</Figure> holder row
              {rows.length === 1 ? '' : 's'} ·{' '}
              <Figure method="holders-listed">{String(listed)}</Figure> with a listing (their own or
              a parent&rsquo;s) · listings checked {LISTINGS.checkedOn || 'not yet'}
            </>
          }
          note={
            <>
              Public information only. No position, share of supply or revenue exposure is implied:
              the corpus records who holds a bottleneck, not how much of a company&rsquo;s value
              rests on it.
            </>
          }
          actions={<Link href="/for/equities">X-ray, filings and scenarios →</Link>}
        />

        <AutoSubmitForm action="/exposure" className="desk-filters">
          <label className="desk-filter desk-filter-q">
            <span className="sr-only">Filter</span>
            <input
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Company, bottleneck or ticker"
              maxLength={80}
            />
          </label>
          <label className="desk-filter">
            <span className="sr-only">Stage</span>
            <select name="stage" defaultValue={query.stage ?? ''}>
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="desk-filter">
            <span className="sr-only">Role</span>
            <select name="role" defaultValue={query.role}>
              <option value="all">Makers and part suppliers</option>
              <option value="makers">Makers and capacity holders</option>
              <option value="suppliers">Part suppliers only</option>
            </select>
          </label>
          <label className="desk-filter">
            <span className="sr-only">Sort</span>
            <select name="sort" defaultValue={query.sort}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="exposure-check">
            <input type="checkbox" name="listed" value="1" defaultChecked={query.listedOnly} />
            Listed only
          </label>
          <label className="exposure-check">
            <input type="checkbox" name="sole" value="1" defaultChecked={query.soleOnly} />
            Only recorded maker
          </label>
          {rails && (
            <label className="exposure-check">
              <input type="checkbox" name="mine" value="1" defaultChecked={query.mine} />
              My rails
            </label>
          )}
        </AutoSubmitForm>
        <p className="desk-showing">
          <a href={`/exposure.csv${qs}`} download>
            Download {rows.length === 1 ? 'this row' : `these ${rows.length} rows`} as CSV
          </a>
          {' · '}
          <Link href="/data#method-holders-listed">How listings are found</Link>
          {' · '}
          <Link href="/xray">X-ray your own holdings</Link>
          {' · '}
          <Link href="/scenarios">What if a holder fails</Link>
        </p>

        {rows.length === 0 ? (
          <Empty
            what="No rows match these filters."
            next="The search reads company, bottleneck and ticker; a private company has no ticker."
            action={
              <>
                <Link href="/exposure">Clear the filters</Link>
                <Link href="/search">Search the whole directory</Link>
              </>
            }
          />
        ) : (
          <ExposureTable rows={rows} />
        )}
      </Page>
    </Shell>
  );
}
