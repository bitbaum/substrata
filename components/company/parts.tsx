import React from 'react';

import { correctionUrl } from '@/lib/site';

/**
 * The pieces every market section shares: the loading line a section shows
 * while its read streams in, the empty state that says what would fill it,
 * and a change figure that carries its direction in a word as well as a
 * colour (status colours mean up or down here, nothing else).
 */

export function SectionLoading({ what }: { what: string }) {
  return (
    <p className="mk-loading" role="status">
      Reading {what}…
    </p>
  );
}

export function EmptyState({
  name,
  missing,
  sources = [],
  topic,
}: {
  name: string;
  missing: string;
  /** The documents that would fill it, in words. */
  sources?: readonly string[];
  /** What the evidence would be about, for the correction form. */
  topic: string;
}) {
  return (
    <div className="mk-empty">
      <p>{missing}</p>
      {sources.length > 0 && (
        <p className="mk-empty-sources">Would be filled by: {sources.join('; ')}.</p>
      )}
      <a
        className="mk-empty-action"
        href={correctionUrl(`${name} — ${topic}`, { problem: `Evidence for ${name}: ${topic}.` })}
        rel="noreferrer"
      >
        Send evidence about its {topic}
      </a>
    </div>
  );
}

export type Direction = 'up' | 'down' | 'flat' | null;

/** "+3.2%" in the up tone, with "up"/"down" said to assistive tech. */
export function Delta({ display, direction }: { display: string; direction: Direction }) {
  const word = direction === 'up' ? 'up ' : direction === 'down' ? 'down ' : '';
  return (
    <span className={`mk-delta${direction ? ` is-${direction}` : ''}`}>
      <span className="sr-only">{word}</span>
      {display}
    </span>
  );
}

/** A line under a section: what the figures are and where they come from. */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="mk-note">{children}</p>;
}
