/**
 * Where network verdicts and run scorecards live: the database on the box
 * (scripts/db/014-quality.sql), or a JSON file for an on-demand run from a
 * laptop. Both behind one interface, so the run does not care which.
 */
import { readFile, writeFile } from 'node:fs/promises';

import { database } from '@/lib/db';

export type CheckKind = 'link' | 'quote' | 'sec' | 'figi' | 'usgs-pdf';

export interface StoredCheck {
  kind: CheckKind;
  key: string;
  /** null = could not tell (blocked, unreadable); never counted as a failure. */
  ok: boolean | null;
  status: string;
  detail: string;
  url: string;
  checkedAt: string;
}

export interface ScoreLine {
  dataset: string;
  criterion: string;
  checked: number;
  passed: number;
}

export interface RunRecord {
  startedAt: string;
  finishedAt: string | null;
  looked: number;
  failed: number;
  scores: ScoreLine[];
}

export interface CheckStore {
  load(): Promise<StoredCheck[]>;
  save(rows: readonly StoredCheck[]): Promise<void>;
  startRun(): Promise<number>;
  finishRun(
    id: number,
    looked: number,
    failed: number,
    scores: readonly ScoreLine[],
  ): Promise<void>;
}

export const dbStore: CheckStore = {
  async load() {
    const { rows } = await database().query<{
      kind: CheckKind;
      key: string;
      ok: boolean | null;
      status: string;
      detail: string;
      url: string;
      checked_at: Date;
    }>('SELECT kind, key, ok, status, detail, url, checked_at FROM research_quality_checks');
    return rows.map((r) => ({ ...r, checkedAt: r.checked_at.toISOString() }));
  },
  async save(rows) {
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const values = batch.map(
        (_, j) =>
          `($${j * 7 + 1},$${j * 7 + 2},$${j * 7 + 3},$${j * 7 + 4},$${j * 7 + 5},$${j * 7 + 6},$${j * 7 + 7})`,
      );
      await database().query(
        `INSERT INTO research_quality_checks (kind, key, ok, status, detail, url, checked_at)
         VALUES ${values.join(',')}
         ON CONFLICT (kind, key) DO UPDATE SET ok = EXCLUDED.ok, status = EXCLUDED.status,
           detail = EXCLUDED.detail, url = EXCLUDED.url, checked_at = EXCLUDED.checked_at`,
        batch.flatMap((r) => [
          r.kind,
          r.key,
          r.ok,
          r.status,
          r.detail.slice(0, 500),
          r.url,
          r.checkedAt,
        ]),
      );
    }
  },
  async startRun() {
    const { rows } = await database().query<{ id: string }>(
      'INSERT INTO research_quality_runs DEFAULT VALUES RETURNING id',
    );
    return Number(rows[0].id);
  },
  async finishRun(id, looked, failed, scores) {
    await database().query(
      'UPDATE research_quality_runs SET finished_at = now(), looked = $2, failed = $3, scores = $4 WHERE id = $1',
      [id, looked, failed, JSON.stringify(scores)],
    );
  },
};

/** The last runs, oldest first, for the trend. */
export async function runHistory(limit = 60): Promise<RunRecord[]> {
  const { rows } = await database().query<{
    started_at: Date;
    finished_at: Date | null;
    looked: number;
    failed: number;
    scores: ScoreLine[];
  }>(
    `SELECT started_at, finished_at, looked, failed, scores FROM research_quality_runs
      WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT $1`,
    [limit],
  );
  return rows.reverse().map((r) => ({
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
    looked: r.looked,
    failed: r.failed,
    scores: r.scores,
  }));
}

/** A JSON file standing in for the tables, for runs away from the box. */
export function fileStore(path: string): CheckStore & { runs: RunRecord[] } {
  const runs: RunRecord[] = [];
  return {
    runs,
    async load() {
      try {
        return JSON.parse(await readFile(path, 'utf8')) as StoredCheck[];
      } catch {
        return [];
      }
    },
    async save(rows) {
      const merged = new Map((await this.load()).map((r) => [`${r.kind} ${r.key}`, r]));
      for (const r of rows) merged.set(`${r.kind} ${r.key}`, r);
      await writeFile(path, JSON.stringify([...merged.values()], null, 1));
    },
    async startRun() {
      return (
        runs.push({
          startedAt: new Date().toISOString(),
          finishedAt: null,
          looked: 0,
          failed: 0,
          scores: [],
        }) - 1
      );
    },
    async finishRun(id, looked, failed, scores) {
      runs[id] = {
        ...runs[id],
        finishedAt: new Date().toISOString(),
        looked,
        failed,
        scores: [...scores],
      };
    },
  };
}
