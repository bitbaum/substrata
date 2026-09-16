'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Native <details> that closes on outside pointer and Escape — same contract as OC/Loki popovers. */
export function DetailsMenu({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeIfOutside(event: PointerEvent) {
      const el = ref.current;
      if (!el?.open) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      el.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      const el = ref.current;
      if (event.key !== 'Escape' || !el?.open) return;
      el.open = false;
    }
    document.addEventListener('pointerdown', closeIfOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
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
