/**
 * The desk's per-reader state in the database: preferences and row marks.
 *
 * Preferences are one JSON document per reader (`research_preferences`), read
 * and written whole through `parseFollows`, so a field this code does not know
 * yet is dropped rather than trusted. Marks are one row per (reader, item,
 * state) — read, saved, hidden — so toggling one never races another.
 */
import { database } from './db';
import { parseFollows, type Follows } from './follows';
import type { MarkState } from './desk-filter';

export async function readFollows(actorId: string): Promise<Follows> {
  try {
    const result = await database().query<{ topics: unknown }>(
      'SELECT topics FROM research_preferences WHERE actor_id=$1',
      [actorId],
    );
    return parseFollows(result.rows[0]?.topics);
  } catch {
    return parseFollows(undefined);
  }
}

/** Read, change, write — through the parser both ways, so nothing unchecked is stored. */
export async function updateFollows(
  actorId: string,
  change: (current: Follows) => Follows,
): Promise<Follows> {
  const current = await readFollows(actorId);
  const next = parseFollows(change(current));
  await database().query(
    'INSERT INTO research_preferences(actor_id,topics) VALUES($1,$2) ON CONFLICT(actor_id) DO UPDATE SET topics=$2,updated_at=now()',
    [actorId, JSON.stringify(next)],
  );
  return next;
}

export type Marks = Record<MarkState, Set<string>>;

export function emptyMarks(): Marks {
  return { read: new Set(), saved: new Set(), hidden: new Set() };
}

export async function readMarks(actorId: string): Promise<Marks> {
  const marks = emptyMarks();
  try {
    const result = await database().query<{ item_key: string; state: MarkState }>(
      'SELECT item_key, state FROM research_desk_marks WHERE actor_id=$1',
      [actorId],
    );
    for (const row of result.rows) marks[row.state]?.add(row.item_key);
  } catch {
    // Table not provisioned yet: an unmarked desk, not a broken one.
  }
  return marks;
}

export async function setMark(
  actorId: string,
  itemKey: string,
  state: MarkState,
  on: boolean,
): Promise<void> {
  if (on) {
    await database().query(
      `INSERT INTO research_desk_marks (actor_id, item_key, state) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [actorId, itemKey, state],
    );
  } else {
    await database().query(
      'DELETE FROM research_desk_marks WHERE actor_id=$1 AND item_key=$2 AND state=$3',
      [actorId, itemKey, state],
    );
  }
}

export async function clearMarks(actorId: string, state: MarkState): Promise<void> {
  await database().query('DELETE FROM research_desk_marks WHERE actor_id=$1 AND state=$2', [
    actorId,
    state,
  ]);
}
