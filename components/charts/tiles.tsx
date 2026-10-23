import React from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// StatTiles — a strip of equal cells: figure, label, one note.
// ---------------------------------------------------------------------------

export interface StatTile {
  label: string;
  value: React.ReactNode;
  href?: string;
  note?: React.ReactNode;
  /** Hover text, e.g. the sum behind a score. */
  title?: string;
}

export function StatTiles({ tiles, label }: { tiles: StatTile[]; label?: string }) {
  return (
    <ul className="ck-tiles" aria-label={label} data-count={tiles.length}>
      {tiles.map((tile) => {
        const inner = (
          <>
            <span
              className={`ck-tile-value${typeof tile.value === 'string' && !/^[\d.,]/.test(tile.value) ? ' is-word' : ''}`}
            >
              {tile.value}
            </span>
            <span className="ck-tile-label">{tile.label}</span>
            {tile.note !== undefined && <span className="ck-tile-note">{tile.note}</span>}
          </>
        );
        return (
          <li key={tile.label}>
            {tile.href ? (
              <Link href={tile.href} className="ck-tile" title={tile.title}>
                {inner}
              </Link>
            ) : (
              <div className="ck-tile" title={tile.title}>
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Meter — one value against its maximum, as a track; the same shape
// wherever a severity or a readiness is shown.
// ---------------------------------------------------------------------------

export function Meter({
  value,
  max,
  label,
  href,
  children,
}: {
  value: number;
  max: number;
  label: string;
  href?: string;
  /** The figure as rendered (a checkable Figure, say); defaults to the value. */
  children?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const body = (
    <>
      <span className="ck-meter-value">
        {children ?? value}
        <span className="ck-meter-max">/{max}</span>
      </span>
      <span className="ck-meter-track" aria-hidden>
        <span className="ck-meter-fill" style={{ width: `${pct}%` }} />
      </span>
    </>
  );
  const title = `${label}: ${value} of ${max}`;
  return href ? (
    <Link href={href} className="ck-meter" title={title} aria-label={title}>
      {body}
    </Link>
  ) : (
    <span className="ck-meter" title={title}>
      {body}
    </span>
  );
}
