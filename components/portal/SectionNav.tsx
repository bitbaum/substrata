'use client';

/**
 * "On this page" for long pages: built from the page's own section headings
 * (`[data-section]`, set by <Heading>) and sub-headings (`[data-section-sub]`),
 * never from a hand-kept list — a jump nav that indexed 4 of 8 sections taught
 * readers the other 4 did not exist (Loki, 2026-09). The section in view is
 * marked. A vertical rail beside the content on wide screens, a sticky strip
 * under the top bar on narrow ones (app/styles/section-nav.css).
 */
import { useEffect, useRef, useState } from 'react';

interface Entry {
  id: string;
  label: string;
  sub: boolean;
}

/** Fewer than this and the page is short enough to scroll; no nav. */
const MIN_SECTIONS = 2;

export function SectionNav() {
  const ref = useRef<HTMLElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const scope = ref.current?.closest('.section-nav-scope');
    if (!scope) return;
    const nodes = [
      ...scope.querySelectorAll<HTMLElement>('[data-section],[data-section-sub]'),
    ].filter((n) => n.id);
    setEntries(
      nodes.map((n) => ({
        id: n.id,
        label: n.dataset.section ?? n.dataset.sectionSub ?? n.id,
        sub: n.dataset.section === undefined,
      })),
    );
    // The last heading above the top third of the screen is the one being read.
    const pick = () => {
      const line = window.innerHeight / 3;
      let at: string | null = nodes[0]?.id ?? null;
      for (const n of nodes) if (n.getBoundingClientRect().top <= line) at = n.id;
      // A short last section never reaches the line: at the bottom, it is the one.
      const page = document.scrollingElement;
      if (page && page.scrollTop + window.innerHeight >= page.scrollHeight - 4)
        at = nodes.at(-1)?.id ?? at;
      setCurrent(at);
    };
    pick();
    window.addEventListener('scroll', pick, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', pick, { capture: true });
  }, []);

  // Keep the marked entry visible in the phone strip as the reader scrolls.
  useEffect(() => {
    if (!current) return;
    ref.current
      ?.querySelector(`[data-target="${CSS.escape(current)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const tops = entries.filter((e) => !e.sub).length;
  // The section holding the current sub-heading: what the phone strip marks,
  // since it shows sections only.
  const at = entries.findIndex((e) => e.id === current);
  const within = entries.slice(0, at + 1).findLast((e) => !e.sub)?.id;
  return (
    <nav ref={ref} aria-label="On this page" className="section-nav" hidden={tops < MIN_SECTIONS}>
      <p className="section-nav-title">On this page</p>
      <ol>
        {entries.map((e) => (
          <li key={e.id} className={e.sub ? 'is-sub' : undefined}>
            <a
              href={`#${e.id}`}
              data-target={e.id}
              aria-current={current === e.id ? 'location' : undefined}
              data-within={!e.sub && within === e.id && current !== e.id ? '' : undefined}
            >
              {e.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
