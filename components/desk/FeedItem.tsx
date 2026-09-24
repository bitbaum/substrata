import Link from 'next/link';

import { EVENT_EFFECT_LABEL } from '@/config/substrata-events';
import { FORM_LABEL } from '@/lib/filings';
import { whenLabel, type DeskItem } from '@/lib/desk';
import { itemKey } from '@/lib/desk-filter';
import { muteHost, toggleMark, verdict } from '@/app/account/actions';

function ActionButton({
  action,
  fields,
  label,
  title,
  active = false,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  title: string;
  active?: boolean;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={active ? 'desk-act is-on' : 'desk-act'} title={title}>
        {label}
      </button>
    </form>
  );
}

export interface ItemState {
  read: boolean;
  saved: boolean;
  hidden: boolean;
}

export function FeedItem({
  item,
  now,
  state,
  reviewer,
  railHref,
}: {
  item: DeskItem;
  now: Date;
  state: ItemState;
  reviewer: boolean;
  railHref: (name: string) => string;
}) {
  const key = itemKey(item);
  const { read, saved, hidden } = state;
  return (
    <li className={read ? 'desk-item is-read' : 'desk-item'}>
      {/* Coloured only where the effect was judged on review; on a lead it is a guess. */}
      <span
        className={`desk-effect ${item.source === 'event' ? `desk-effect-${item.effect}` : ''}`}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          {!read && <span className="desk-unread-dot" title="Unread" />}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="desk-headline">
            {item.title}
            <span className="desk-external" aria-hidden>
              ↗
            </span>
          </a>
        </div>
        <p className="desk-meta">
          <time dateTime={item.at} title={item.at}>
            {whenLabel(item.at, now, item.dateOnly)}
          </time>
          {item.host && <span>{item.host}</span>}
          {item.source === 'lead' && item.alsoAt.length > 0 && (
            <span title={`Also carried by ${item.alsoAt.join(', ')}`}>
              +{item.alsoAt.length} outlet{item.alsoAt.length === 1 ? '' : 's'}
            </span>
          )}
          {item.bottlenecks.slice(0, 2).map((name) => (
            <Link
              key={name}
              href={railHref(name)}
              className="desk-rail-link"
              title="Show only this rail"
            >
              {name}
            </Link>
          ))}
          {item.source === 'event' ? (
            <span
              className="desk-badge desk-badge-verified"
              title="Reviewed and filed by Substrata, with a source and a quote."
            >
              Verified · {EVENT_EFFECT_LABEL[item.effect].toLowerCase()}
            </span>
          ) : item.source === 'filing' ? (
            <span
              className="desk-badge desk-badge-filing"
              title={`${FORM_LABEL[item.form] ?? item.form}, filed with the SEC. The company's own statement to its regulator; Substrata has not judged its effect on the bottleneck.`}
            >
              SEC {item.form}
            </span>
          ) : item.source === 'series' ? (
            <span
              className="desk-badge desk-badge-filing"
              title={
                item.official
                  ? 'A new value from an official statistical API, shown as the agency published it.'
                  : 'A dated number read from its source, with the sentence that carries it.'
              }
            >
              {item.official ? 'Official data' : 'Data point'}
              {item.moved ? ` · moved, ${item.effect}` : ''}
            </span>
          ) : (
            <span
              className="desk-badge"
              title="Found by the sweep on the open web. Nobody has read it yet; it is not a finding."
            >
              Web lead · not yet reviewed
            </span>
          )}
        </p>
        <div className="desk-actions">
          <ActionButton
            action={toggleMark}
            fields={{ key, state: 'saved', on: saved ? '0' : '1' }}
            label={saved ? '★ Saved' : '☆ Save'}
            title={saved ? 'Remove from Saved' : 'Keep this in Saved'}
            active={saved}
          />
          <ActionButton
            action={toggleMark}
            fields={{ key, state: 'read', on: read ? '0' : '1' }}
            label={read ? 'Mark unread' : 'Mark read'}
            title={read ? 'Put it back in Unread' : 'Take it out of Unread'}
          />
          <ActionButton
            action={toggleMark}
            fields={{ key, state: 'hidden', on: hidden ? '0' : '1' }}
            label={hidden ? 'Unhide' : 'Hide'}
            title={hidden ? 'Show it again' : 'Hide this row everywhere; it stays under Hidden'}
          />
          {item.host && item.source === 'lead' && (
            <ActionButton
              action={muteHost}
              fields={{ host: item.host }}
              label={`Mute ${item.host}`}
              title="Never show pages from this site on your desk. Undo in Settings."
            />
          )}
          {reviewer && item.source === 'lead' && (
            <>
              <ActionButton
                action={verdict}
                fields={{ id: item.id, verdict: 'accepted' }}
                label="Accept lead"
                title="Worth filing as an event. It is not published until someone commits it."
              />
              <ActionButton
                action={verdict}
                fields={{ id: item.id, verdict: 'rejected' }}
                label="Reject lead"
                title="Not an event: out of the queue and off every desk"
              />
            </>
          )}
        </div>
      </div>
    </li>
  );
}
