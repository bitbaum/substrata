import { database } from './db';
import type { Lead } from './desk';
import { nodes, sweep } from './sweep';

/**
 * The scheduled sweep, and where its findings go.
 *
 * Deliberately NOT the corpus. The corpus is files in git, accepted by a person
 * in a commit, and that is the site's whole claim — a timer writing into it
 * would publish rows nobody read. Findings land in a queue instead, and the
 * freshness question ("is this site stale?") becomes answerable from run
 * records rather than inferred from the newest event on a page.
 */

/** Small on purpose: the cron wrapper allows 300s, and each node costs several web calls. */
const NODES_PER_RUN = 4;

/**
 * Sweep one node and file what it finds. Shared by the timer and the desk, so
 * the two cannot disagree about what a lead is or where it goes.
 */
async function sweepAndStore(node: {
  name: string;
  term: string;
}): Promise<{ found: number; blind: boolean }> {
  const db = database();
  const candidates = await sweep(node);
  const blind = candidates.some((c) => c.status === 'could_not_look');
  let found = 0;

  for (const candidate of candidates) {
    if (candidate.status !== 'candidate') continue;
    // A URL already seen stays as it was: re-finding a lead is not news, and
    // a re-run must never resurrect something a reviewer has rejected.
    const inserted = await db.query(
      `INSERT INTO research_sweep_candidates
         (id, bottleneck, term, url, title, published, excerpt, effect_guess)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        candidate.id,
        candidate.bottleneck,
        candidate.term,
        candidate.url,
        candidate.title,
        candidate.published,
        candidate.excerpt,
        candidate.effectGuess,
      ],
    );
    found += inserted.rowCount ?? 0;
  }

  await db.query(
    `INSERT INTO research_sweep_state (node, last_swept, last_status)
     VALUES ($1, now(), $2)
     ON CONFLICT (node) DO UPDATE SET last_swept = now(), last_status = $2`,
    [node.name, blind ? 'could_not_look' : 'ok'],
  );
  return { found, blind };
}

export interface SweepOutcome {
  swept: string[];
  found: number;
  couldNotLook: number;
}

/**
 * Sweep the least-recently-looked-at nodes.
 *
 * Rotating by `last_swept` means a bounded run still covers everything over
 * time, and a node that keeps failing does not monopolise the budget.
 */
export async function runScheduledSweep(limit = NODES_PER_RUN): Promise<SweepOutcome> {
  const db = database();
  const all = nodes();

  // Dates, not strings — see freshness() below. The first run survived this
  // typed as `string` only because the state table was empty; the second would
  // have called `.localeCompare` on a Date and taken the timer down for good.
  const seen = await db.query<{ node: string; last_swept: Date }>(
    'SELECT node, last_swept FROM research_sweep_state',
  );
  const lastSwept = new Map(seen.rows.map((row) => [row.node, row.last_swept.toISOString()]));
  const queue = [...all]
    .sort((a, b) => (lastSwept.get(a.name) ?? '').localeCompare(lastSwept.get(b.name) ?? ''))
    .slice(0, limit);

  const run = await db.query<{ id: string }>(
    'INSERT INTO research_sweep_runs DEFAULT VALUES RETURNING id',
  );
  const runId = run.rows[0].id;

  const outcome: SweepOutcome = { swept: [], found: 0, couldNotLook: 0 };

  for (const node of queue) {
    const { found, blind } = await sweepAndStore(node);
    if (blind) outcome.couldNotLook += 1;
    outcome.found += found;
    outcome.swept.push(node.name);
  }

  await db.query(
    `UPDATE research_sweep_runs
        SET finished_at = now(), nodes_swept = $2, candidates_found = $3, could_not_look = $4
      WHERE id = $1`,
    [runId, outcome.swept.length, outcome.found, outcome.couldNotLook],
  );

  return outcome;
}

export interface Freshness {
  lastRunAt: string | null;
  nodesCovered: number;
  nodesTotal: number;
  openCandidates: number;
  /** Nodes the sweep could not look at last time it tried — blindness, not absence. */
  blind: number;
}

/**
 * How fresh the research actually is.
 *
 * "We did not look" and "we looked and found nothing" are different answers,
 * and a site that cannot tell them apart will report a quiet week when its
 * search backend has been down.
 */
export async function freshness(): Promise<Freshness> {
  const db = database();
  const [run, state, open] = await Promise.all([
    // `timestamptz` arrives as a Date, not a string. A query<T> generic is an
    // unchecked assertion rather than validation, so declaring this `string`
    // typechecked, built, and then threw `.slice is not a function` in
    // production — where, unlike any build, a row actually exists.
    db.query<{ finished_at: Date | null }>(
      'SELECT finished_at FROM research_sweep_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1',
    ),
    db.query<{ covered: string; blind: string }>(
      // Only a failed look is blindness. A desk sweep in flight stamps its node
      // 'sweeping' first, and that is a look underway, not a look that failed.
      `SELECT count(*) AS covered,
              count(*) FILTER (WHERE last_status = 'could_not_look') AS blind
         FROM research_sweep_state`,
    ),
    db.query<{ open: string }>(
      'SELECT count(*) AS open FROM research_sweep_candidates WHERE reviewed_at IS NULL',
    ),
  ]);
  return {
    lastRunAt: run.rows[0]?.finished_at?.toISOString() ?? null,
    nodesCovered: Number(state.rows[0]?.covered ?? 0),
    nodesTotal: nodes().length,
    openCandidates: Number(open.rows[0]?.open ?? 0),
    blind: Number(state.rows[0]?.blind ?? 0),
  };
}

export interface QueuedCandidate {
  id: string;
  bottleneck: string;
  term: string;
  url: string;
  title: string;
  published: string | null;
  excerpt: string;
  effectGuess: string;
  foundAt: string;
}

/**
 * The leads a reviewer has not yet decided on.
 *
 * Newest first, because a sweep that has just run is the reason someone opens
 * this page. Reviewed rows stay in the table as the record of a decision —
 * re-finding a URL must never resurrect something already rejected — but they
 * are not work, so they are not listed.
 */
export async function openCandidates(limit = 100): Promise<QueuedCandidate[]> {
  const result = await database().query<{
    id: string;
    bottleneck: string;
    term: string;
    url: string;
    title: string;
    published: string | null;
    excerpt: string;
    effect_guess: string;
    found_at: Date;
  }>(
    `SELECT id, bottleneck, term, url, title, published, excerpt, effect_guess, found_at
       FROM research_sweep_candidates
      WHERE reviewed_at IS NULL
      ORDER BY found_at DESC, bottleneck
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    bottleneck: row.bottleneck,
    term: row.term,
    url: row.url,
    title: row.title,
    published: row.published,
    excerpt: row.excerpt,
    effectGuess: row.effect_guess,
    foundAt: row.found_at.toISOString(),
  }));
}

