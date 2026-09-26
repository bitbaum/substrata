/**
 * Relative dates for feeds ("3h ago", "yesterday", "12 Sep"). Re-exported
 * from lib/desk.ts, where it was first written.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "just now", "3h ago", "yesterday", "12 Sep", "3 Dec 2025". */
export function whenLabel(iso: string, now: Date = new Date(), dateOnly = false): string {
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  const sameYear = then.getUTCFullYear() === now.getUTCFullYear();
  // Spelled out rather than locale-formatted: `en-GB` writes "Sept" in newer
  // ICU data and "Sep" in older, and the server's Node picks which.
  const calendar = `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}${
    sameYear ? '' : ` ${then.getUTCFullYear()}`
  }`;
  if (dateOnly) {
    const days = Math.floor(
      (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate())) /
        86_400_000,
    );
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return calendar;
  }
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 48 * 60) return 'yesterday';
  return calendar;
}

/** The day-group a row falls in: Today, Yesterday, This week, This month, Earlier. */
export function bucketOf(item: { at: string }, now: Date): string {
  const day = (iso: string) => Date.parse(iso.slice(0, 10));
  const days = Math.round((day(now.toISOString()) - day(item.at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  if (days < 31) return 'This month';
  return 'Earlier';
}
