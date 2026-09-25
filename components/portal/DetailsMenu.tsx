'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Native <details> that closes on outside pointer, Escape and on following a
 * link inside it — same contract as OC/Loki popovers. A client-side navigation
 * does not unmount the shell, so without the last one a menu stayed open over
 * the page it had just opened.
 *
 * It also mirrors its state onto the summary as `aria-expanded` (contract rule
 * 2), which a bare <summary> does not announce in every screen reader.
 */
export function DetailsMenu({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const summary = el.querySelector(':scope > summary');
    const sync = () => summary?.setAttribute('aria-expanded', String(el.open));
    sync();
    function closeIfOutside(event: PointerEvent) {
      if (!el?.open) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      el.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !el?.open) return;
      el.open = false;
    }
    function closeOnLink(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest('a')) el!.open = false;
    }
    el.addEventListener('toggle', sync);
    el.addEventListener('click', closeOnLink);
    document.addEventListener('pointerdown', closeIfOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      el.removeEventListener('toggle', sync);
      el.removeEventListener('click', closeOnLink);
      document.removeEventListener('pointerdown', closeIfOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
