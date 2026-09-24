'use client';

import { claimAround, requestCheck } from '@/lib/ask-bridge';

/**
 * One click from a claim to a verdict on it: opens Ask with the exact claim,
 * its source and the page, and Ask reads the source and searches the web
 * before answering Supported / Contradicted / Outdated / Unverifiable.
 *
 * `claim` may be omitted: the text of the block the button sits in is used,
 * which is the sentence a number appears in. Without JavaScript the button
 * does nothing and costs nothing.
 */
export function CheckThis({
  claim,
  value,
  source,
  label = 'Check this',
  className,
}: {
  claim?: string;
  value?: string;
  source?: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={['check-this', className].filter(Boolean).join(' ')}
      title="Ask checks this against its source and the web"
      onClick={(e) => {
        const target = e.currentTarget;
        // In a figure's popover the button is not inside the sentence; the
        // popover's anchor (the figure) is. Look there first.
        const anchor = target.closest('[data-check-anchor]')?.previousElementSibling ?? target;
        const text = claim ?? claimAround(anchor);
        target.closest<HTMLElement>('[popover]')?.hidePopover?.();
        requestCheck({ claim: text || value || '', value, source });
      }}
    >
      {label}
    </button>
  );
}
