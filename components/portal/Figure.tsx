/**
 * A number a reader can check.
 *
 * Every figure on this site is one of three things, and a reader should be one
 * click from knowing which:
 *
 * - **sourced** — somebody else published it. The number links to that source.
 * - **computed** — a function of the corpus (a count, a share, a score). The
 *   number opens its rule and links the method page (/data#method-…), which
 *   in turn links the code.
 * - **estimate** — a judgement. It says whose, when, and on what basis, so it
 *   cannot pass for a measurement.
 *
 * A bare numeric literal in page copy is none of these.
 *
 * Every figure opens the same native HTML popover (a button + `popover`
 * element — keyboard- and screen-reader-accessible, light-dismissing, and
 * working without client JavaScript): what the number is, where it comes
 * from, and "Check this", which hands the number, its sentence and its source
 * to Ask for a verdict. A sourced number's popover leads with its source.
 *
 * Inside another link (a whole-card link, say) a nested interactive element is
 * invalid HTML, so pass `inLink`: the figure renders as text with its
 * explanation in the tooltip and in visually hidden text, and the enclosing
 * link must itself go somewhere that backs the number.
 */
import React, { useId } from 'react';
import Link from 'next/link';

import { CheckThis } from './CheckThis';

import { METHODS, codeHref, methodHref, type MethodId } from '@/lib/methods';

export interface Estimate {
  /** Who made the judgement: a person, "Substrata (agent-drafted)", or a publisher. */
  by: string;
  /** When, as an ISO date. */
  on: string;
  /** What it rests on, in a sentence. */
  basis: string;
  /** A document that supports it, if there is one. */
  source?: string;
}

type Provenance =
  | { source: string; sourceLabel?: string; asOf?: string; method?: never; estimate?: never }
  | { method: MethodId; detail?: string; source?: never; estimate?: never }
  | { estimate: Estimate; source?: never; method?: never };

export type FigureProps = Provenance & {
  /** The value as shown. Format it before passing; Figure never reformats. */
  children: React.ReactNode;
  /** Rendered inside an existing link: no nested interactive element. */
  inLink?: boolean;
  className?: string;
};

/** The one-line explanation used for the tooltip and for screen readers. */
export function figureExplanation(props: Provenance): string {
  if (props.source !== undefined) {
    const label = props.sourceLabel ?? hostOf(props.source);
    return `Source: ${label}${props.asOf ? ` (${props.asOf})` : ''}`;
  }
  if (props.method !== undefined) {
    const method = METHODS[props.method];
    return `Computed: ${method.formula}${props.detail ? ` ${props.detail}` : ''}`;
  }
  const { by, on, basis } = props.estimate;
  return `Estimate by ${by}, ${on}: ${basis}`;
}

/** A source with no label is named by its host, never left blank. */
function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export function Figure(props: FigureProps) {
  const { children, inLink, className } = props;
  const id = useId();
  const explanation = figureExplanation(props);
  const valueClass = ['figure-value', className].filter(Boolean).join(' ');

  if (inLink) {
    return (
      <span className={valueClass} title={explanation}>
        {children}
        <span className="sr-only"> ({explanation})</span>
      </span>
    );
  }

  const popId = `figure-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={popId}
        className={`figure-trigger ${valueClass}`}
        title={explanation}
        aria-describedby={`${popId}-sr`}
      >
        {children}
      </button>
      <span id={`${popId}-sr`} className="sr-only">
        {explanation}
      </span>
      <span id={popId} popover="auto" role="note" className="figure-pop" data-check-anchor>
        <FigureBody {...props} />
        <span className="figure-pop-check">
          <CheckThis
            value={textOf(children)}
            source={props.source ?? props.estimate?.source}
            label="Check this number with Ask"
          />
        </span>
      </span>
    </>
  );
}

/** The figure's text, for the check request. */
function textOf(node: React.ReactNode): string | undefined {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('') || undefined;
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textOf(node.props.children);
  return undefined;
}

function FigureBody(props: Provenance) {
  if (props.source !== undefined) {
    const label = props.sourceLabel ?? hostOf(props.source);
    return (
      <>
        <span className="figure-pop-kicker">Sourced</span>
        <span className="figure-pop-text">
          {label}
          {props.asOf ? ` · ${props.asOf}` : ''}
        </span>
        <span className="figure-pop-links">
          {isExternal(props.source) ? (
            <a href={props.source} rel="noopener noreferrer" target="_blank">
              Open the source →
            </a>
          ) : (
            <Link href={props.source}>Open the source →</Link>
          )}
        </span>
      </>
    );
  }
  if (props.method !== undefined) {
    const method = METHODS[props.method];
    return (
      <>
        <span className="figure-pop-kicker">How this is computed</span>
        <span className="figure-pop-text">{method.formula}</span>
        {props.detail && <span className="figure-pop-text">{props.detail}</span>}
        <span className="figure-pop-links">
          <Link href={methodHref(props.method)}>Method →</Link>
          {method.code.slice(0, 1).map((path) => (
            <a key={path} href={codeHref(path)} rel="noopener noreferrer" target="_blank">
              Code →
            </a>
          ))}
        </span>
      </>
    );
  }
  if (props.estimate !== undefined) {
    const { by, on, basis, source } = props.estimate;
    return (
      <>
        <span className="figure-pop-kicker">Estimate, not a measurement</span>
        <span className="figure-pop-text">{basis}</span>
        <span className="figure-pop-text">
          By {by} · {on}
        </span>
        {source && (
          <span className="figure-pop-links">
            {isExternal(source) ? (
              <a href={source} rel="noopener noreferrer" target="_blank">
                Supporting source →
              </a>
            ) : (
              <Link href={source}>Supporting source →</Link>
            )}
          </span>
        )}
      </>
    );
  }
  return null;
}
