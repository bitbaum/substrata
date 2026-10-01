import Link from 'next/link';

import { EVENTS } from '@/config/substrata-events';
import { CheckThis } from '@/components/portal/CheckThis';
import { EffectMark } from '@/components/portal/EventList';
import { Empty, Heading } from '@/components/portal/Shell';
import { whenLabel, type DeskItem } from '@/lib/desk';
import { HOME_EVENT_DAYS, HOME_LEAD_DAYS, type HomeFeed } from '@/lib/home-feed';
import { bottleneckHref } from '@/lib/links';

function Row({ item, now }: { item: DeskItem; now: Date }) {
  const checked = item.source === 'event';
  return (
    <li className="home-feed-item">
      <time className="home-feed-when" dateTime={item.at} title={item.at}>
        {whenLabel(item.at, now, item.dateOnly)}
      </time>
      <div className="min-w-0">
        <p className="home-feed-meta">
          {checked ? (
            <EffectMark effect={item.effect} />
          ) : (
            <span
              className="home-feed-unchecked"
              title="Found by the automated sweep. Nobody has read it yet; its effect is not judged."
            >
              Not yet checked
            </span>
          )}{' '}
          {item.host && <span className="home-feed-host">{item.host}</span>}
        </p>
        {checked ? (
          <Link href={`/events#${item.id}`} className="home-feed-headline">
            {item.title}
          </Link>
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="home-feed-headline"
          >
            {item.title}{' '}
            <span aria-hidden className="home-feed-external">
              ↗
            </span>
          </a>
        )}
        <p className="home-feed-rails">
          {item.bottlenecks.slice(0, 3).map((name) => (
            <Link key={name} href={bottleneckHref(name)}>
              {name}
            </Link>
          ))}
          {!checked && <CheckThis className="is-inline" claim={item.title} source={item.url} />}
        </p>
      </div>
    </li>
  );
}

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
          <Link href="/events" className="underline-offset-4 hover:text-fg-primary hover:underline">
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
        <ol className="home-feed" id="what-changed">
          {checked.map((item) => (
            <Row key={`${item.source}:${item.id}`} item={item} now={now} />
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
            <Row key={`${item.source}:${item.id}`} item={item} now={now} />
          ))}
        </ol>
      )}
    </section>
  );
}
