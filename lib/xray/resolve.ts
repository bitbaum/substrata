/**
 * Which directory companies a pasted security is.
 *
 * Read only from research/listings.json: the primary line (Bloomberg
 * composite from OpenFIGI, or a US venue from the SEC file) and the US line.
 * A parent listing resolves to every subsidiary the directory records under
 * it — "005930 KS" is Samsung Foundry AND Samsung Memory, "TSM US" is TSMC
 * AND TSMC Advanced Packaging — because that is what a holder of the parent
 * owns a slice of.
 *
 * A bare ticker that means different securities on different exchanges is
 * not guessed: it comes back ambiguous with the candidates, and the reader
 * adds the exchange.
 */
import { LISTINGS, type Listing, type SecurityRef } from '@/lib/listings';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { slugify } from '@/lib/links';
import type { ParsedHolding } from './parse';

export interface Security {
  /** "8035 JP", as a terminal writes it. */
  label: string;
  name: string;
  source: string;
  /** Set when the line is a parent's (Hitachi for Hitachi Energy). */
  parent: string | null;
}

export type Resolution =
  | { status: 'resolved'; security: Security; slugs: string[] }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'private'; slug: string; note: string }
  | { status: 'unknown'; note: string };

/** The composite a SEC-sourced line trades under: its exchange is a US venue. */
function compositeOf(ref: SecurityRef): string {
  return ref.figi ? ref.exchange : 'US';
}

interface Line {
  key: string;
  security: Security;
  slugs: Set<string>;
}

function buildIndex() {
  const byKey = new Map<string, Line>();
  const put = (ref: SecurityRef, slug: string, listing: Extract<Listing, { primary: unknown }>) => {
    const key = `${ref.ticker.toUpperCase()} ${compositeOf(ref)}`;
    const line = byKey.get(key) ?? {
      key,
      security: {
        label: key,
        name: ref.name,
        source: ref.source,
        parent: listing.status === 'parent' ? (listing.parent ?? null) : null,
      },
      slugs: new Set<string>(),
    };
    line.slugs.add(slug);
    byKey.set(key, line);
  };
  for (const [slug, listing] of Object.entries(LISTINGS.listings)) {
    if (listing.status !== 'listed' && listing.status !== 'parent') continue;
    if (listing.primary) put(listing.primary, slug, listing);
    if (listing.us) put(listing.us, slug, listing);
  }
  const byTicker = new Map<string, Line[]>();
  for (const line of byKey.values()) {
    const ticker = line.key.split(' ')[0];
    byTicker.set(ticker, [...(byTicker.get(ticker) ?? []), line]);
  }
  return { byKey, byTicker };
}

let index: ReturnType<typeof buildIndex> | null = null;
function lines() {
  index ??= buildIndex();
  return index;
}

const BY_SLUG = new Map(MARKET_PARTICIPANTS.map((p) => [p.slug, p]));

function resolved(line: Line): Resolution {
  return { status: 'resolved', security: line.security, slugs: [...line.slugs].sort() };
}

/** A name typed instead of a ticker: "Carl Zeiss SMT", "Trumpf". */
export function resolveName(text: string): Resolution | null {
  const slug = slugify(text);
  const company = BY_SLUG.get(slug);
  if (!company) return null;
  const listing = LISTINGS.listings[slug];
  if (listing?.status === 'private') return { status: 'private', slug, note: listing.note };
  if (listing?.status === 'listed' || listing?.status === 'parent') {
    const ref = listing.primary ?? listing.us;
    const line = ref ? lines().byKey.get(`${ref.ticker.toUpperCase()} ${compositeOf(ref)}`) : null;
    if (line) return resolved(line);
  }
  return {
    status: 'unknown',
    note: `${company.name} is in the directory, but no listing was found for it.`,
  };
}

export function resolveHolding(h: Pick<ParsedHolding, 'ticker' | 'exchange'>): Resolution {
  const ticker = h.ticker.toUpperCase();
  const { byKey, byTicker } = lines();
  if (h.exchange) {
    const line = byKey.get(`${ticker} ${h.exchange}`);
    if (line) return resolved(line);
    return {
      status: 'unknown',
      note: `No company in the directory lists ${ticker} ${h.exchange} in research/listings.json.`,
    };
  }
  const found = byTicker.get(ticker) ?? [];
  const distinct = new Map<string, Line>();
  // The primary and US lines of one company are one holding, not two candidates.
  for (const line of found) distinct.set([...line.slugs].sort().join('|'), line);
  if (distinct.size === 1) {
    const [only] = distinct.values();
    const us = found.find((l) => l.key.endsWith(' US'));
    return resolved(us ?? only);
  }
  if (distinct.size > 1) return { status: 'ambiguous', candidates: found.map((l) => l.key) };
  return (
    resolveName(h.ticker) ?? {
      status: 'unknown',
      note: `${ticker} is not a listing of any company in the directory.`,
    }
  );
}
