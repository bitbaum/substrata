'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useViewportHeight } from '@bitbaum/chatkit/react';

/** Past this, a drag on the grip lets go of the sheet. */
const DISMISS_PX = 96;

/**
 * The frame a chat opened over a page sits in — the fleet's shape for it
 * (Loki's per-session rail on a phone, `presentation="sheet"`): on a phone a
 * sheet from the bottom edge, 92% of the visual viewport, with a grip to
 * pull it down; from 768px a panel on the right, full height. One title row
 * in both: the name · Expand · Close. The conversation inside is chatkit's
 * `ChatScreen`, which owns the scrolling and keeps the composer above the
 * keyboard; this owns only the edges.
 *
 * The height follows the VISUAL viewport (`useViewportHeight`), so when the
 * keyboard opens the sheet shrinks to the room above it, and the composer
 * — pinned to the sheet's foot by ChatScreen — rides on top of the keys.
 *
 * It stays mounted while closed (hidden), so a thread survives Close and a
 * second tap on Ask finds it where it was.
 */
export function AskPanel({
  open,
  title,
  onClose,
  onExpand,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Open the whole thread on /chat. */
  onExpand: () => void;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  useViewportHeight(sheetRef, open);
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef(0);

  // Escape closes; the page under a phone sheet does not scroll behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('ask-sheet-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('ask-sheet-open');
    };
  }, [open, onClose]);

  return (
    <div className="ask-sheet-root" hidden={!open}>
      <div className="ask-sheet-scrim" aria-hidden onClick={onClose} />
      <section
        ref={sheetRef}
        className="ask-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        {/* A pointer affordance only: Close and Escape are the keyboard's way out. */}
        <div
          className="ask-sheet-grip"
          aria-hidden
          onPointerDown={(e) => {
            dragStart.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(0);
          }}
          onPointerMove={(e) => {
            if (drag === null) return;
            setDrag(Math.max(0, e.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            const moved = drag ?? 0;
            setDrag(null);
            // A pull past the threshold lets go; a tap (no pull) closes too.
            if (moved > DISMISS_PX || moved < 4) onClose();
          }}
          onPointerCancel={() => setDrag(null)}
        />
        <header className="ask-sheet-head">
          <h2>{title}</h2>
          <div className="ask-sheet-actions">
            <button type="button" onClick={onExpand}>
              Expand
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div className="ask-sheet-body">{children}</div>
      </section>
    </div>
  );
}
