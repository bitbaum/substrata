import Link from 'next/link';

import { BOTTLENECKS } from '@/lib/bottlenecks';
import type { JobFilter } from '@/lib/careers-query';
import { Figure } from '@/components/portal/Figure';

/**
 * Which bottlenecks are hiring most: open postings filed under each, under
 * the page's other filters. A bar is a count of postings on the boards
 * Substrata reads — never the size of an industry's hiring.
 */
export function HiringByBottleneck({
  counts,
  filter,
}: {
  counts: Map<string, number>;
  filter: JobFilter;
}) {
  const rows = BOTTLENECKS.map((b) => ({ b, n: counts.get(b.slug) ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const max = rows[0]?.n ?? 1;
  const href = (slug: string | undefined) => {
    const qs = new URLSearchParams(
      Object.entries({ ...filter, bottleneck: slug, remote: filter.remote ? '1' : undefined })
        .map(([k, v]) => [k === 'seniority' ? 'level' : k, v] as const)
        .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''),
    ).toString();
    return qs ? `/careers?${qs}` : '/careers';
  };

  return (
    <section className="careers-hiring" aria-labelledby="hiring-heading">
      <div className="careers-section-head">
        <h2 id="hiring-heading">Which bottlenecks are hiring most</h2>
        <p>
          Open roles filed under each bottleneck. One role can sit under several.{' '}
          {filter.bottleneck && <Link href={href(undefined)}>Show every bottleneck</Link>}
        </p>
      </div>
      <ol className="careers-bars">
        {rows.map(({ b, n }) => (
          <li key={b.slug} className={filter.bottleneck === b.slug ? 'is-active' : undefined}>
            <Link href={href(b.slug)} className="careers-bar-name" scroll={false}>
              {b.name}
            </Link>
            <span className="careers-bar" aria-hidden>
              <span style={{ width: `${Math.max(2, (n / max) * 100)}%` }} />
            </span>
            <span className="careers-bar-n">
              <Figure method="careers-classify">{String(n)}</Figure>
            </span>
            <Link href={`/careers/${b.slug}`} className="careers-bar-more">
              Roles, skills, training →
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
