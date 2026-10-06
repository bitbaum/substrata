/**
 * One line of a "what changed" feed: a checked event (effect, link to its
 * entry) or a sweep find (labelled not yet checked, opens the page itself,
 * with Check this). The front page and /events render the same row.
 */
import Link from 'next/link';

import { CheckThis } from './CheckThis';
import { EffectMark } from './EventList';
import { whenLabel, type DeskItem } from '@/lib/desk';
import { bottleneckHref } from '@/lib/links';

export function FeedRow({ item, now }: { item: DeskItem; now: Date }) {
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
