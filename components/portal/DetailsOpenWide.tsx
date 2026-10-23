'use client';

/**
 * A <details> that is closed on a phone and, when asked, open on a wide
 * screen. The server renders it closed for everyone — the same HTML in both
 * cases, so nothing mismatches on hydration — and a wide screen opens it
 * once the page is interactive. On a phone every row stays folded, so a
 * list of thirty countries is thirty lines, not a wall.
 */
import { useEffect, useRef, type ReactNode } from 'react';

const WIDE = '(min-width: 768px)';

export function DetailsOpenWide({
  openWide = false,
  id,
  className,
  summary,
  children,
}: {
  openWide?: boolean;
  id?: string;
  className?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (openWide && window.matchMedia(WIDE).matches && ref.current) ref.current.open = true;
  }, [openWide]);
  return (
    <details ref={ref} id={id} className={className}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
