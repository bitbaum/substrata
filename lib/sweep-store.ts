import { database } from './db';
import {
  DEFAULT_SWEEP_SETTINGS,
  nodes,
  parseSweepSettings,
  sweep,
  type SweepSettings,
} from './sweep';

/**
 * The scheduled sweep, and where its findings go.
 *
 * Deliberately NOT the corpus. The corpus is files in git, accepted by a person
 * in a commit, and that is the site's whole claim — a timer writing into it
 * would publish rows nobody read. Findings land in a queue instead, and the
 * freshness question ("is this site stale?") becomes answerable from run
 * records rather than inferred from the newest event on a page.
 */

/**
 * Sweep one node and file what it finds. Shared by the timer and the desk, so
 * the two cannot disagree about what a lead is or where it goes.
 */
async function sweepAndStore(
  node: { name: string; term: string },
  settings: SweepSettings,
): Promise<{ found: number; blind: boolean }> {
  const db = database();
  const candidates = await sweep(node, settings);
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
export async function runScheduledSweep(): Promise<SweepOutcome & { skipped?: string }> {
  const db = database();
  const all = nodes();
  const settings = await sweepSettings();

  // The timer fires every hour; the cadence is a setting, so the decision to
  // run lives here, where an operator can change it without touching the box.
  const last = await db.query<{ finished_at: Date }>(
    'SELECT finished_at FROM research_sweep_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1',
  );
  const lastAt = last.rows[0]?.finished_at?.getTime();
  // Five minutes of slack so a 6-hour cadence on an hourly timer does not
  // slip to 7 hours because the previous run finished a minute late.
  if (lastAt && Date.now() - lastAt < settings.everyHours * 3_600_000 - 5 * 60_000) {
    return { swept: [], found: 0, couldNotLook: 0, skipped: 'not due' };
  }
  const limit = settings.nodesPerRun;

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
    const { found, blind } = await sweepAndStore(node, settings);
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
           OR s.last_swept < now() - ($2::float8 * interval '1 hour')
        ORDER BY s.last_swept NULLS FIRST
        LIMIT $3
     )
     INSERT INTO research_sweep_state (node, last_swept, last_status)
     SELECT node, now(), 'sweeping' FROM stale
     ON CONFLICT (node) DO UPDATE SET last_swept = now(), last_status = 'sweeping'
       WHERE research_sweep_state.last_swept < now() - ($2::float8 * interval '1 hour')
     RETURNING node`,
    [wanted.map((node) => node.name), cooldownHours, limit],
  );
  const taken = new Set(claimed.rows.map((row) => row.node));

  const chosen = wanted.filter((node) => taken.has(node.name));
  const settings = await sweepSettings();
  const results = await Promise.allSettled(chosen.map((node) => sweepAndStore(node, settings)));
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

/** The operator's sweep settings, or the defaults when the table is empty or absent. */
export async function sweepSettings(): Promise<SweepSettings> {
  try {
    const result = await database().query<{ settings: unknown }>(
      'SELECT settings FROM research_sweep_settings WHERE id',
    );
    return parseSweepSettings(result.rows[0]?.settings);
  } catch {
    // Missing table (migration not applied yet) is the defaults, not an outage.
    return { ...DEFAULT_SWEEP_SETTINGS };
  }
}

export async function saveSweepSettings(next: SweepSettings, actorId: string): Promise<void> {
  await database().query(
    `INSERT INTO research_sweep_settings (id, settings, updated_at, updated_by)
     VALUES (true, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE SET settings = $1, updated_at = now(), updated_by = $2`,
    [JSON.stringify(parseSweepSettings(next)), actorId],
  );
}
