/**
 * A table an answer carries beside its prose, built in code from tool rows —
 * never written by the model. Asked on 2026-10-24 which companies mine uranium
 * in Kazakhstan, the answer pasted the USGS cell as one paragraph: sixteen
 * ventures and their shareholders run together, then sixteen places run
 * together. The rows were right; the shape was unreadable. So a tool that
 * returns many rows hands the reader a table of them (`table` on its result,
 * routed to the answer by lib/chat-tools/registry.ts), and the model is told
 * to say what the table shows instead of pasting it.
 *
 * Every cell is copied from the source verbatim: no re-uniting, no
 * recombining. A cell the source printed once for several rows (one list of
 * places for sixteen ventures) is not split by guesswork: it is a `shared`
 * note under the rows it belongs to.
 *
 * Shared by the server (the answer) and the browser (the drawing): no imports.
 */

export const TABLE_COLUMNS = [
  'operator',
  'owners',
  'commodity',
  'location',
  'capacity',
  'year',
] as const;
export type TableColumn = (typeof TABLE_COLUMNS)[number];

export type TableRow = Record<TableColumn, string | null>;

export interface SharedCell {
  label: string;
  /** Verbatim, as printed once for these rows. */
  text: string;
  /** The rows it was printed for, 0-based and inclusive. */
  rows: [number, number];
}

export interface AnswerTable {
  id: string;
  caption: string;
  columns: { key: TableColumn; label: string }[];
  rows: TableRow[];
  shared: SharedCell[];
  source: { label: string; url: string };
  /** What the reader must know to read it right. */
  note: string;
}

/** Rows the table shows before "Show all". */
export const TABLE_PREVIEW_ROWS = 8;

/** A table as plain lines, for Copy, Listen and a reader without the drawing. */
export function tableText(t: AnswerTable): string {
  const lines = t.rows.map((r) =>
    t.columns
      .map((c) => r[c.key])
      .filter(Boolean)
      .join(' — '),
  );
  const shared = t.shared.map((s) => `${s.label}: ${s.text}`);
  return [t.caption, ...lines, ...shared, `Source: ${t.source.label} ${t.source.url}`].join('\n');
}

/** Whether an unknown value is a table this module drew; the browser checks before drawing. */
export function isAnswerTable(v: unknown): v is AnswerTable {
  if (!v || typeof v !== 'object') return false;
  const t = v as Partial<AnswerTable>;
  return (
    typeof t.id === 'string' &&
    typeof t.caption === 'string' &&
    Array.isArray(t.columns) &&
    Array.isArray(t.rows) &&
    Array.isArray(t.shared) &&
    typeof t.source?.url === 'string'
  );
}
