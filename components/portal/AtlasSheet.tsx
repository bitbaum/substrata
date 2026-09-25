'use client';

/**
 * The atlas' one detail panel. From 1024px it is a panel floating at the
 * right of the canvas; below that it is a bottom sheet with three resting
 * heights — peek (the head only), half and full — moved by the grip (tap or
 * drag) or by focusing anything inside it. A new selection (`openKey`)
 * raises it to half, so tapping a country shows its panel without a second
 * gesture. The shape is CSS (app/styles/atlas.css); this only holds the snap.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];

export function AtlasSheet({
  label,
  head,
  children,
  openKey,
}: {
  label: string;
  head: ReactNode;
  children: ReactNode;
  /** Changes when the reader picks something; the sheet rises to show it. */
  openKey?: string;
}) {
  const bodyId = useId();
  const [snap, setSnap] = useState<Snap>(openKey ? 'half' : 'peek');
  const [lastKey, setLastKey] = useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    setSnap(openKey ? 'half' : 'peek');
  }
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null);
  // The map frames what the sheet leaves visible, so it needs to know the snap.
  useEffect(() => {
    sheet.current?.closest('.atlas')?.setAttribute('data-sheet', snap);
  }, [snap]);

  function settle(dy: number) {
    const el = sheet.current;
    if (!el) return;
    el.style.transform = '';
    el.removeAttribute('data-dragging');
    // A drag of a fifth of the sheet moves one stop; a flick of the grip is a tap.
    const threshold = Math.max(48, el.clientHeight * 0.2);
    const at = ORDER.indexOf(snap);
    if (dy < -threshold) setSnap(ORDER[Math.min(at + (dy < -threshold * 2.5 ? 2 : 1), 2)]);
    else if (dy > threshold) setSnap(ORDER[Math.max(at - (dy > threshold * 2.5 ? 2 : 1), 0)]);
  }

  return (
    <section
      ref={sheet}
      className="atlas-sheet"
      data-snap={snap}
      aria-label={label}
      onFocusCapture={(e) => {
        if (snap === 'peek' && !(e.target as HTMLElement).closest('.atlas-sheet-grip')) {
          setSnap('half');
        }
      }}
    >
      <button
        type="button"
        className="atlas-sheet-grip"
        aria-expanded={snap !== 'peek'}
        aria-controls={bodyId}
        aria-label={snap === 'full' ? 'Collapse the panel' : 'Expand the panel'}
        onClick={() => {
          if (drag.current?.moved) return;
          setSnap(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
        }}
        onPointerDown={(e) => {
          const el = sheet.current;
          if (!el) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, start: el.getBoundingClientRect().top, moved: false };
        }}
        onPointerMove={(e) => {
          const el = sheet.current;
          const d = drag.current;
          if (!el || !d) return;
          const dy = e.clientY - d.y;
          if (Math.abs(dy) < 6 && !d.moved) return;
          d.moved = true;
          el.setAttribute('data-dragging', '');
          const offset = d.start - (el.offsetParent?.getBoundingClientRect().top ?? 0);
          const top = el.offsetParent ? el.offsetParent.clientHeight - el.offsetHeight : 0;
          el.style.transform = `translateY(${Math.max(0, offset - top + dy)}px)`;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d?.moved) settle(e.clientY - d.y);
          // Let the click that follows see `moved`, then forget the gesture.
          window.setTimeout(() => (drag.current = null), 0);
        }}
        onPointerCancel={() => {
          settle(0);
          drag.current = null;
        }}
      >
        <span aria-hidden />
      </button>
      <div className="atlas-sheet-scroll" id={bodyId}>
        <div className="atlas-sheet-head">{head}</div>
        <div className="atlas-sheet-body">{children}</div>
      </div>
    </section>
  );
}
