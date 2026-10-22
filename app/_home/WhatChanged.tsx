import Link from 'next/link';

import { EVENTS } from '@/config/substrata-events';
import { FeedRow } from '@/components/portal/FeedRow';
import { Heading } from '@/components/portal/Shell';
import { whatChangedRows, type HomeFeed } from '@/lib/home-feed';

/**
 * What changed: the newest checked events, or — when none was filed lately —
 * the sweep's newest finds, each marked not yet checked and carrying Check
 * this. With neither there is nothing true to say, so nothing is drawn: the
 * front page has no empty state.
 */
export function WhatChanged({ feed, now }: { feed: HomeFeed; now: Date }) {
  const rows = whatChangedRows(feed);
  if (!rows) return null;
  return (
    <section className="home-section" aria-labelledby="what-changed">
      <Heading
        title="What changed"
        aside={
          <Link href="/events" className="home-more">
            All {EVENTS.length} checked events →
          </Link>
        }
      />
      {rows.kind === 'found' && (
        <p className="home-feed-note">
          Nothing has been checked and filed lately. These are the sweep&apos;s newest finds, not
          yet read by a person.
        </p>
      )}
      <ol className="home-feed">
        {rows.items.map((item) => (
          <FeedRow key={`${item.source}:${item.id}`} item={item} now={now} />
        ))}
      </ol>
    </section>
  );
}
