import Link from 'next/link';

import type { CompanyProfile } from '@/lib/company-profile';
import { buildFeed, whenLabel, type DeskItem } from '@/lib/desk';
import { bottleneckHref } from '@/lib/links';
import { LEAD_EXPIRY_DAYS } from '@/lib/lead-expiry';
import { leadsFor } from '@/lib/sweep-queue';

export type Lead = Extract<DeskItem, { source: 'lead' }>;

/**
 * Sweep leads on the chokepoints this company holds.
 *
 * A lead is a page the sweep found and nobody has read, so it is labelled as
 * exactly that and never counted as an event. The database is optional here:
 * a build, or a box without it, simply shows no leads.
 */
export async function leadsOn(profile: CompanyProfile): Promise<Lead[]> {
  const names = profile.held.map((h) => h.bottleneck.name);
  if (names.length === 0) return [];
  try {
    const feed = buildFeed(profile.events, await leadsFor(names));
    return feed.filter((item): item is Lead => item.source === 'lead').slice(0, 6);
  } catch {
    return [];
  }
}

export function LeadList({ leads }: { leads: Lead[] }) {
  const now = new Date();
  return (
    <>
      <ul className="divide-y divide-subtle border-y border-subtle">
        {leads.map((lead) => (
          <li key={lead.id} className="py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="rounded border border-strong px-1.5 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
                title={
                  lead.expired
                    ? `Found by the sweep on the open web. Nobody here read it within ${LEAD_EXPIRY_DAYS} days.`
                    : 'Found by the sweep on the open web. Not yet read by anyone here.'
                }
              >
                {lead.expired ? 'Expired lead · never reviewed' : 'Unread lead'}
              </span>
              <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                {whenLabel(lead.at, now)}
                {lead.dated ? '' : ' (found)'}
              </span>
              {lead.bottlenecks[0] && (
                <Link
                  href={bottleneckHref(lead.bottlenecks[0])}
                  className="font-mono text-xs uppercase tracking-caps text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  {lead.bottlenecks[0]}
                </Link>
              )}
            </div>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-primary">
              <a href={lead.url} rel="noreferrer" className="underline-offset-4 hover:underline">
                {lead.title}
              </a>{' '}
              <span className="text-xs text-fg-tertiary">{lead.host} ↗</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
        Pages the sweep found on these chokepoints. Nobody here has read them yet; they are not
        events and not evidence.
      </p>
    </>
  );
}
