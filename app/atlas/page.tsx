import Link from 'next/link';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { atlasData } from '@/lib/atlas';
import { bottleneckHref, marketHref } from '@/lib/links';
import { BOTTLENECKS } from '@/lib/bottlenecks';

export const metadata = {
  title: 'Chain atlas',
  description:
    'Explore the materials, machines, people and permissions behind technological progress, with evidence beside each claim.',
};

export default async function AtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; chain?: string }>;
}) {
  const { topic: requested, chain: requestedChain } = await searchParams;
  const topic = TECHNOLOGIES.find((t) => t.id === requested)?.id ?? '';
  const stages = atlasData(topic);
  const chain =
    BOTTLENECKS.find((b) => b.slug === requestedChain) ??
    BOTTLENECKS.find((b) => b.producers.length > 0)!;
  return (
    <Shell currentPath="atlas">
      <Page>
        <SectionHeader
          title="Follow the physical world behind progress"
          lede="Technology depends on materials, machines, energy, expertise and permission. Explore where the research places each constraint, then inspect the companies and sources behind it."
          action={
            <Link href="/api/research/export" className="text-accent underline">
              Download the data
            </Link>
          }
        />
        <form action="/atlas" className="research-search">
          <label htmlFor="atlas-topic">Explore a technology</label>
          <select name="topic" id="atlas-topic" defaultValue={topic}>
            <option value="">All technologies</option>
            {TECHNOLOGIES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit">Explore</button>
        </form>
        <section className="atlas-overview">
          <h2 className="font-heading text-2xl font-semibold">From producer to technology</h2>
          <p className="my-3 max-w-prose text-sm text-fg-secondary">
            Trace one bottleneck through the corpus. Each line has a declared meaning, and every
            producer’s source status stays visible.
          </p>
          <form action="/atlas" className="research-search">
            <input type="hidden" name="topic" value={topic} />
            <label htmlFor="chain-choice">Bottleneck</label>
            <select id="chain-choice" name="chain" defaultValue={chain.slug}>
              {BOTTLENECKS.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
            <button type="submit">Draw chain</button>
          </form>
          <div
            className="my-6 overflow-x-auto"
            tabIndex={0}
            aria-label="Chain diagram, scroll horizontally on a small screen"
          >
            {/* Native SVG is downloadable, has no scripts and carries the same corpus identifiers as the page. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/research/diagram?slug=${chain.slug}`}
              alt={`Research relationships for ${chain.name}; ${chain.producers.length} producer rows, ${chain.counts.sourced} sourced. Full evidence is linked below.`}
              className="min-w-3xl w-full"
            />
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-accent">
            <Link href={bottleneckHref(chain.slug)}>Read the full evidence →</Link>
            <a href={`/api/research/diagram?slug=${chain.slug}&download=1`} download>
              Download SVG figure
            </a>
          </div>
        </section>
        <figure className="atlas-overview">
          <figcaption>
            <strong>Coverage across the system</strong>
            <p>
              Bar length counts mapped bottlenecks; the sourced count is shown beside it. This is a
              coverage chart, not a measurement of capacity or importance.
            </p>
          </figcaption>
          <div className="atlas-bars">
            {stages.map((s) => (
              <a href={`#stage-${s.id}`} key={s.id}>
                <span>{s.name}</span>
                <meter
                  min={0}
                  max={Math.max(1, ...stages.map((s) => s.total))}
                  value={s.total}
                  aria-label={`${s.name}: ${s.total} mapped bottlenecks`}
                />
                <span>
                  {s.total} mapped · {s.sourced} sourced
                </span>
              </a>
            ))}
          </div>
        </figure>
        <p className="my-8 max-w-prose text-sm text-fg-secondary">
          The map groups records by research stage. It does not assert that every stage feeds the
          next, or that a listed producer supplies another company. Open a record to check the
          specific relationship.{' '}
          <Link href="/data" className="text-accent underline">
            Read the data method
          </Link>
          .
        </p>
        <div className="atlas-stages">
          {stages.map((s, i) => (
            <section key={s.id} id={`stage-${s.id}`}>
              <header>
                <span className="research-kicker">
                  {String(i + 1).padStart(2, '0')} / {s.total} mapped
                </span>
                <h2>{s.name}</h2>
                <p>{s.consumes}</p>
              </header>
              {s.rows.length === 0 ? (
                <p className="text-sm text-fg-secondary">
                  No bottlenecks mapped for this selection. This is a research gap.
                </p>
              ) : (
                <details className="atlas-records">
                  <summary>Explore {s.total} bottlenecks</summary>
                  <ul>
                    {s.rows.map((b) => (
                      <li key={b.slug}>
                        <Link className="atlas-node" href={bottleneckHref(b.slug)}>
                          <span>{b.name}</span>
                          <small>
                            {b.state} · assessment {b.binding}/12
                          </small>
                        </Link>
                        <p>{b.plain}</p>
                        <details>
                          <summary>Evidence and organisations ({b.producers.length})</summary>
                          <p className="my-2 text-xs">
                            Score is an analyst judgement dated {b.judgedOn}. {b.rationale}
                          </p>
                          <ul>
                            {b.producers.map((p) => (
                              <li key={`${b.slug}-${p.name}`}>
                                <Link href={marketHref(p.name)}>{p.name}</Link> · {p.verification}
                                {p.source && (
                                  <>
                                    {' '}
                                    ·{' '}
                                    <a href={p.source} rel="noreferrer">
                                      Primary source ↗
                                    </a>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                          {b.producers.length === 0 && (
                            <Link href={bottleneckHref(b.slug)}>
                              Open the bottleneck’s evidence
                            </Link>
                          )}
                        </details>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </div>
      </Page>
    </Shell>
  );
}
