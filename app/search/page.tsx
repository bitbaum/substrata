import Link from 'next/link';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { researchDocuments, searchResearch } from '@/lib/research-index';
import { ENTITY_KINDS } from '@/lib/entities/types';

export const metadata = { title: 'Search the research' };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.slice(0, 200) : '';
  // The closed set, not a second copy of it: 'country' and 'capital' existed as
  // entities but were missing from this list, so they could not be filtered for.
  const kinds = ENTITY_KINDS;
  const kind = (ENTITY_KINDS as readonly string[]).includes(params.kind ?? '') ? params.kind : '';
  const matches = searchResearch(researchDocuments(), q);
  const rows = matches.filter((d) => !kind || d.kind === kind);
  return (
    <Shell currentPath="search">
      <Page>
        <SectionHeader
          title="Find your way through the research"
          lede="Search materials, companies, technologies and explanations together. Every result takes you to its evidence and context."
        />
        <form action="/search" className="research-search">
          <label className="sr-only" htmlFor="research-query">
            Search the research
          </label>
          <input
            id="research-query"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Try silicon, grid, ASML, or qualification"
            maxLength={200}
          />
          <label className="sr-only" htmlFor="research-kind">
            Result type
          </label>
          <select id="research-kind" name="kind" defaultValue={kind}>
            <option value="">Everything</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button type="submit">Search</button>
        </form>
        <p className="my-6 text-sm text-fg-secondary">
          {rows.length} results{q ? ` for “${q}”` : ''}
        </p>
        {rows.length === 0 && (
          <p>
            Try a company name, material, or a broader term.{' '}
            <Link href="/search" className="text-accent underline">
              Clear filters
            </Link>
          </p>
        )}
        <ol className="research-results">
          {rows.map((d) => (
            <li key={d.id}>
              <span className="research-kicker">
                {d.kind} · {d.evidence}
              </span>
              <h2>
                <Link href={d.href}>{d.title}</Link>
              </h2>
              <p>
                {d.text.slice(0, 280)}
                {d.text.length > 280 ? '…' : ''}
              </p>
            </li>
          ))}
        </ol>
      </Page>
    </Shell>
  );
}
