import React from 'react';
import Link from 'next/link';

import type { SourceCell, StubGroup, StubRow } from '@/lib/entities/stub-evidence';

const QUIET = 'text-xs text-fg-tertiary';
const SUMMARY =
  'tap cursor-pointer text-xs text-accent underline-offset-4 hover:underline marker:text-fg-muted';

/** The cell itself, whole: its text, where in the source, and the link. Never cut; only collapsed. */
function Cell({ cell }: { cell: SourceCell }) {
  return (
    <div className="mt-2">
      <blockquote className="max-w-prose border-l border-subtle pl-3 text-sm leading-relaxed text-fg-secondary wrap-anywhere">
        {cell.quote}
      </blockquote>
      <p className="mt-1 text-xs text-fg-muted wrap-anywhere">
        <a
          href={cell.url}
          rel="noreferrer"
          className="tap text-accent underline-offset-4 hover:underline"
        >
          {cell.label} ↗
        </a>
        {cell.locator ? ` · ${cell.locator}` : ''}
        {cell.reading ? ` · ${cell.reading}` : ''}
      </p>
    </div>
  );
}

function Row({ row, cells }: { row: StubRow; cells: Map<string, SourceCell> }) {
  const own = row.cells.map((id) => cells.get(id)!).filter((c) => c.rows === 1);
  const shared = row.cells.map((id) => cells.get(id)!).filter((c) => c.rows > 1);
  return (
    <li className="py-1">
      <div className="flex flex-wrap items-center gap-x-4">
        {row.other.href ? (
          <Link
            href={row.other.href}
            className="tap font-medium text-fg-primary underline-offset-4 hover:underline"
          >
            {row.other.name}
          </Link>
        ) : (
          <span className="font-medium text-fg-primary">{row.other.name}</span>
        )}
        {row.amount && <span className="font-mono text-sm text-fg-secondary">{row.amount}</span>}
        <span className={QUIET}>
          {row.asOf} · {row.grade}
        </span>
        {shared.map((c) => (
          <a
            key={c.id}
            href={`#source-${c.id}`}
            className={`tap ${QUIET} underline-offset-4 hover:underline`}
          >
            source {c.id.slice(1)}
          </a>
        ))}
      </div>
      {own.length > 0 && (
        <details className="mb-2">
          <summary className={SUMMARY}>Show the quote</summary>
          {own.map((c) => (
            <Cell key={c.id} cell={c} />
          ))}
        </details>
      )}
    </li>
  );
}

/**
 * "What the sources say" on a stub company, compact: relations grouped by
 * what they say, one line each, quotes collapsed per row, and a cell that
 * backs several rows printed once, below, with how many rows rest on it.
 */
export function StubSources({ groups, cells }: { groups: StubGroup[]; cells: SourceCell[] }) {
  const byId = new Map(cells.map((c) => [c.id, c]));
  const shared = cells.filter((c) => c.rows > 1);
  return (
    <>
      {groups.map((group) => (
        <div key={group.key} className="mb-6">
          <h3 className="mb-1 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {group.label} ({group.rows.length})
          </h3>
          <ul className="divide-y divide-subtle border-y border-subtle">
            {group.rows.map((row) => (
              <Row key={row.relationId} row={row} cells={byId} />
            ))}
          </ul>
        </div>
      ))}
      {shared.length > 0 && (
        <ul className="divide-y divide-subtle border-y border-subtle">
          {shared.map((cell) => (
            <li key={cell.id} id={`source-${cell.id}`} className="scroll-mt-24 py-2">
              <p className="text-sm text-fg-secondary">
                Source {cell.id.slice(1)}: {cell.label} — {cell.rows} rows
              </p>
              <details>
                <summary className={SUMMARY}>Show the cell as printed</summary>
                <Cell cell={cell} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
