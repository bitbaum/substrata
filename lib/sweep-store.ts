import { database } from './db';
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
    const candidates = await sweep(node);
    const blind = candidates.some((c) => c.status === 'could_not_look');
    if (blind) outcome.couldNotLook += 1;

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
      outcome.found += inserted.rowCount ?? 0;
    }

    await db.query(
      `INSERT INTO research_sweep_state (node, last_swept, last_status)
       VALUES ($1, now(), $2)
       ON CONFLICT (node) DO UPDATE SET last_swept = now(), last_status = $2`,
      [node.name, blind ? 'could_not_look' : 'ok'],
    );
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
      `SELECT count(*) AS covered,
              count(*) FILTER (WHERE last_status <> 'ok') AS blind
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
