import Link from 'next/link';

import { EVENTS } from '@/config/substrata-events';
import { FeedRow } from '@/components/portal/FeedRow';
import { Empty, Heading } from '@/components/portal/Shell';
import { HOME_EVENT_DAYS, HOME_LEAD_DAYS, type HomeFeed } from '@/lib/home-feed';

/**
 * Section 01. Checked events first — read by a person, with a quote and a
 * source — then the sweep's newest finds that report a change, labelled
 * unchecked and carrying Check this, so a reader can have one verified
 * against its own source instead of taking it on trust.
 */
export function WhatChanged({ feed, now }: { feed: HomeFeed; now: Date }) {
  const { checked, found, leadsRead } = feed;
  return (
    <section className="mb-12" aria-labelledby="what-changed">
      <Heading
        index="01"
        title="What changed"
        aside={
          <Link
            href="/events"
            className="link-target underline-offset-4 hover:text-fg-primary hover:underline"
          >
            All {EVENTS.length} checked events →
          </Link>
        }
      />
      {checked.length === 0 ? (
        <Empty
          what={`Nothing checked and filed in the last ${HOME_EVENT_DAYS} days.`}
          next="The sweep's newest finds are below, unchecked."
        />
      ) : (
        <ol className="home-feed">
          {checked.map((item) => (
            <FeedRow key={`${item.source}:${item.id}`} item={item} now={now} />
          ))}
        </ol>
      )}

      <h3 className="home-feed-subhead">
        Just found <span>· last {HOME_LEAD_DAYS} days, not yet checked</span>
      </h3>
      {!leadsRead ? (
        <p className="home-feed-note">The sweep&apos;s finds could not be read just now.</p>
      ) : found.length === 0 ? (
        <p className="home-feed-note">
          Nothing the sweep found in the last {HOME_LEAD_DAYS} days reports a change.
        </p>
      ) : (
        <ol className="home-feed">
          {found.map((item) => (
            <FeedRow key={`${item.source}:${item.id}`} item={item} now={now} />
          ))}
        </ol>
      )}
    </section>
  );
}
