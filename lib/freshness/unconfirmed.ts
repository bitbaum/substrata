/**
 * Rows a re-check tried and could not confirm — a source that refused us, a
 * page that changed — recorded in the dataset file itself by the check
 * script's `--write`, never by hand:
 *
 *   "unconfirmed": [{ "id": "…", "reason": "data.bls.gov answered HTTP 503", "triedOn": "2026-10-25" }]
 *
 * Such a row is NOT fresh and is never shown as fresh: /data/freshness and
 * /api/health/freshness list it with its reason. What it buys is that the
 * gate counts it as looked at on `triedOn`, so one source that refuses a
 * datacenter does not turn the whole build red for a month. The entry ages
 * like any date: a month later the next run must try again, or the dataset is
 * stale. A row the next run confirms leaves the list.
 */
export interface Unconfirmed {
  /** The row's id in its dataset (a series id, a company slug). */
  id: string;
  /** Why it could not be confirmed, in the script's words. */
  reason: string;
  /** The day the re-check was tried, YYYY-MM-DD. */
  triedOn: string;
}

/** The date a row counts as looked at: its own check, or a later recorded try. */
export function lookedAt(
  id: string,
  checkedOn: string,
  unconfirmed: readonly Unconfirmed[],
): string {
  const tried = unconfirmed.find((u) => u.id === id)?.triedOn ?? '';
  return tried > checkedOn ? tried : checkedOn;
}

/** The oldest such date over every row — what the dataset's age is judged by. */
export function oldestLookedAt(
  rows: readonly { id: string; checkedOn: string }[],
  unconfirmed: readonly Unconfirmed[],
): string {
  return rows.map((r) => lookedAt(r.id, r.checkedOn, unconfirmed)).sort()[0] ?? '';
}

/** The list with this run's results applied: failures recorded today, confirmations removed. */
export function updateUnconfirmed(
  list: readonly Unconfirmed[],
  run: { confirmed: readonly string[]; failed: readonly { id: string; reason: string }[] },
  today: string,
): Unconfirmed[] {
  const touched = new Set([...run.confirmed, ...run.failed.map((f) => f.id)]);
  return [
    ...list.filter((u) => !touched.has(u.id)),
    ...run.failed.map((f) => ({ id: f.id, reason: f.reason, triedOn: today })),
  ].sort((a, b) => a.id.localeCompare(b.id));
}
