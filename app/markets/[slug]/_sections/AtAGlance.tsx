import { StatTiles, type StatTile } from '@bitbaum/chartkit/react';
import { SCARCITY_LABEL, type MarketParticipant } from '@/lib/participants';
import { marketsBy } from '@/lib/links';
import type { CompanyProfile } from '@/lib/company-profile';
import { companyExposure } from '@/lib/company-exposure';
import { listingFor, terminalTicker } from '@/lib/listings';
import { ownershipView } from '@/lib/ownership';
import { eventSummary } from '@/lib/profile/modules/company-happened';

/**
 * At a glance: five equal tiles under a company's name, the same five on
 * every company — exposure (what it rests on, holds, constrains), hardest binding, directory grade,
 * listing, events — drawn by @bitbaum/chartkit's StatTiles. Each links to
 * the section or page that holds the rows it counts and their provenance
 * (the Figure popovers live there), so a figure here is never the end of
 * the road.
 */
export function AtAGlance({ p, profile }: { p: MarketParticipant; profile: CompanyProfile }) {
  const listing = listingFor(p.slug);
  const owner = ownershipView(p.slug);
  const events = eventSummary(profile);
  const line =
    listing && (listing.status === 'listed' || listing.status === 'parent') && listing.primary
      ? terminalTicker(listing.primary)
      : listing?.status === 'listed' && listing.us
        ? terminalTicker(listing.us)
        : null;

  /** One line under the ticker: the exchange, and the US line when there is a second. */
  function listingNote(): string {
    if (owner.status === 'subsidiary' && owner.parent) return `via ${owner.parent}`;
    if (owner.status === 'private') return 'no listed shares';
    if (!listing || listing.status === 'none-found') return 'no listing found';
    if (listing.status !== 'listed') return 'listed';
    const home = listing.primary ? exchangeName(listing.primary.exchange) : '';
    const second =
      listing.us && listing.primary && listing.us.ticker !== listing.primary.ticker
        ? terminalTicker(listing.us)
        : listing.us && !listing.primary
          ? exchangeName(listing.us.exchange)
          : '';
    return [home, second].filter(Boolean).join(' · ') || 'listed';
  }

  const x = companyExposure({ slug: p.slug, name: p.name });
  const rows = [
    ...x.constrainedBy.map((d) => ({ ...d.chokepoint, how: 'rests on it' })),
    ...x.holds.map((h) => ({ ...h.chokepoint, how: 'holds it' })),
  ].sort((a, b) => b.binding - a.binding);
  const hardest = rows[0];
  const recorded = x.counts.exposedTo + x.counts.holds + x.counts.constrainsOrganisations > 0;

  const tiles: StatTile[] = [
    {
      label: 'Exposed to',
      value: recorded ? `${x.counts.exposedTo} of ${x.counts.tracked}` : 'Not recorded',
      note: recorded
        ? [
            x.counts.holds > 0 ? `holds ${x.counts.holds}` : '',
            x.counts.constrainsOrganisations > 0
              ? `a constraint on ${x.counts.constrainsOrganisations} ${x.counts.constrainsOrganisations === 1 ? 'organisation' : 'organisations'}`
              : 'who waits on it is not recorded',
          ]
            .filter(Boolean)
            .join(' · ')
        : 'a gap in the sources read, not none',
      href: '#constrained-by',
    },
    {
      label: 'Hardest binding',
      value: hardest ? `${hardest.binding} of 12` : '—',
      note: hardest ? `${hardest.name} · ${hardest.how}` : 'no exposure recorded yet',
      href: hardest ? '#constrained-by' : '#constrains',
    },
    {
      label: 'Directory grade',
      value: p.scarcity ? SCARCITY_LABEL[p.scarcity] : 'Not graded',
      note: p.scarcity ? 'a judgement, not a sourced fact' : 'listed from a maker row only',
      href: p.scarcity ? marketsBy('grade', p.scarcity) : '/markets',
    },
    {
      label: 'Listing',
      value: line ?? owner.statusLabel,
      note: listingNote(),
      href: '#ownership',
    },
    {
      label: 'Events',
      value: events.count,
      note: events.newest
        ? `newest ${events.newest.date}${profile.relatedEvents.length > 0 ? ` · ${profile.relatedEvents.length} on what it holds` : ''}`
        : 'none recorded yet',
      href: events.count > 0 || profile.relatedEvents.length > 0 ? '#events' : '/events',
    },
  ];
  return (
    <div className="company-glance mt-6">
      <StatTiles tiles={tiles} caption="At a glance" />
    </div>
  );
}

const EXCHANGE: Record<string, string> = {
  US: 'US',
  NA: 'Euronext Amsterdam',
  FP: 'Euronext Paris',
  BB: 'Euronext Brussels',
  GR: 'Xetra',
  GY: 'Xetra',
  LN: 'London',
  SW: 'SIX Swiss',
  IM: 'Milan',
  JP: 'Tokyo',
  KS: 'Korea',
  TT: 'Taiwan',
  HK: 'Hong Kong',
  CH: 'Shanghai/Shenzhen',
  AU: 'ASX',
  CN: 'Toronto',
  IN: 'India',
  SS: 'Stockholm',
  NO: 'Oslo',
  FH: 'Helsinki',
  DC: 'Copenhagen',
  Nasdaq: 'Nasdaq',
  NYSE: 'NYSE',
};

function exchangeName(code: string): string {
  return EXCHANGE[code] ?? code;
}
