import React from 'react';

import { formatNumber } from './line';

// ---------------------------------------------------------------------------
// ShareBars — named holders of one whole, each a bar on the same scale.
// ---------------------------------------------------------------------------

export interface ShareRow {
  label: React.ReactNode;
  /** Per cent of the whole; null = named, but no figure on record. */
  share: number | null;
  href?: string;
  /** One line under the label. */
  detail?: React.ReactNode;
  /** Shown in place of the figure when the share is null. */
  missing?: string;
}

export function ShareBars({
  rows,
  caption,
  other,
}: {
  rows: ShareRow[];
  caption?: React.ReactNode;
  /** The unnamed remainder, when every named row has a figure. */
  other?: { label: string; share: number };
}) {
  const scale = Math.max(...rows.map((r) => r.share ?? 0), other?.share ?? 0, 1);
  const bar = (share: number | null) => (
    <span className="ck-share-track" aria-hidden>
      {share !== null && (
        <span className="ck-share-fill" style={{ width: `${(share / scale) * 100}%` }} />
      )}
    </span>
  );
  const figure = (share: number | null, missing?: string) =>
    share === null ? (
      <span className="ck-share-missing">{missing ?? 'no figure on record'}</span>
    ) : (
      <span className="ck-share-value">
        {Number.isInteger(share) ? share : share.toFixed(share < 10 ? 2 : 1)}%
      </span>
    );
  return (
    <figure className="ck-shares">
      <ol className="ck-share-rows">
        {rows.map((row, i) => (
          <li key={i} className="ck-share-row">
            <span className="ck-share-label">
              {row.href ? (
                <a href={row.href} rel="noreferrer" className="ck-share-name">
                  {row.label}
                </a>
              ) : (
                <span className="ck-share-name">{row.label}</span>
              )}
              {row.detail && <span className="ck-share-detail">{row.detail}</span>}
            </span>
            {bar(row.share)}
            {figure(row.share, row.missing)}
          </li>
        ))}
        {other && (
          <li className="ck-share-row is-other">
            <span className="ck-share-label">
              <span className="ck-share-name">{other.label}</span>
            </span>
            {bar(other.share)}
            {figure(other.share)}
          </li>
        )}
      </ol>
      {caption && <figcaption className="ck-caption">{caption}</figcaption>}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// BarChart — one value per row, bars on a shared scale.
// ---------------------------------------------------------------------------

export interface BarRow {
  label: React.ReactNode;
  value: number;
  href?: string;
  note?: React.ReactNode;
}

export function BarChart({
  rows,
  unit,
  caption,
}: {
  rows: BarRow[];
  unit?: string;
  caption?: React.ReactNode;
}) {
  const scale = Math.max(...rows.map((r) => r.value), 1);
  return (
    <figure className="ck-shares">
      <ol className="ck-share-rows">
        {rows.map((row, i) => (
          <li key={i} className="ck-share-row">
            <span className="ck-share-label">
              {row.href ? (
                <a href={row.href} rel="noreferrer" className="ck-share-name">
                  {row.label}
                </a>
              ) : (
                <span className="ck-share-name">{row.label}</span>
              )}
              {row.note && <span className="ck-share-detail">{row.note}</span>}
            </span>
            <span className="ck-share-track" aria-hidden>
              <span className="ck-share-fill" style={{ width: `${(row.value / scale) * 100}%` }} />
            </span>
            <span className="ck-share-value">
              {formatNumber(row.value)}
              {unit ? ` ${unit}` : ''}
            </span>
          </li>
        ))}
      </ol>
      {caption && <figcaption className="ck-caption">{caption}</figcaption>}
    </figure>
  );
}
