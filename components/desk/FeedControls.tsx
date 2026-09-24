import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import { VIEWS, type View } from '@/lib/desk-filter';
import { WINDOWS, WINDOW_LABEL } from '@/lib/follows';
import { SOURCES, SOURCE_LABEL, VIEW_LABEL, type DeskQuery } from '@/lib/desk-query';
import { AutoSubmitForm } from '@/components/portal/AutoSubmitForm';

/** Views as tabs with honest counts, then every filter, then what is showing. */
export function FeedControls({
  query,
  counts,
  rails,
  shown,
  total,
}: {
  query: DeskQuery;
  counts: Record<View, number>;
  rails: readonly Bottleneck[];
  shown: number;
  total: number;
}) {
  return (
    <>
      <nav aria-label="Views" className="desk-views">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={query.href({ view: v })}
            aria-current={query.view === v ? 'page' : undefined}
            scroll={false}
            title={`${counts[v]} ${VIEW_LABEL[v].toLowerCase()} item${counts[v] === 1 ? '' : 's'} with the filters below`}
          >
            {VIEW_LABEL[v]}
            <span className="desk-view-count">{counts[v]}</span>
          </Link>
        ))}
      </nav>

      <AutoSubmitForm action="/account" className="desk-filters">
        <input type="hidden" name="view" value={query.view} />
        <label className="desk-filter desk-filter-q">
          <span className="sr-only">Filter headlines</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Filter headlines, sites, bottlenecks"
            maxLength={120}
          />
        </label>
        <label className="desk-filter">
          <span className="sr-only">Time window</span>
          <select name="w" defaultValue={query.window}>
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w === 'all' ? 'All time' : `Last ${WINDOW_LABEL[w]}`}
              </option>
            ))}
          </select>
        </label>
        <label className="desk-filter">
          <span className="sr-only">Sources</span>
          <select name="src" defaultValue={query.sources}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="desk-filter">
          <span className="sr-only">Effect</span>
          <select name="fx" defaultValue={query.effect ?? ''}>
            <option value="">Any effect</option>
            <option value="tightens">Tightens supply (verified)</option>
            <option value="loosens">Loosens supply (verified)</option>
          </select>
        </label>
        <label className="desk-filter">
          <span className="sr-only">Bottleneck</span>
          <select name="rail" defaultValue={query.rail?.slug ?? ''}>
            <option value="">All {rails.length} rails</option>
            {[...rails]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
        <label className="desk-filter">
          <span className="sr-only">Group by</span>
          <select name="g" defaultValue={query.grouping}>
            <option value="day">Group by day</option>
            <option value="bottleneck">Group by bottleneck</option>
          </select>
        </label>
        <noscript>
          <button type="submit" className="research-button-ghost">
            Apply
          </button>
        </noscript>
      </AutoSubmitForm>

      <p className="desk-showing">
        Showing {shown} of {total}
        {query.filtered && (
          <>
            {' · '}
            <Link
              href={query.href({
                w: undefined,
                src: undefined,
                fx: undefined,
                rail: undefined,
                q: undefined,
                g: undefined,
              })}
            >
              Clear filters
            </Link>
          </>
        )}
        {' · '}
        <Link href="/account/settings#feed">Change defaults</Link>
      </p>
    </>
  );
}
