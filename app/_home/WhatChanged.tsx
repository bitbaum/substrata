import Link from 'next/link';

import { EVENTS, type CoverageEvent } from '@/config/substrata-events';
import { EventList } from '@/components/portal/EventList';
import { Empty, Heading } from '@/components/portal/Shell';

import { WINDOW_DAYS } from '@/lib/worst-now';

export { WINDOW_DAYS };

/** Section 01: the events recorded inside the window, newest first. */
export function WhatChanged({ recent }: { recent: CoverageEvent[] }) {
  return (
    <section className="mb-12">
      <Heading
        index="01"
        title={`What changed, last ${WINDOW_DAYS} days`}
        aside={
          <Link href="/events" className="underline-offset-4 hover:text-fg-primary hover:underline">
            All {EVENTS.length} events →
          </Link>
        }
      />
      {recent.length === 0 ? (
        <Empty
          what={`Nothing recorded in the last ${WINDOW_DAYS} days.`}
          next="Leads found by the automated sweep wait for a person to read them; /data says how many."
        />
      ) : (
        <EventList events={recent} />
      )}
    </section>
  );
}
