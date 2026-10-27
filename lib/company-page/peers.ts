/**
 * Peers: companies at the same step of the chain (a profiled company's layer)
 * or, for a company identified by theme, the listed companies sharing its
 * first theme. Only peers whose listing can be read are kept, the seed's
 * hand-checked listings first. Pure apart from the committed config it reads.
 */
import { participantBySlug, MARKET_PARTICIPANTS } from '@/lib/participants';
import { themeById } from '@/config/universe-themes';
import { universeEntries, universeEntry } from '@/lib/universe/store';
import { bySlug, tickerLabel, type MarketCompany } from '@/lib/market-data/identity';
import { marketCompanyFor } from '@/lib/market-data/company';
import { money } from '@/lib/market-data/present';
import { downsample, inRange, windowReturn } from '@/lib/market-data/prices/compute';
import type { PricePoint } from '@/lib/market-data/prices/series';

export const PEERS_SHOWN = 6;

export interface PeerSet {
  /** In words, what makes them peers. */
  basis: string;
  peers: { slug: string; name: string; company: MarketCompany }[];
}

export function peerSet(slug: string): PeerSet {
  const p = participantBySlug(slug);
  const own = marketCompanyFor(slug);
  const sameLine = (c: MarketCompany) =>
    own && c.ticker.symbol === own.ticker.symbol && c.ticker.exchange === own.ticker.exchange;
  if (p) {
    const peers = MARKET_PARTICIPANTS.filter((x) => x.layer === p.layer && x.slug !== slug)
      .map((x) => ({ slug: x.slug, name: x.name, company: marketCompanyFor(x.slug) }))
      .filter((x): x is PeerSet['peers'][number] => x.company !== null && !sameLine(x.company))
      .filter(
        (x, i, all) =>
          all.findIndex((y) => tickerLabel(y.company.ticker) === tickerLabel(x.company.ticker)) ===
          i,
      )
      .sort(
        (a, b) => Number(!bySlug(a.slug)) - Number(!bySlug(b.slug)) || a.name.localeCompare(b.name),
      )
      .slice(0, PEERS_SHOWN);
    return { basis: `Listed companies the directory places at the same step of the chain`, peers };
  }
  const entry = universeEntry(slug);
  const theme = entry?.themes[0];
  if (!entry?.admitted || !theme)
    return { basis: 'No chain step or theme to compare by', peers: [] };
  const peers = universeEntries()
    .filter((e) => e.admitted && e.slug !== slug && e.themes.includes(theme))
    .map((e) => ({ slug: e.slug, name: e.name, company: marketCompanyFor(e.slug) }))
    .filter((x): x is PeerSet['peers'][number] => x.company !== null && !sameLine(x.company))
    .sort(
      (a, b) =>
        Number(!bySlug(a.slug) && !bySlug(a.company.slug)) -
          Number(!bySlug(b.slug) && !bySlug(b.company.slug)) ||
        Number(!a.company.cik) - Number(!b.company.cik) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, PEERS_SHOWN);
  return {
    basis: `Listed companies in the same theme, ${themeById(theme)?.label ?? theme}`,
    peers,
  };
}

export interface PeerRow {
  slug: string;
  name: string;
  ticker: string;
  close: string;
  closeDate: string;
  oneYear: string;
  direction: 'up' | 'down' | 'flat' | null;
  spark: { x: string; y: number }[];
}

/** One peer's row from its closes; `reason` when there are none. */
export function peerRow(
  peer: PeerSet['peers'][number],
  points: readonly PricePoint[] | null,
  currency: string,
  reason = 'no closes',
): PeerRow {
  const base = { slug: peer.slug, name: peer.name, ticker: tickerLabel(peer.company.ticker) };
  const last = points?.at(-1);
  if (!points || !last)
    return {
      ...base,
      close: 'Not available',
      closeDate: reason,
      oneYear: '—',
      direction: null,
      spark: [],
    };
  const r = windowReturn(points, '1Y');
  return {
    ...base,
    close: money(last.close, currency),
    closeDate: last.date,
    oneYear: r.change === null ? 'Not computed' : r.display,
    direction: r.change === null ? null : r.change > 0 ? 'up' : r.change < 0 ? 'down' : 'flat',
    spark: downsample(inRange(points, '1Y'), 60).map((p) => ({ x: p.date, y: p.close })),
  };
}
