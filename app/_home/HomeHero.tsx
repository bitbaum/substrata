import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import { Figure } from '@/components/portal/Figure';
import { bottleneckHref } from '@/lib/links';

/** The front page's opening: what the site is, and one chain you can check. */
export function HomeHero({
  newest,
  featured,
}: {
  newest: string | undefined;
  featured: Bottleneck | undefined;
}) {
  return (
    <div className="hero-split mb-10">
      <header>
        {/* This date is the newest RECORD in the corpus, not the last time
            anything was looked at — labelling it "Updated" made a quiet week
            and a dead research sweep read identically. What was actually
            looked at, and when, is measured on /data. */}
        <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          Newest record {newest} ·{' '}
          <Link href="/data/freshness" className="underline underline-offset-2">
            how fresh is this?
          </Link>
        </p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-5xl">
          What is holding technology back, and what is changing.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-secondary">
          Substrata maps the constraints on building more compute, more power, better materials and
          better machines. Every row says how well it is evidenced, every sourced claim links to the
          source, and every number opens to show where it came from.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/atlas" className="research-button">
            Open the map
          </Link>
          <Link href="/chat" className="research-button-ghost">
            Ask
          </Link>
        </div>
      </header>
      {featured && (
        <figure className="hero-chain">
          <figcaption className="hero-chain-caption">
            <span className="research-kicker">Checkable chain</span>
            <strong>{featured.name}</strong>
            <span>
              <Figure method="sourced-rows">
                {featured.counts.sourced} of {featured.producers.length}
              </Figure>{' '}
              producer rows sourced · severity{' '}
              <Figure method="severity">{featured.binding}/12</Figure> (judged)
            </span>
          </figcaption>
          <div
            className="hero-chain-frame"
            tabIndex={0}
            aria-label={`${featured.name} chain diagram, scroll horizontally on a small screen`}
          >
            {/* Native SVG from the corpus; same figure as the atlas download. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/research/diagram?slug=${featured.slug}`}
              alt={`Mapped producers and technologies for ${featured.name}. ${featured.counts.sourced} sourced of ${featured.producers.length} producer rows.`}
            />
          </div>
          <p className="hero-chain-links">
            <Link href={`/atlas?chain=${featured.slug}`}>Open in the atlas →</Link>
            <Link href={bottleneckHref(featured.slug)}>Full evidence →</Link>
          </p>
        </figure>
      )}
    </div>
  );
}
