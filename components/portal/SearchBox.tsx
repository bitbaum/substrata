'use client';

/**
 * The search box, in two shapes from one component.
 *
 * `popover` (the header): results drop down as you type — grouped by type,
 * matched words marked — with ↑↓ to move, Enter to open, Esc to close, and
 * Enter on nothing selected (or the last row) going to the full results page.
 *
 * `page` (/search): the box drives the page itself. Typing replaces the URL
 * after a short pause, so the server-rendered results update in place and the
 * address stays shareable; ↓ moves into the results list.
 *
 * Either way "/" focuses the box from anywhere that is not a text field. Only
 * one box is mounted per page: the header hides itself on /search.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { SEARCH_TYPE_LABEL, type SearchHit, type SearchResult } from '@/lib/search-types';
import { Highlight } from './Highlight';
import { SearchIcon } from './Mark';

const DEBOUNCE_MS = 120;
const PAGE_DEBOUNCE_MS = 250;

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable === true
  );
}

function searchHref(q: string, type?: string): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (type) params.set('type', type);
  const s = params.toString();
  return s ? `/search?${s}` : '/search';
}

/** "/" from anywhere that is not already a text field. */
function useSlashFocus(input: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(document.activeElement)) return;
      const el = input.current;
      if (!el || el.offsetParent === null) return;
      e.preventDefault();
      el.focus();
      el.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input]);
}

export function SearchBox({
  mode = 'popover',
  initialQuery = '',
  type = '',
}: {
  mode?: 'popover' | 'page';
  initialQuery?: string;
  /** Page mode: the active type filter, kept when the query changes. */
  type?: string;
}) {
  const path = usePathname();
  if (mode === 'popover' && path === '/search') return null;
  return mode === 'page' ? (
    <PageSearch initialQuery={initialQuery} type={type} />
  ) : (
    <PopoverSearch />
  );
}

function PageSearch({ initialQuery, type }: { initialQuery: string; type: string }) {
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
        placeholder="Companies, materials, countries, events, terms…"
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

interface Row {
  key: string;
  href: string;
  hit?: SearchHit;
}

function PopoverSearch() {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, SearchResult>());
  const [q, setQ] = useState('');
  // The last answer received, for whatever query. While the next one is in
  // flight the panel keeps showing it rather than flashing empty.
  const [latest, setLatest] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useSlashFocus(input);
  const query = q.trim();
  const result = query.length >= 2 ? latest : null;
  const loading = query.length >= 2 && latest?.query !== query;

  const onChange = (value: string) => {
    setQ(value);
    setOpen(true);
    setActive(-1);
    const cached = cache.current.get(value.trim());
    if (cached) setLatest(cached);
  };

  useEffect(() => {
    if (query.length < 2 || cache.current.has(query)) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => (r.ok ? (r.json() as Promise<SearchResult>) : null))
        .then((data) => {
          if (!data) return;
          cache.current.set(query, data);
          setLatest(data);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const all = searchHref(q);
  const rows: Row[] = [
    ...(result?.groups
      .slice(0, 4)
      .flatMap((g) => g.hits.map((hit) => ({ key: hit.id, href: hit.href, hit }))) ?? []),
    { key: '__all', href: all },
  ];
  const showPanel = open && q.trim().length >= 2 && (result !== null || loading);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      input.current?.blur();
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!q.trim()) return;
      go(active >= 0 ? rows[active].href : all);
    } else if (e.key === 'Escape') {
      if (open) setOpen(false);
      else onChange('');
    }
  };

  const optionId = (i: number) => `${id}-opt-${i}`;
  let index = -1;

  return (
    <div ref={box} className="search-pop hidden lg:block">
      <form
        action="/search"
        role="search"
        className="site-search flex"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(all);
        }}
      >
        <label className="sr-only" htmlFor="header-search">
          Search the research
        </label>
        <input
          ref={input}
          id="header-search"
          name="q"
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search  ASML, EUV, quartz"
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="search-kbd" aria-hidden>
          /
        </kbd>
      </form>
      {showPanel && (
        <div className="search-panel" id={`${id}-list`} role="listbox" aria-label="Search results">
          {result?.corrected && (
            <p className="search-panel-note">
              Showing results for <strong>{result.corrected}</strong>
            </p>
          )}
          {result && result.total === 0 && !loading && (
            <p className="search-panel-note">Nothing matches “{q.trim()}”.</p>
          )}
          {result?.groups.slice(0, 4).map((group) => (
            <div key={group.type} role="group" aria-label={SEARCH_TYPE_LABEL[group.type].many}>
              <p className="search-panel-head">
                <span>{SEARCH_TYPE_LABEL[group.type].many}</span>
                <span>{group.count}</span>
              </p>
              {group.hits.map((hit) => {
                index++;
                const i = index;
                return (
                  <a
                    key={hit.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={active === i}
                    href={hit.href}
                    className="search-option"
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      e.preventDefault();
                      go(hit.href);
                    }}
                  >
                    <span className="search-option-title">
                      <Highlight segments={hit.title} />
                    </span>
                    <span className="search-option-snippet">
                      <Highlight segments={hit.snippet} />
                    </span>
                  </a>
                );
              })}
            </div>
          ))}
          <a
            id={optionId(rows.length - 1)}
            role="option"
            aria-selected={active === rows.length - 1}
            href={all}
            className="search-option search-option-all"
            onMouseEnter={() => setActive(rows.length - 1)}
            onClick={(e) => {
              e.preventDefault();
              go(all);
            }}
          >
            {loading
              ? `All results for “${query}”`
              : `All ${result?.total ?? 0} results for “${query}”`}
            <span aria-hidden>↵</span>
          </a>
        </div>
      )}
    </div>
  );
}
