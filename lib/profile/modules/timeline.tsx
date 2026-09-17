import Link from 'next/link';

import { EventList } from '@/components/portal/EventList';
import { Empty } from '@/components/portal/Shell';
import type { CoverageEvent } from '@/config/substrata-events';
import { participantBySlug } from '../../participants';
import { bottleneckBySlug } from '../../bottlenecks';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

interface Timeline {
  events: CoverageEvent[];
  /** A bottleneck's own page need not repeat its name on every row. */
  showBottlenecks: boolean;
  name: string;
  noun: string;
}

/**
 * What has happened, for anything the corpus dates.
 *
 * The company page called this "Timeline" and the bottleneck page called it
 * "What has happened", with two implementations of the same list. One module,
 * one title: a reader moving between profiles should not have to learn that two
 * headings mean the same thing.
 */
const timeline: ProfileModule<Timeline> = {
  id: 'timeline',
  title: t('profile.timeline.title'),
  appliesTo: ['company', 'bottleneck'],
  importance: 80,
  load(entity: Entity) {
    if (entity.kind === 'company') {
      const participant = participantBySlug(entity.key);
      if (!participant) return null;
      return {
        events: participant.events,
        showBottlenecks: true,
        name: participant.name,
        noun: 'this organisation',
      };
    }
    const bottleneck = bottleneckBySlug(entity.key);
    if (!bottleneck) return null;
    return {
      events: bottleneck.events,
      showBottlenecks: false,
      name: bottleneck.name,
      noun: 'this one',
    };
  },
  evidence: (data) => (data.events.length > 0 ? `${data.events.length} dated` : undefined),
  Render({ data }) {
    if (data.events.length === 0)
      return (
        <Empty
          what={`Nothing recorded about ${data.noun} yet.`}
          next="Events are added when a source is read and accepted by hand."
          topic={data.name}
        />
      );
    return (
      <>
        <EventList events={data.events} showBottlenecks={data.showBottlenecks} />
        <p className="mt-3 text-sm">
          <Link href="/events" className="text-accent underline-offset-4 hover:underline">
            All events →
          </Link>
        </p>
      </>
    );
  },
};

export { timeline };