/**
 * Record a reviewer's decision.
 *
 * Accepting does NOT publish. The corpus is files in git and a row reaches a
 * page only when a person commits it; this marks which leads are worth that
 * work and takes the rest out of the queue for good.
 */
export async function recordVerdict(
  id: string,
  verdict: 'accepted' | 'rejected',
  actorId: string,
): Promise<void> {
  await database().query(
    `UPDATE research_sweep_candidates
        SET reviewed_at = now(), reviewed_by = $3, verdict = $2
      WHERE id = $1 AND reviewed_at IS NULL`,
    [id, verdict, actorId],
  );
}

/**
 * How stale a rail must be before a desk re-sweeps it. Opening the desk sweeps
 * what is older than the first; pressing "Check now" what is older than the
 * second. Either way a node is swept at most that often, however many readers
 * ask, so the cost follows the number of nodes and not the number of visits.
 */
export const ON_DEMAND_COOLDOWN_HOURS = 6;
export const CHECK_NOW_COOLDOWN_HOURS = 1;
/** Nodes one request may sweep. Run side by side, so this bounds the wait too. */
const ON_DEMAND_NODES = 3;

/**
 * Sweep the stalest of these nodes now, for a reader who wants today's news.
 *
 * The claim is one statement: a node is taken only if nobody has swept it
 * within the cooldown, and taking it stamps it. Two tabs, two readers or a
 * reload during a sweep therefore cannot sweep the same node twice, and the
 * cost is bounded by the number of nodes rather than the number of visits.
 */
export async function sweepStaleNow(
  names: readonly string[],
  { cooldownHours = ON_DEMAND_COOLDOWN_HOURS, limit = ON_DEMAND_NODES } = {},
): Promise<SweepOutcome> {
  const wanted = nodes().filter((node) => names.includes(node.name));
  const outcome: SweepOutcome = { swept: [], found: 0, couldNotLook: 0 };
  if (wanted.length === 0) return outcome;

  const claimed = await database().query<{ node: string }>(
    `WITH stale AS (
       SELECT n AS node
         FROM unnest($1::text[]) AS n
         LEFT JOIN research_sweep_state s ON s.node = n
        WHERE s.last_swept IS NULL
           OR s.last_swept < now() - make_interval(hours => $2)
        ORDER BY s.last_swept NULLS FIRST
        LIMIT $3
     )
     INSERT INTO research_sweep_state (node, last_swept, last_status)
     SELECT node, now(), 'sweeping' FROM stale
     ON CONFLICT (node) DO UPDATE SET last_swept = now(), last_status = 'sweeping'
       WHERE research_sweep_state.last_swept < now() - make_interval(hours => $2)
     RETURNING node`,
    [wanted.map((node) => node.name), cooldownHours, limit],
  );
  const taken = new Set(claimed.rows.map((row) => row.node));

  const chosen = wanted.filter((node) => taken.has(node.name));
  const results = await Promise.allSettled(chosen.map((node) => sweepAndStore(node)));
  results.forEach((result, i) => {
    const name = chosen[i].name;
    if (result.status === 'fulfilled') {
      outcome.swept.push(name);
      outcome.found += result.value.found;
      if (result.value.blind) outcome.couldNotLook += 1;
    } else {
      outcome.couldNotLook += 1;
    }
  });
  return outcome;
}

