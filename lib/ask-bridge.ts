/**
 * "Check this" anywhere on the site → the Ask dock, pre-loaded.
 *
 * A figure, an event row or a key fact is server-rendered and knows nothing
 * about the dock; the dock is one client component in the layout. They meet
 * on one window event, so neither imports the other and a page needs no
 * provider to offer a check.
 */
export const CHECK_EVENT = 'substrata-check';

export interface CheckRequest {
  /** The claim as it reads on the page. */
  claim: string;
  /** The number, when the click was on a figure. */
  value?: string;
  /** What the page cites for it: an external url or a site path. */
  source?: string;
}

export function requestCheck(detail: CheckRequest): void {
  window.dispatchEvent(new CustomEvent<CheckRequest>(CHECK_EVENT, { detail }));
}

/** The sentence around an element — the claim a number sits in. Bounded. */
export function claimAround(el: Element | null, max = 600): string {
  const block = el?.closest('p, li, td, dd, dt, blockquote, h1, h2, h3, figcaption, tr') ?? el;
  if (!block) return '';
  // The block's own words only: a figure's popover, screen-reader asides and
  // "Check this" buttons sit inside it and are not part of the claim.
  const copy = block.cloneNode(true) as Element;
  copy.querySelectorAll('[popover], .sr-only, .check-this').forEach((n) => n.remove());
  let text = copy.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  // A value in a definition list means nothing without its term.
  if (block.tagName === 'DD') {
    let term = block.previousElementSibling;
    while (term && term.tagName !== 'DT') term = term.previousElementSibling;
    if (term?.textContent) text = `${term.textContent.trim()}: ${text}`;
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
