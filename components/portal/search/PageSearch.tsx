'use client';

/**
 * `page` (/search): the box drives the page itself. Typing replaces the URL
 * after a short pause, so the server-rendered results update in place and the
 * address stays shareable; ↓ moves into the results list.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SearchIcon } from '../Mark';
import { searchHref, useSlashFocus } from './shared';

const PAGE_DEBOUNCE_MS = 250;

export function PageSearch({ initialQuery, type }: { initialQuery: string; type: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQuery);
  // What the URL last said. A link that changes the query (an example chip,
  // the back button) must reach the box; the box's own replace must not echo.
  const [fromUrl, setFromUrl] = useState(initialQuery);
  const last = useRef(initialQuery);
  if (initialQuery !== fromUrl) {
    setFromUrl(initialQuery);
    if (initialQuery.trim() !== q.trim()) setQ(initialQuery);
  }
  useSlashFocus(input);

  useEffect(() => {
    if (q.trim() === last.current.trim() || q.trim() === initialQuery.trim()) return;
    const t = setTimeout(() => {
      last.current = q;
      router.replace(searchHref(q, type), { scroll: false });
    }, PAGE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, type, router, initialQuery]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      const first = document.querySelector<HTMLElement>('[data-search-result]');
      if (first) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === 'Escape' && q) {
      setQ('');
    }
  };

  // ↑↓ between results once focus is in the list; ↑ from the first returns to the box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active?.hasAttribute('data-search-result')) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const all = [...document.querySelectorAll<HTMLElement>('[data-search-result]')];
      const at = all.indexOf(active);
      e.preventDefault();
      if (e.key === 'ArrowDown') all[Math.min(at + 1, all.length - 1)]?.focus();
      else if (at <= 0) input.current?.focus();
      else all[at - 1].focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      action="/search"
      role="search"
      className="search-page-form"
      onSubmit={(e) => {
        e.preventDefault();
        last.current = q;
        router.replace(searchHref(q, type), { scroll: false });
      }}
    >
      <SearchIcon className="search-page-icon" />
      <label className="sr-only" htmlFor="research-query">
        Search the research
      </label>
      <input
        ref={input}
        id="research-query"
        name="q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="ASML, quartz, gallium, Japan…"
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
        autoFocus={!initialQuery}
      />
      {type && <input type="hidden" name="type" value={type} />}
      <kbd className="search-kbd" aria-hidden>
        /
      </kbd>
    </form>
  );
}
