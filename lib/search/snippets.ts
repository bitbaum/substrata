/**
 * Highlighting and snippets: which words to mark in the original text, and
 * the window of summary or body shown under a result.
 */
import type { Segment } from '../search-types';
import type { Indexed } from './build';
import { normalize } from './text';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The words to mark, as a regex over the ORIGINAL text. Matching runs on
 * folded words, so a match on "wafer" should also mark "wafers".
 */
export function markPattern(matched: string[]): RegExp | null {
  const unique = [...new Set(matched)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!unique.length) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(${unique.map(escapeRe).join('|')})(?:e?s)?(?![\\p{L}\\p{N}])`,
    'giu',
  );
}

/**
 * The copy of a text the mark pattern runs over. Diacritic-stripping keeps
 * string length for the Latin text this corpus holds, but not always; the
 * normalized copy is used only when offsets still line up with the original.
 */
export function probeOf(text: string): string {
  const probe = normalize(text);
  return probe.length === text.length ? probe : text.toLowerCase();
}

export function segments(text: string, re: RegExp | null, source = probeOf(text)): Segment[] {
  if (!re || !text) return text ? [{ text }] : [];
  const out: Segment[] = [];
  let at = 0;
  re.lastIndex = 0;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push({ text: text.slice(m.index, m.index + m[0].length), hit: true });
    at = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

const SNIPPET = 190;

/** A window of the summary or body around the first marked word. */
export function snippet(d: Indexed, re: RegExp | null, titleMatched: boolean): Segment[] {
  const { doc } = d;
  // When the name already shows why this matched, the plain description is
  // worth more than a passage of body text that happens to repeat the name.
  const candidates: [string, string][] = titleMatched
    ? [[doc.summary, d.probeSummary]]
    : [
        [doc.summary, d.probeSummary],
        [doc.body, d.probeBody],
      ];
  for (const [text, probe] of candidates) {
    if (!re || !text) continue;
    re.lastIndex = 0;
    const m = re.exec(probe);
    if (!m) continue;
    if (text.length <= SNIPPET) return segments(text, re, probe);
    let start = Math.max(0, m.index - 60);
    if (start > 0) {
      const space = text.indexOf(' ', start);
      start = space > -1 && space < m.index ? space + 1 : start;
    }
    let end = Math.min(text.length, start + SNIPPET);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > m.index) end = space;
    }
    const cut = segments(text.slice(start, end), re, probe.slice(start, end));
    if (start > 0) cut.unshift({ text: '…' });
    if (end < text.length) cut.push({ text: '…' });
    return cut;
  }
  const text = doc.summary || doc.body;
  return [
    { text: text.length > SNIPPET ? `${text.slice(0, SNIPPET).replace(/\s+\S*$/, '')}…` : text },
  ];
}
