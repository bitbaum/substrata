/**
 * Where each directory company publishes its open roles, as verified on the
 * company's own careers page (research/job-boards.json).
 *
 * A board is only fetched when it is on an applicant-tracking system with a
 * documented public job-board API that its robots.txt allows (Greenhouse,
 * Lever, Ashby). Every other company — Workday, SuccessFactors, an in-house
 * site, SmartRecruiters (whose API host disallows crawlers) — is linked to its
 * official careers page instead, and the page says so.
 */
import data from '@/research/job-boards.json';
import type { Ats } from '@/lib/careers';
import { MARKET_PARTICIPANTS } from '@/lib/participants';

export interface BoardRecord {
  /** The company's official careers page, as opened when the record was checked. */
  careersUrl: string | null;
  /** The ATS serving it, or "in-house" / "unknown". */
  ats: string;
  /** The board token on a fetchable ATS; null otherwise. */
  board: string | null;
  /** What tied the board to the company. */
  evidence: string;
  checkedOn: string;
  /** Set when the company recruits through a parent's careers site. */
  parent?: string;
}

export const FETCHABLE: readonly Ats[] = ['greenhouse', 'lever', 'ashby'];

const RECORDS = (data as { companies: Record<string, BoardRecord> }).companies;
export const BOARDS_CHECKED_ON = (data as { checkedOn: string }).checkedOn;

export function boardFor(slug: string): BoardRecord | undefined {
  return RECORDS[slug];
}

export interface LiveBoard {
  slug: string;
  company: string;
  ats: Ats;
  board: string;
}

/**
 * Boards the daily fetch reads. Two companies can share one board (a unit
 * recruiting through its parent); the board is read once, under the first.
 */
export function liveBoards(): LiveBoard[] {
  const seen = new Set<string>();
  const out: LiveBoard[] = [];
  for (const p of MARKET_PARTICIPANTS) {
    const r = RECORDS[p.slug];
    if (!r?.board || !FETCHABLE.includes(r.ats as Ats)) continue;
    const key = `${r.ats}:${r.board}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ slug: p.slug, company: p.name, ats: r.ats as Ats, board: r.board });
  }
  return out;
}

export interface CompanyHiring {
  slug: string;
  name: string;
  record: BoardRecord | undefined;
  live: boolean;
}

/** Every directory company with how its roles can be reached, live boards first. */
export function hiringDirectory(): CompanyHiring[] {
  const live = new Set(liveBoards().map((b) => b.slug));
  return MARKET_PARTICIPANTS.map((p) => ({
    slug: p.slug,
    name: p.name,
    record: RECORDS[p.slug],
    live: live.has(p.slug),
  })).sort((a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name));
}
