import { createHash } from 'node:crypto';

import { evidenceKey, type EvidenceCandidate } from '@/config/substrata-evidence';
import { database } from './db';
import { examineRow, unsourcedRows } from './source';

/**
 * The scheduled producer-sourcing run, and the one queue its findings go to.
 *
 * The box timer (`appcron-substrata-source`, every six hours) is the only
 * producer-sourcing run. The box runs releases, not checkouts, so it writes a
 * review queue rather than a file. `app/review` reads it the way it reads
 * `research_sweep_candidates`, and bottleneck pages read its open rows live
 * (`openCandidatesFor`). Nothing here is a finding until a person reads the
 * excerpt and promotes the row in `config/substrata-coverage.ts` by hand.
 */

/** Small on purpose, same reasoning as the event sweep: each row costs several web calls. */
const ROWS_PER_RUN = 4;

export interface SourceOutcome {
  examined: string[];
  found: number;
  couldNotLook: number;
}

function candidateId(material: string, producer: string, url: string): string {
  return createHash('sha1').update(`${material}::${producer}::${url}`).digest('hex').slice(0, 16);
}

/**
 * Examine the least-recently-checked unsourced rows.
 *
 * Rotating by `last_checked` means a bounded run still covers the whole
 * unsourced set over time, and a row that keeps coming back "nothing" does
 * not monopolise the budget forever.
 */
export async function runScheduledSourcing(limit = ROWS_PER_RUN): Promise<SourceOutcome> {
  const db = database();
  const all = unsourcedRows();

  const seen = await db.query<{ row_key: string; last_checked: Date }>(
    'SELECT row_key, last_checked FROM research_source_state',
  );
  const lastChecked = new Map(
    seen.rows.map((row) => [row.row_key, row.last_checked.toISOString()]),
  );
  const queue = [...all]
    .sort((a, b) => {
      const ka = evidenceKey(a.material, a.producer.name);
      const kb = evidenceKey(b.material, b.producer.name);
      return (lastChecked.get(ka) ?? '').localeCompare(lastChecked.get(kb) ?? '');
    })
    .slice(0, limit);

  const run = await db.query<{ id: string }>(
    'INSERT INTO research_source_runs DEFAULT VALUES RETURNING id',
  );
  const runId = run.rows[0].id;

  const outcome: SourceOutcome = { examined: [], found: 0, couldNotLook: 0 };

  for (const { material, producer } of queue) {
    const key = evidenceKey(material, producer.name);
    const { row } = await examineRow(producer, material);
    if (row.status === 'could_not_look') outcome.couldNotLook += 1;

    for (const candidate of row.candidates) {
      // A URL already seen stays as it was: re-finding a lead is not news, and
      // a re-run must never resurrect something a reviewer already rejected.
      const inserted = await db.query(
        `INSERT INTO research_source_candidates
           (id, material, producer, query, url, title, excerpt, matched)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          candidateId(material, producer.name, candidate.url),
          material,
          producer.name,
          row.query,
          candidate.url,
          candidate.title,
          candidate.excerpt,
          candidate.matched.join(', '),
        ],
      );
      outcome.found += inserted.rowCount ?? 0;
    }

    await db.query(
      `INSERT INTO research_source_state (row_key, last_checked, last_status)
       VALUES ($1, now(), $2)
       ON CONFLICT (row_key) DO UPDATE SET last_checked = now(), last_status = $2`,
      [key, row.status],
    );
    outcome.examined.push(key);
  }

  await db.query(
    `UPDATE research_source_runs
        SET finished_at = now(), rows_examined = $2, candidates_found = $3, could_not_look = $4
      WHERE id = $1`,
    [runId, outcome.examined.length, outcome.found, outcome.couldNotLook],
  );

  return outcome;
}

export interface SourceFreshness {
  lastRunAt: string | null;
  rowsCovered: number;
  rowsTotal: number;
  openCandidates: number;
  /** Rows the engine could not look at last time it tried — blindness, not absence. */
  blind: number;
}

/** How fresh the producer-sourcing queue actually is — see `freshness()` in `lib/sweep-store.ts`. */
export async function sourceFreshness(): Promise<SourceFreshness> {
  const db = database();
  const [run, state, open] = await Promise.all([
    db.query<{ finished_at: Date | null }>(
      'SELECT finished_at FROM research_source_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1',
    ),
    db.query<{ covered: string; blind: string }>(
      `SELECT count(*) AS covered,
              count(*) FILTER (WHERE last_status = 'could_not_look') AS blind
         FROM research_source_state`,
    ),
    db.query<{ open: string }>(
      'SELECT count(*) AS open FROM research_source_candidates WHERE reviewed_at IS NULL',
    ),
  ]);
  return {
    lastRunAt: run.rows[0]?.finished_at?.toISOString() ?? null,
    rowsCovered: Number(state.rows[0]?.covered ?? 0),
    rowsTotal: unsourcedRows().length,
    openCandidates: Number(open.rows[0]?.open ?? 0),
    blind: Number(state.rows[0]?.blind ?? 0),
  };
}

export interface QueuedSourceCandidate {
  id: string;
  material: string;
  producer: string;
  url: string;
  title: string;
  excerpt: string;
  matched: string;
  foundAt: string;
}

/** The candidates a reviewer has not yet decided on. Newest first — see `openCandidates()` in `lib/sweep-store.ts`. */
export async function openSourceCandidates(limit = 100): Promise<QueuedSourceCandidate[]> {
  const result = await database().query<{
    id: string;
    material: string;
    producer: string;
    url: string;
    title: string;
    excerpt: string;
    matched: string;
    found_at: Date;
  }>(
    `SELECT id, material, producer, url, title, excerpt, matched, found_at
       FROM research_source_candidates
      WHERE reviewed_at IS NULL
      ORDER BY found_at DESC, material, producer
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    material: row.material,
    producer: row.producer,
    url: row.url,
    title: row.title,
    excerpt: row.excerpt,
    matched: row.matched,
    foundAt: row.found_at.toISOString(),
  }));
}

