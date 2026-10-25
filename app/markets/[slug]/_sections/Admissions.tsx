import React from 'react';

import { TESTS } from '@/config/universe-themes';
import type { Admission } from '@/lib/universe/types';

/** Where a reader can look an identifier up, at its own registry. */
export function identifierHref(kind: string, value: string): string | undefined {
  if (kind === 'cik')
    return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${value}`;
  if (kind === 'lei') return `https://search.gleif.org/#/record/${value}`;
  if (kind === 'qid') return `https://www.wikidata.org/wiki/${value}`;
  return undefined;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * A quoted record (a CSV line, a JSON object) has no spaces to wrap at, so a
 * break opportunity follows every comma and colon: on a phone it wraps between
 * fields, never inside a number. The text is unchanged; copying it copies the quote.
 */
function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=,(?!\d))|(?<=:(?!\/))/);
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <wbr />}
        </React.Fragment>
      ))}
    </>
  );
}

function Row({ a }: { a: Admission }) {
  const href =
    a.test === 'identity' ? identifierHref(a.basis, a.detail.split(' ').pop()!) : undefined;
  return (
    <li className="py-2">
      <p className="text-sm text-fg-primary wrap-anywhere">
        {href ? (
          <a href={href} rel="noreferrer" className="tap underline-offset-4 hover:underline">
            {a.detail}
          </a>
        ) : (
          a.detail
        )}
      </p>
      {a.quote && (
        <blockquote className="mt-1 max-w-prose border-l border-subtle pl-3 font-mono text-xs leading-relaxed text-fg-secondary wrap-anywhere">
          <Breakable text={a.quote} />
        </blockquote>
      )}
      <p className="mt-1 text-xs text-fg-muted wrap-anywhere">
        <a
          href={a.source}
          rel="noreferrer"
          className="tap text-accent underline-offset-4 hover:underline"
        >
          {hostOf(a.source)} ↗
        </a>
        {a.asOf ? ` · as of ${a.asOf}` : ''}
        {a.readOn ? ` · read ${a.readOn}` : ''}
      </p>
    </li>
  );
}

/**
 * The evidence that admits a company, one block per test, every row with its
 * quote, source and dates. Shown whole: a reader should never have to take
 * "it is in" on trust.
 */
export function Admissions({ admittedBy }: { admittedBy: Admission[] }) {
  return (
    <div className="space-y-6">
      {TESTS.map((test) => {
        const rows = admittedBy.filter((a) => a.test === test.id);
        if (!rows.length) return null;
        return (
          <div key={test.id}>
            <h3 className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              {test.label} · {rows.length}
            </h3>
            <p className="mt-1 max-w-prose text-xs text-fg-muted">{test.rule}</p>
            <ul className="mt-2 divide-y divide-subtle">
              {rows.map((a, i) => (
                <Row key={`${a.source}-${i}`} a={a} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
