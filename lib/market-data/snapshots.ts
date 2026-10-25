/**
 * Computed EDGAR reads (fundamentals, holders) kept per CIK, so a question does
 * not re-read four megabytes of company facts. The database row
 * (research_market_snapshots) is the shared copy the cron refreshes; an
 * in-process copy stands in where there is no database (a fresh deployment,
 * a test). Every figure inside a snapshot carries its own filing and date.
 */
import { database } from '@/lib/db';

export type SnapshotKind = 'fundamentals' | 'holders';

export interface Snapshot<T> {
  data: T;
  fetchedAt: string;
}

const memory = new Map<string, Snapshot<unknown>>();

async function readRow<T>(kind: SnapshotKind, key: string): Promise<Snapshot<T> | null> {
  try {
    const r = await database().query<{ data: T; fetched_at: Date }>(
      'SELECT data, fetched_at FROM research_market_snapshots WHERE kind = $1 AND key = $2',
      [kind, key],
    );
    const row = r.rows[0];
    return row ? { data: row.data, fetchedAt: row.fetched_at.toISOString() } : null;
  } catch {
    return null;
  }
}

export async function writeSnapshot<T>(kind: SnapshotKind, key: string, data: T): Promise<boolean> {
  memory.set(`${kind}:${key}`, { data, fetchedAt: new Date().toISOString() });
  try {
    await database().query(
      `INSERT INTO research_market_snapshots (kind, key, data) VALUES ($1, $2, $3)
       ON CONFLICT (kind, key) DO UPDATE SET data = EXCLUDED.data, fetched_at = now()`,
      [kind, key, JSON.stringify(data)],
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * The snapshot if younger than `maxAgeMs`, else `compute()` stored and
 * returned. A failed compute falls back to an older snapshot, if any.
 */
export async function cachedSnapshot<T>(
  kind: SnapshotKind,
  key: string,
  maxAgeMs: number,
  compute: () => Promise<T | null>,
  now = Date.now(),
): Promise<Snapshot<T> | null> {
  const mem = memory.get(`${kind}:${key}`) as Snapshot<T> | undefined;
  const row = mem ?? (await readRow<T>(kind, key));
  if (row && now - Date.parse(row.fetchedAt) < maxAgeMs) return row;
  const fresh = await compute();
  if (fresh === null) return row;
  await writeSnapshot(kind, key, fresh);
  return { data: fresh, fetchedAt: new Date(now).toISOString() };
}

/** Forget the in-process copies (tests). */
export function resetSnapshots(): void {
  memory.clear();
}
