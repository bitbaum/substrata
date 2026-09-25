import Link from 'next/link';

import { Highlight } from '@/components/portal/Highlight';
import { SearchBox } from '@/components/portal/SearchBox';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import {
  SEARCH_TYPES,
  SEARCH_TYPE_LABEL,
  isSearchType,
  search,
  type SearchHit,
  type SearchType,
} from '@/lib/search';

export const metadata = { title: 'Search the research' };

/** Queries that show what the index can do, each a real corner of the corpus. */
const EXAMPLES = ['ASML', 'EUV', 'quartz', 'transformer lead time', 'gallium china', 'Japan'];

const PER_GROUP = 5;

function href(q: string, type?: SearchType | ''): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  const s = params.toString();
  return s ? `/search?${s}` : '/search';
}

function Hit({ hit, showType }: { hit: SearchHit; showType: boolean }) {
  return (
    <li className="search-hit">
      <p className="research-kicker">
        {showType && <>{SEARCH_TYPE_LABEL[hit.type].one} · </>}
        {hit.meta}
      </p>
      <h3>
        <Link href={hit.href} data-search-result>
          <Highlight segments={hit.title} />
        </Link>
      </h3>
      <p className="search-hit-snippet">
        <Highlight segments={hit.snippet} />
      </p>
    </li>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 200) : '';
  // `kind` was the old filter's name; links to it keep working.
  const rawType = params.type ?? params.kind;
  const type: SearchType | '' = isSearchType(rawType) ? rawType : '';
  const result = search(q, { type: type || null, limit: 100, perGroup: PER_GROUP });
  const types = SEARCH_TYPES.filter((t) => result.counts[t]);

  return (
    <Shell>
      <Page>
        <SectionHeader
          title="Search"
          lede="Bottlenecks, companies, countries, policy, science, events, evidence, notes and the glossary — one index, grouped by what each result is."
        />
        <SearchBox initialQuery={q} type={type} />
        <p className="search-help" aria-hidden>
          <kbd>/</kbd> to search from anywhere · <kbd>↑</kbd>
          <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open
        </p>

        {!q && (
          <div className="search-empty">
            <p>Try one of these:</p>
            <ul>
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <Link href={href(example)} className="search-chip">
                    {example}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {q && (
          <>
            {result.total > 0 && (
              <nav className="search-filters" aria-label="Filter by type">
                <Link
                  href={href(q)}
                  className="search-chip"
                  aria-current={type === '' ? 'page' : undefined}
                >
                  All <span>{result.total}</span>
                </Link>
                {types.map((t) => (
                  <Link
                    key={t}
                    href={href(q, t)}
                    className="search-chip"
                    aria-current={type === t ? 'page' : undefined}
                  >
                    {SEARCH_TYPE_LABEL[t].many} <span>{result.counts[t]}</span>
                  </Link>
                ))}
              </nav>
            )}

            <p className="search-status" role="status">
              {result.total === 0
                ? `Nothing matches “${q}”.`
                : type
                  ? `${result.counts[type] ?? 0} ${SEARCH_TYPE_LABEL[type].many.toLowerCase()} for “${q}”`
                  : `${result.total} result${result.total === 1 ? '' : 's'} for “${q}”`}
              {result.corrected && (
                <>
                  {' '}
                  · showing results for <strong>{result.corrected}</strong>
                </>
              )}
              {result.partial && <> · no result has every word, so these are the closest</>}
            </p>

            {result.total === 0 && (
              <div className="search-empty">
                <p>Try a company, a material, a country or a broader word:</p>
                <ul>
                  {EXAMPLES.map((example) => (
                    <li key={example}>
                      <Link href={href(example)} className="search-chip">
                        {example}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {type ? (
              <ol className="search-hits">
                {result.hits.map((hit) => (
                  <Hit key={hit.id} hit={hit} showType={false} />
                ))}
              </ol>
            ) : (
              result.groups.map((group) => (
                <section
                  key={group.type}
                  className="search-group"
                  aria-labelledby={`g-${group.type}`}
                >
                  <h2 id={`g-${group.type}`}>
                    {SEARCH_TYPE_LABEL[group.type].many}
                    <span>{group.count}</span>
                  </h2>
                  <ol className="search-hits">
                    {group.hits.map((hit) => (
                      <Hit key={hit.id} hit={hit} showType={false} />
                    ))}
                  </ol>
                  {group.count > group.hits.length && (
                    <Link href={href(q, group.type)} className="search-more">
                      All {group.count} {SEARCH_TYPE_LABEL[group.type].many.toLowerCase()} →
                    </Link>
                  )}
                </section>
              ))
            )}
          </>
        )}
      </Page>
    </Shell>
  );
}
