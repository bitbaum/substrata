'use client';

import { useState } from 'react';
import {
  TABLE_PREVIEW_ROWS,
  type AnswerTable,
  type TableColumn,
  type TableRow,
} from '@/lib/chat/answer-table';

/** Longer than this, a place is folded behind "Location" rather than filling the row. */
const LONG_PLACE = 70;

/**
 * The tables an answer carries (lib/chat/answer-table.ts), drawn under its
 * prose in chatkit's footer slot. Built in code from the tool rows, so every
 * cell is the source's text; this only lays it out.
 *
 * One component, every width: a real table where the panel is wide, and from
 * the same markup, one card per row where it is not (a container query in
 * styles/answer-table.css) — the answer panel is narrow on a desktop too, so
 * the viewport is the wrong thing to ask. Nothing scrolls sideways; long
 * places fold; past eight rows, "Show all".
 */
export function AnswerTables({ tables }: { tables: AnswerTable[] }) {
  return (
    <>
      {tables.map((t) => (
        <TableFigure key={t.id} table={t} />
      ))}
    </>
  );
}

function TableFigure({ table }: { table: AnswerTable }) {
  const [all, setAll] = useState(false);
  const shown = all ? table.rows : table.rows.slice(0, TABLE_PREVIEW_ROWS);
  // A column nobody's row fills is not drawn, nor a year or commodity every row shares (the caption says it).
  const uniform = (key: TableColumn) => new Set(table.rows.map((r) => r[key])).size === 1;
  const columns = table.columns.filter(
    (c) =>
      table.rows.some((r) => r[c.key]) &&
      !((c.key === 'year' || c.key === 'commodity') && uniform(c.key)),
  );
  const shared = table.shared.filter((s) => s.rows[0] < shown.length);
  return (
    <figure className="answer-table" aria-label={table.caption}>
      <figcaption>{table.caption}</figcaption>
      <div className="answer-table-frame">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    data-label={c.label}
                    data-col={c.key}
                    data-empty={row[c.key] ? undefined : ''}
                  >
                    <Cell column={c.key} row={row} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shared.map((s) => (
        <details key={s.label} className="answer-table-shared">
          <summary>{s.label}</summary>
          <p>{s.text}</p>
        </details>
      ))}
      {table.rows.length > TABLE_PREVIEW_ROWS && (
        <button type="button" className="answer-table-more" onClick={() => setAll((v) => !v)}>
          {all ? `Show the first ${TABLE_PREVIEW_ROWS}` : `Show all ${table.rows.length}`}
        </button>
      )}
      <p className="answer-table-source">
        {table.note}{' '}
        <a href={table.source.url} target="_blank" rel="noreferrer">
          {table.source.label} ↗
        </a>
      </p>
    </figure>
  );
}

function Cell({ column, row }: { column: TableColumn; row: TableRow }) {
  const text = row[column];
  if (!text) return <span className="answer-table-none">—</span>;
  if (column === 'location' && text.length > LONG_PLACE)
    return (
      <details className="answer-table-place">
        <summary>{text.split(',')[0]}</summary>
        <span>{text}</span>
      </details>
    );
  return <>{text}</>;
}
