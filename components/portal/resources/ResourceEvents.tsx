/**
 * What has happened to this resource: accepted events on the bottlenecks it
 * feeds or whose headline names it, then the sweep's unread leads on those
 * bottlenecks — labelled as leads, never counted as events.
 */
import Link from 'next/link';

import { EventList } from '@/components/portal/EventList';
import { LeadList, type Lead } from '@/app/markets/[slug]/_sections/leads';
import type { ResourceProfile } from '@/lib/resources/profile';

export function ResourceEvents({ profile, leads }: { profile: ResourceProfile; leads: Lead[] }) {
  if (profile.events.length === 0 && leads.length === 0) return null;
  return (
    <>
      {profile.events.length > 0 && <EventList events={profile.events.slice(0, 12)} />}
      {leads.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Unread leads
          </h3>
          <LeadList leads={leads} />
        </>
      )}
      <p className="mt-3 text-sm">
        <Link href="/events" className="link-target text-accent underline-offset-4 hover:underline">
          All events →
        </Link>
      </p>
    </>
  );
}
