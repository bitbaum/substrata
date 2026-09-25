/**
 * What the shell remembers per browser: whether the sidebar is a rail, and
 * which sections the reader opened.
 *
 * Contract rule 5: `null` (never chosen) and an empty choice are different
 * answers. `readSections()` returns null when the reader has never toggled a
 * section, so the default (only the current page's section open) applies; an
 * empty array means they closed every section on purpose, and that sticks.
 *
 * The rail flag is also read by the boot script in app/layout.tsx before
 * paint, as `data-rail` on <html>, so a collapsed sidebar never flashes open.
 */

export const RAIL_KEY = 'substrata-rail';
export const SECTIONS_KEY = 'substrata-nav-sections';

/** Inline, before paint: `<html data-rail="collapsed">` when the reader chose the rail. */
export const RAIL_BOOT = `try{if(localStorage.getItem('${RAIL_KEY}')==='collapsed')document.documentElement.dataset.rail='collapsed';}catch(e){}`;

export function readSections(): string[] | null {
  try {
    const raw = window.localStorage.getItem(SECTIONS_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : null;
  } catch {
    return null;
  }
}

export function writeSections(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(SECTIONS_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

export function railCollapsed(): boolean {
  return document.documentElement.dataset.rail === 'collapsed';
}

export function setRailCollapsed(collapsed: boolean): void {
  if (collapsed) document.documentElement.dataset.rail = 'collapsed';
  else delete document.documentElement.dataset.rail;
  try {
    window.localStorage.setItem(RAIL_KEY, collapsed ? 'collapsed' : 'open');
  } catch {
    // As above.
  }
}
