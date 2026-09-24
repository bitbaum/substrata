import Link from 'next/link';

import { INDUSTRIES, TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { Heading } from '@/components/portal/Shell';

/** Section 03: every technology and industry as a filtered way into the rows. */
export function StartHere({ bare = false }: { bare?: boolean }) {
  return (
    <section className={bare ? undefined : 'mb-12'}>
      {!bare && <Heading index="03" title="Start with a technology" />}
      <ul className="flex flex-wrap gap-2">
        {TECHNOLOGIES.map((t) => {
          const count = BOTTLENECKS.filter((b) => b.technologies.includes(t.id)).length;
          return (
            <li key={t.id}>
              <Link
                href={`/bottlenecks?tech=${t.id}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-strong px-3 text-sm text-fg-secondary transition-colors hover:border-accent hover:text-fg-primary"
              >
                {t.name}
                <span className="font-mono text-xs tabular-nums text-fg-muted">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
        Or an industry
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {INDUSTRIES.map((i) => {
          const count = BOTTLENECKS.filter((b) => b.industries.includes(i.id)).length;
          return (
            <li key={i.id}>
              <Link
                href={`/bottlenecks?industry=${i.id}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-strong px-3 text-sm text-fg-secondary transition-colors hover:border-accent hover:text-fg-primary"
              >
                {i.name}
                <span className="font-mono text-xs tabular-nums text-fg-muted">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
