/**
 * Row counts for a company's boxes. Customers and suppliers have no counter:
 * they are relation boxes and count only what the relation store reports.
 */
import { FACILITIES } from '@/config/substrata-facilities';
import { ownershipOf } from '@/config/substrata-ownership';
import { RESOURCE_TO_BOTTLENECKS } from '@/config/substrata-resources';
import { listingFor } from '@/lib/listings';
import { participantBySlug, type MarketParticipant } from '@/lib/participants';
import { restrictionsFor } from '@/lib/resources/restrictions';
import { euRegimesFor, ofacProgramsFor } from '@/lib/resources/sanctions';
import { OWNERS_CONTROL_SHARE, OWNERS_LISTED_HOLDERS } from '../boxes/company';
import type { RowCounts } from '../definitions';
import type { Subject } from '../subjects';
import { NOTHING, USGS_ROWS, gradeOf, plus, tally } from './shared';

const LOWER_ROWS = USGS_ROWS.map((r) => ({ ...r, lower: r.companies.toLowerCase() }));

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Names a USGS row may print for the company: its name and aliases, four letters or more. */
function namesOf(p: MarketParticipant): string[] {
  const aka = (p as { aliases?: string[] }).aliases ?? [];
  return [...new Set([p.name, ...aka])].filter((n) => n.length >= 4).map((n) => n.toLowerCase());
}

function makes(p: MarketParticipant): RowCounts {
  return tally(
    p.produces,
    (r) => (r.verification === 'sourced' ? 'stated' : 'lead'),
    `${p.produces.filter((r) => r.verification === 'sourced').length} of ${p.produces.length} producer rows sourced`,
    { expected: p.produces.length },
  );
}

function locations(p: MarketParticipant): RowCounts {
  const names = namesOf(p);
  const curated = FACILITIES.filter(
    (f) => f.operator !== null && names.includes(f.operator.toLowerCase()),
  );
  const patterns = names.map((n) => new RegExp(`(^|[^a-z])${escape(n)}([^a-z]|$)`));
  const usgs = LOWER_ROWS.filter((r) => patterns.some((re) => re.test(r.lower)));
  return plus(
    tally(curated, gradeOf, `${curated.length} named facilities`),
    tally(usgs, () => 'stated', `${usgs.length} USGS Minerals Yearbook rows naming it`),
  );
}

function owners(p: MarketParticipant): RowCounts {
  const own = ownershipOf(p.slug);
  if (!own) return { ...NOTHING, basis: 'no ownership record' };
  const stated = own.holders.filter((h) => gradeOf(h) === 'stated');
  const share = stated.reduce((n, h) => n + (h.share ?? 0), 0);
  const control =
    share >= OWNERS_CONTROL_SHARE ||
    (own.status === 'listed' && stated.length >= OWNERS_LISTED_HOLDERS);
  return tally(
    own.holders,
    gradeOf,
    `${own.holders.length} holders on record, stated stakes summing to ${Math.round(share * 10) / 10}%`,
    { core: control ? 1 : 0 },
  );
}

function filings(p: MarketParticipant): RowCounts {
  const listing = listingFor(p.slug);
  if (!listing || listing.status === 'none-found') {
    return { ...NOTHING, core: 0, basis: 'no listing found on SEC or OpenFIGI' };
  }
  if (listing.status === 'private') {
    return { ...NOTHING, stated: 1, core: 1, basis: `stated private: ${listing.note}` };
  }
  const refs = [listing.primary, listing.us].filter((r) => r !== null);
  return tally(
    refs,
    () => 'stated',
    `${refs.length} listing references${listing.status === 'parent' ? ' (the parent’s)' : ''}`,
    {
      core: listing.us?.cik ? 1 : 0,
    },
  );
}

/** Resources whose mapped bottlenecks this company makes. */
function resourcesMade(p: MarketParticipant): string[] {
  const made = new Set(p.produces.map((r) => r.bottleneck));
  return Object.entries(RESOURCE_TO_BOTTLENECKS)
    .filter(([, names]) => (names ?? []).some((n) => made.has(n)))
    .map(([id]) => id);
}

/**
 * Stated risk events (outages and policy actions that tighten), plus exposures
 * worked out from its jurisdictions — export measures on what it makes,
 * sanctions regimes naming its countries. Those are `derived`: shown, never counted.
 */
function risks(p: MarketParticipant): RowCounts {
  const events = p.events.filter(
    (e) => e.effect === 'tightens' && (e.kind === 'outage' || e.kind === 'policy'),
  );
  const resources = resourcesMade(p);
  const derived = p.jurisdictions.reduce((n, j) => {
    const iso2 = j.toLowerCase();
    const measures = resources.reduce((m, r) => m + restrictionsFor(iso2, r).length, 0);
    return n + measures + euRegimesFor(iso2).length + ofacProgramsFor(iso2).length;
  }, 0);
  const c = tally(
    events,
    gradeOf,
    `${events.length} stated risk events; ${derived} exposures worked out from its jurisdictions`,
  );
  return { ...c, derived };
}

function events(p: MarketParticipant): RowCounts {
  return tally(p.events, gradeOf, `${p.events.length} accepted events naming it`);
}

const on = (f: (p: MarketParticipant) => RowCounts) => (s: Subject) => {
  const p = participantBySlug(s.key);
  return p ? f(p) : { ...NOTHING, basis: 'not in the directory' };
};

export const COMPANY_COUNTERS: Record<string, (s: Subject) => RowCounts> = {
  makes: on(makes),
  locations: on(locations),
  owners: on(owners),
  filings: on(filings),
  risks: on(risks),
  events: on(events),
};