/** When each of these nodes was last looked at, and how many are being looked at now. */
export async function railFreshness(
  names: readonly string[],
): Promise<{ lastSwept: string | null; sweeping: number; stale: number }> {
  const result = await database().query<{
    last: Date | null;
    sweeping: string;
    fresh: string;
  }>(
    `SELECT max(last_swept) AS last,
            count(*) FILTER (WHERE last_status = 'sweeping'
                             AND last_swept > now() - interval '10 minutes') AS sweeping,
            count(*) FILTER (WHERE last_swept > now() - make_interval(hours => $2)) AS fresh
       FROM research_sweep_state
      WHERE node = ANY($1::text[])`,
    [names, ON_DEMAND_COOLDOWN_HOURS],
  );
  const row = result.rows[0];
  return {
    lastSwept: row?.last?.toISOString() ?? null,
    sweeping: Number(row?.sweeping ?? 0),
    stale: names.length - Number(row?.fresh ?? 0),
  };
}

/**
 * Recent leads on these bottlenecks, for the desk.
 *
 * Unreviewed and accepted leads both; a rejected one is gone for good. Read
 * newest first and bounded, because the desk shows a feed, not the queue.
 */
export async function leadsFor(names: readonly string[], days = 45): Promise<Lead[]> {
  const result = await database().query<{
    id: string;
    bottleneck: string;
    url: string;
    title: string;
    published: string | null;
    found_at: Date;
    effect_guess: string;
  }>(
    `SELECT id, bottleneck, url, title, published, found_at, effect_guess
       FROM research_sweep_candidates
      WHERE bottleneck = ANY($1::text[])
        AND verdict IS DISTINCT FROM 'rejected'
        AND found_at > now() - make_interval(days => $2)
      ORDER BY found_at DESC
      LIMIT 200`,
    [names, days],
  );
  return result.rows.map((row) => ({
    id: row.id,
    bottleneck: row.bottleneck,
    url: row.url,
    title: row.title,
    published: row.published,
    foundAt: row.found_at.toISOString(),
    effectGuess:
      row.effect_guess === 'tightens' || row.effect_guess === 'loosens'
        ? row.effect_guess
        : 'neutral',
  }));
}

/** A sweep lead as the assistant sees it: unread, with the passage that matched. */
export interface LeadHit {
  bottleneck: string;
  url: string;
  title: string;
  published: string | null;
  excerpt: string;
  effectGuess: string;
  foundAt: string;
  /** `null` while nobody has read it; `accepted` means worth writing up, not published. */
  verdict: string | null;
}

/**
 * Leads for the assistant's `recent_leads` tool.
 *
 * Optional bottleneck scope and an optional word filter over title and
 * excerpt. Rejected leads are gone for good, as on the desk. Bounded hard,
 * because every row returned is prompt the free tier pays for.
 */
export async function searchLeads({
  bottlenecks,
  query,
  days = 45,
  limit = 8,
}: {
  bottlenecks?: readonly string[];
  query?: string;
  days?: number;
  limit?: number;
}): Promise<LeadHit[]> {
  const words = (query ?? '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]{3,}/gu)
    ?.slice(0, 6)
    .map((w) => `%${w}%`);
  const result = await database().query<{
    bottleneck: string;
    url: string;
    title: string;
    published: string | null;
    excerpt: string;
    effect_guess: string;
    found_at: Date;
    verdict: string | null;
  }>(
    `SELECT bottleneck, url, title, published, excerpt, effect_guess, found_at, verdict
       FROM research_sweep_candidates
      WHERE verdict IS DISTINCT FROM 'rejected'
        AND found_at > now() - make_interval(days => $1)
        AND ($2::text[] IS NULL OR bottleneck = ANY($2::text[]))
        AND ($3::text[] IS NULL OR lower(title || ' ' || excerpt) LIKE ANY($3::text[]))
      ORDER BY found_at DESC
      LIMIT $4`,
    [
      Math.min(Math.max(days, 1), 365),
      bottlenecks && bottlenecks.length ? [...bottlenecks] : null,
      words && words.length ? words : null,
      Math.min(Math.max(limit, 1), 20),
    ],
  );
  return result.rows.map((row) => ({
    bottleneck: row.bottleneck,
    url: row.url,
    title: row.title,
    published: row.published,
    excerpt: row.excerpt,
    effectGuess: row.effect_guess,
    foundAt: row.found_at.toISOString(),
    verdict: row.verdict,
  }));
}