/**
 * Record a reviewer's decision. Accepting does NOT promote the row — see
 * `recordVerdict()` in `lib/sweep-store.ts` for the identical reasoning: the
 * coverage file is git, and a row reaches it only when a person edits it.
 */
export async function recordSourceVerdict(
  id: string,
  verdict: 'accepted' | 'rejected',
  actorId: string,
): Promise<void> {
  await database().query(
    `UPDATE research_source_candidates
        SET reviewed_at = now(), reviewed_by = $3, verdict = $2
      WHERE id = $1 AND reviewed_at IS NULL`,
    [id, verdict, actorId],
  );
}

/**
 * Open (unreviewed) candidates for one material's producer rows, by producer:
 * what a bottleneck page shows as "found, unchecked". `null` when the queue
 * cannot be read (no database at build time or in CI, or an outage), so the
 * page says it could not look instead of implying nothing was found.
 */
export async function openCandidatesFor(
  material: string,
): Promise<Map<string, EvidenceCandidate[]> | null> {
  try {
    const result = await database().query<{
      producer: string;
      url: string;
      title: string;
      excerpt: string;
      matched: string;
    }>(
      `SELECT producer, url, title, excerpt, matched
         FROM research_source_candidates
        WHERE material = $1 AND reviewed_at IS NULL
        ORDER BY found_at DESC
        LIMIT 60`,
      [material],
    );
    const byProducer = new Map<string, EvidenceCandidate[]>();
    for (const row of result.rows) {
      const list = byProducer.get(row.producer) ?? [];
      list.push({
        url: row.url,
        title: row.title,
        excerpt: row.excerpt,
        matched: row.matched.split(', ').filter(Boolean),
      });
      byProducer.set(row.producer, list);
    }
    return byProducer;
  } catch {
    return null;
  }
}
