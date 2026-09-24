/**
 * What a reader follows, and how their desk behaves. Stored in
 * research_preferences.topics as JSON.
 *
 * Old rows were a string[] of technology ids; those still parse. Every field
 * is parsed defensively and clamped, because this is a document the reader
 * writes and the desk reads on every visit — an out-of-range number must land
 * on a sane default, never on a query.
 */
import { TECHNOLOGIES, type TechnologyId } from '@/config/substrata-taxonomy';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';

export type FollowKind = 'individual' | 'organization';

export const WINDOWS = ['1', '7', '30', 'all'] as const;
export type Window = (typeof WINDOWS)[number];
export const WINDOW_LABEL: Record<Window, string> = {
  '1': '24 hours',
  '7': '7 days',
  '30': '30 days',
  all: 'All time',
};

export const GROUPINGS = ['day', 'bottleneck'] as const;
export type Grouping = (typeof GROUPINGS)[number];

export interface DeskSettings {
  /** Show analyst-verified events. */
  showVerified: boolean;
  /** Show leads the sweep found on the open web and nobody has read yet. */
  showLeads: boolean;
  /** The time window the feed opens on. */
  window: Window;
  grouping: Grouping;
  /** Drop a lead whose headline names none of its rail's words. */
  strictLeads: boolean;
  /** Leads older than this many days are dropped, whenever they were found. */
  leadMaxAgeDays: number;
  /** Hosts whose pages never reach the desk ("example.com"). */
  mutedHosts: string[];
  /** Words or phrases that hide a row whose headline contains them. */
  mutedWords: string[];
  /** Sweep stale rails in the background when the desk opens. */
  sweepOnOpen: boolean;
  /** A rail counts as stale after this many hours. */
  staleAfterHours: number;
  /** Rows at or before this instant count as read. Set by "Mark all read". */
  readUntil: string | null;
  pageSize: number;
}

export type Follows = {
  technologies: TechnologyId[];
  companies: string[];
  /** Bottleneck slugs followed directly, on top of what technologies reach. */
  bottlenecks: string[];
  /** Bottleneck slugs never shown, whatever else reaches them. */
  muted: string[];
  kind: FollowKind;
  desk: DeskSettings;
};

export const DEFAULT_DESK: DeskSettings = {
  showVerified: true,
  showLeads: true,
  window: '30',
  grouping: 'day',
  strictLeads: true,
  leadMaxAgeDays: 45,
  mutedHosts: [],
  mutedWords: [],
  sweepOnOpen: true,
  staleAfterHours: 6,
  readUntil: null,
  pageSize: 30,
};

const TECH = new Set(TECHNOLOGIES.map((t) => t.id));
const COMPANY = new Set(MARKET_PARTICIPANTS.map((p) => p.slug));
const BOTTLENECK = new Set(BOTTLENECKS.map((b) => b.slug));

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function strings(value: unknown, keep: (s: string) => boolean, limit = 200): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && keep(v)))].slice(
    0,
    limit,
  );
}

/** "https://www.Example.com/path" → "example.com"; anything unparseable is dropped. */
export function normaliseHost(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  try {
    const host = new URL(text.includes('://') ? text : `https://${text}`).hostname;
    const bare = host.replace(/^www\./, '');
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(bare) ? bare : null;
  } catch {
    return null;
  }
}

export function parseDesk(raw: unknown): DeskSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bool = (key: keyof DeskSettings) =>
    typeof o[key] === 'boolean' ? (o[key] as boolean) : (DEFAULT_DESK[key] as boolean);
  const readUntil =
    typeof o.readUntil === 'string' && Number.isFinite(Date.parse(o.readUntil))
      ? new Date(o.readUntil).toISOString()
      : null;
  return {
    showVerified: bool('showVerified'),
    showLeads: bool('showLeads'),
    window: WINDOWS.includes(o.window as Window) ? (o.window as Window) : DEFAULT_DESK.window,
    grouping: GROUPINGS.includes(o.grouping as Grouping)
      ? (o.grouping as Grouping)
      : DEFAULT_DESK.grouping,
    leadMaxAgeDays: clampInt(o.leadMaxAgeDays, 1, 365, DEFAULT_DESK.leadMaxAgeDays),
    mutedHosts: strings(o.mutedHosts, (s) => normaliseHost(s) === s),
    mutedWords: strings(o.mutedWords, (s) => s.trim().length >= 2 && s.length <= 80).map((s) =>
      s.trim(),
    ),
    sweepOnOpen: bool('sweepOnOpen'),
    strictLeads: bool('strictLeads'),
    staleAfterHours: clampInt(o.staleAfterHours, 1, 72, DEFAULT_DESK.staleAfterHours),
    readUntil,
    pageSize: clampInt(o.pageSize, 10, 100, DEFAULT_DESK.pageSize),
  };
}

export function parseFollows(raw: unknown): Follows {
  if (Array.isArray(raw)) {
    return {
      ...emptyFollows(),
      technologies: strings(raw, (id) => TECH.has(id as TechnologyId)) as TechnologyId[],
    };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const muted = strings(o.muted, (s) => BOTTLENECK.has(s));
    return {
      technologies: strings(o.technologies, (id) => TECH.has(id as TechnologyId)) as TechnologyId[],
      companies: strings(o.companies, (id) => COMPANY.has(id)),
      // Following and muting the same row is a contradiction; muting wins,
      // because it is the more deliberate of the two.
      bottlenecks: strings(o.bottlenecks, (s) => BOTTLENECK.has(s) && !muted.includes(s)),
      muted,
      kind: o.kind === 'organization' ? 'organization' : 'individual',
      desk: parseDesk(o.desk),
    };
  }
  return emptyFollows();
}

export function emptyFollows(): Follows {
  return {
    technologies: [],
    companies: [],
    bottlenecks: [],
    muted: [],
    kind: 'individual',
    desk: { ...DEFAULT_DESK },
  };
}

/**
 * The bottlenecks a reader's desk covers: whatever their technologies and
 * companies reach, plus rows followed directly, minus rows muted. Following
 * nothing is not an empty desk — it is the whole map, until they narrow it.
 */
export function railsOf(follows: Follows): Bottleneck[] {
  const companies = MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug));
  const nothing = follows.technologies.length + companies.length + follows.bottlenecks.length === 0;
  return BOTTLENECKS.filter((b) => {
    if (follows.muted.includes(b.slug)) return false;
    if (nothing) return true;
    return (
      follows.bottlenecks.includes(b.slug) ||
      b.technologies.some((t) => follows.technologies.includes(t)) ||
      companies.some((p) => b.producers.some((row) => row.name === p.name))
    );
  });
}

/**
 * The bottlenecks a reader's follows reach — their rails.
 *
 * Following nothing yet is not an empty desk: it is the whole map, until they
 * narrow it. The same rule the desk applies (app/account keeps its own copy
 * for now; it should import this one), so Ask and the desk agree about what a
 * reader's rails are.
 */
export function railsOf(follows: Follows): Bottleneck[] {
  const companies = MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug));
  if (follows.technologies.length === 0 && companies.length === 0) return [...BOTTLENECKS];
  return BOTTLENECKS.filter(
    (b) =>
      b.technologies.some((t) => follows.technologies.includes(t)) ||
      companies.some((p) => b.producers.some((row) => row.name === p.name)),
  );
}
