import Link from 'next/link';

import { hostOf } from '@/lib/desk';
import { GRADE } from '@/lib/company-page/business';
import { bottleneckHref, marketHref } from '@/lib/links';
import type { ExposureSource, Party } from '@/lib/company-exposure';

/** How many rows a group shows before the rest fold under "All n". */
export const SHOWN = 4;

/** The grade in the page's own words: stated, two sources, worked out, lead. */
export const gradeWord = (grade: string) => GRADE[grade] ?? grade;

export function SourceLine({ source }: { source: ExposureSource }) {
  return (
    <>
      <a href={source.url} rel="noreferrer">
        {hostOf(source.url)} ↗
      </a>
      {' · read '}
      {source.readOn}
    </>
  );
}

/** A sentence that carries an edge, verbatim, with where it came from. */
export function Quoted({ sources }: { sources: readonly ExposureSource[] }) {
  return (
    <>
      {sources.map((s) => (
        <blockquote key={`${s.url}|${s.quote}`} className="mk-basis">
          “{s.quote}”
          <br />
          <span className="mk-note">
            <SourceLine source={s} />
            {s.scope ? ` · ${s.scope}` : ''}
          </span>
        </blockquote>
      ))}
    </>
  );
}

/** One party, one anatomy: name, grade, then why it is here and where that is said. */
export function PartyRows({
  rows,
  suffix,
}: {
  rows: readonly Party[];
  suffix?: (p: Party) => string;
}) {
  return (
    <ol className="mk-rows">
      {rows.map((p) => (
        <li key={p.name} className="mk-row">
          <span className="mk-row-name">
            {p.slug ? <Link href={marketHref(p.slug)}>{p.name}</Link> : p.name}
          </span>
          <span className="mk-row-figure">{gradeWord(p.grade)}</span>
          <span className="mk-row-detail">
            {p.basis}
            {suffix ? ` ${suffix(p)}` : ''}
            {p.sources[0] && (
              <>
                {' · '}
                <SourceLine source={p.sources[0]} />
              </>
            )}
            {p.sources.length === 0 && p.chain.length > 0 && ` · from: ${p.chain.join('; ')}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Rows, with the rest folded under "All n". */
export function Folded({
  rows,
  suffix,
}: {
  rows: readonly Party[];
  suffix?: (p: Party) => string;
}) {
  return (
    <>
      <PartyRows rows={rows.slice(0, SHOWN)} suffix={suffix} />
      {rows.length > SHOWN && (
        <details className="mk-more">
          <summary>All {rows.length}</summary>
          <PartyRows rows={rows.slice(SHOWN)} suffix={suffix} />
        </details>
      )}
    </>
  );
}

export function ChokepointLink({ name, slug }: { name: string; slug: string }) {
  return (
    <Link
      href={bottleneckHref(slug)}
      className="text-fg-primary underline-offset-4 hover:underline"
    >
      {name}
    </Link>
  );
}
