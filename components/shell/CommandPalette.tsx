'use client';

/**
 * ⌘K: jump to any page, bottleneck, company, country or note.
 *
 * The shape is Loki's palette (components/shell/CommandPalette.tsx there):
 * one input, one list, ↑↓ to move, Enter to open, Esc or a click outside to
 * close. Pages match instantly from `palette.ts`; the research answers from
 * /api/search, the same index behind /search, and the last row always opens
 * the full results page for the query.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SEARCH_TYPE_LABEL, type SearchResult } from '@/lib/search-types';
import { Highlight } from '@/components/portal/Highlight';
import { SearchIcon } from '@/components/portal/Mark';
import { searchHref } from '@/components/portal/search/shared';
import { filterEntries, type PaletteEntry } from './palette';
import { useDialog } from './use-dialog';

const DEBOUNCE_MS = 120;
const PAGE_LIMIT = 6;
/** The index's strongest groups; the last row opens every one of them. */
const GROUP_LIMIT = 6;

interface Row {
  key: string;
  href: string;
  group: string;
  title: React.ReactNode;
  sub: React.ReactNode;
}

function pageRow(e: PaletteEntry): Row {
  return { key: e.key, href: e.href, group: e.group, title: e.label, sub: e.hint };
}

function useSearch(query: string): SearchResult | null {
  const cache = useRef(new Map<string, SearchResult>());
  const [latest, setLatest] = useState<SearchResult | null>(null);
  useEffect(() => {
    if (query.length < 2) return;
    const hit = cache.current.get(query);
    const controller = new AbortController();
    const t = setTimeout(
      () => {
        if (hit) return setLatest(hit);
        fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
          .then((r) => (r.ok ? (r.json() as Promise<SearchResult>) : null))
          .then((data) => {
            if (!data) return;
            cache.current.set(query, data);
            setLatest(data);
          })
          .catch(() => {});
      },
      hit ? 0 : DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);
  return query.length >= 2 && latest?.query === query ? latest : null;
}

export function CommandPalette({
  entries,
  onClose,
}: {
  entries: readonly PaletteEntry[];
  onClose: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const query = q.trim();
  const result = useSearch(query);
  useDialog(panel, onClose, input);

  const rows = useMemo<Row[]>(() => {
    const pages = filterEntries(entries, query);
    if (!query) return pages.map(pageRow);
    const research =
      result?.groups.slice(0, GROUP_LIMIT).flatMap((g) =>
        g.hits.map((hit) => ({
          key: hit.id,
          href: hit.href,
          group: SEARCH_TYPE_LABEL[g.type].one,
          title: <Highlight segments={hit.title} />,
          sub: <Highlight segments={hit.snippet} />,
        })),
      ) ?? [];
    const all: Row = {
      key: '__all',
      href: searchHref(query),
      group: 'Search',
      title: result ? `All ${result.total} results for “${query}”` : `Search for “${query}”`,
      sub: 'Every bottleneck, company, country, policy, note and event.',
    };
    return [...pages.slice(0, PAGE_LIMIT).map(pageRow), ...research, all];
  }, [entries, query, result]);

  const current = Math.min(active, rows.length - 1);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(rows.length - 1, current + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, current - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[current];
      if (row) go(row.href);
    }
  };

  useEffect(() => {
    document.getElementById(`${id}-${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, current]);

  return (
    <div className="shell-overlay shell-palette-wrap">
      <div className="shell-backdrop" aria-hidden onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search and jump"
        className="shell-palette"
      >
        <div className="shell-palette-input">
          <SearchIcon className="h-5 w-5 shrink-0 text-fg-tertiary" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={rows.length ? `${id}-${current}` : undefined}
            aria-label="Search pages and research"
            placeholder="Jump to a page, or search ASML, EUV, quartz"
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="shell-palette-close" onClick={onClose}>
            Esc
          </button>
        </div>
        <ul id={`${id}-list`} role="listbox" className="shell-palette-list">
          {rows.map((row, i) => (
            <li
              key={row.key}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === current}
              className="shell-palette-row"
              onMouseMove={() => setActive(i)}
              onClick={() => go(row.href)}
            >
              <span className="shell-palette-row-title">{row.title}</span>
              <span className="shell-palette-row-group">{row.group}</span>
              <span className="shell-palette-row-sub">{row.sub}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
