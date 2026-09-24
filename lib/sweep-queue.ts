/**
 * Reading what the sweep has found: freshness, the review queue, the leads a
 * desk shows and the per-rail status table. Writing — running a sweep and its
 * settings — lives in `sweep-store.ts`; the split is reads versus runs.
 */
import { database } from './db';
import type { Lead } from './desk';
import { nodes } from './sweep';
import { ON_DEMAND_COOLDOWN_HOURS } from './sweep-store';

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

/** When each of these nodes was last looked at, and how many are being looked at now. */
export async function railFreshness(
  names: readonly string[],
  staleAfterHours = ON_DEMAND_COOLDOWN_HOURS,
): Promise<{ lastSwept: string | null; sweeping: number; stale: number }> {
  const result = await database().query<{
    last: Date | null;
    sweeping: string;
    fresh: string;
  }>(
    `SELECT max(last_swept) AS last,
            count(*) FILTER (WHERE last_status = 'sweeping'
                             AND last_swept > now() - interval '10 minutes') AS sweeping,
            count(*) FILTER (WHERE last_swept > now() - ($2::float8 * interval '1 hour')) AS fresh
       FROM research_sweep_state
      WHERE node = ANY($1::text[])`,
    [names, staleAfterHours],
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
    term: string;
    url: string;
    title: string;
    published: string | null;
    found_at: Date;
    effect_guess: string;
  }>(
    `SELECT id, bottleneck, term, url, title, published, found_at, effect_guess
       FROM research_sweep_candidates
      WHERE bottleneck = ANY($1::text[])
        AND verdict IS DISTINCT FROM 'rejected'
        AND found_at > now() - ($2::float8 * interval '1 day')
      ORDER BY found_at DESC
      LIMIT 200`,
    [names, days],
  );
  return result.rows.map((row) => ({
    id: row.id,
    bottleneck: row.bottleneck,
    term: row.term,
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

export interface NodeStatus {
  name: string;
  lastSwept: string | null;
  status: string | null;
  /** Leads filed for this node in the last 30 days, rejected ones excluded. */
  leads30d: number;
}

/** Per-node sweep state, for the settings page's table. One query each, not one per node. */
export async function nodeStatuses(names: readonly string[]): Promise<NodeStatus[]> {
  const db = database();
  const [state, counts] = await Promise.all([
    db.query<{ node: string; last_swept: Date; last_status: string }>(
      'SELECT node, last_swept, last_status FROM research_sweep_state WHERE node = ANY($1::text[])',
      [names],
    ),
    db.query<{ bottleneck: string; n: string }>(
      `SELECT bottleneck, count(*) AS n FROM research_sweep_candidates
        WHERE bottleneck = ANY($1::text[])
          AND verdict IS DISTINCT FROM 'rejected'
          AND found_at > now() - interval '30 days'
        GROUP BY bottleneck`,
      [names],
    ),
  ]);
  const byNode = new Map(state.rows.map((row) => [row.node, row]));
  const byCount = new Map(counts.rows.map((row) => [row.bottleneck, Number(row.n)]));
  return names.map((name) => {
    const row = byNode.get(name);
    return {
      name,
      lastSwept: row?.last_swept.toISOString() ?? null,
      status: row?.last_status ?? null,
      leads30d: byCount.get(name) ?? 0,
    };
  });
}
