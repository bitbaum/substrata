/**
 * The tidy pass after default deny (default-deny.ts): what is left once
 * sentences have gone, cleaned so nothing points at nothing. Split out on
 * 2026-10-24 when the open-web checks pushed default-deny.ts past 300 lines.
 */
import { GAP_SAYS } from './uncited';

const SETTLE = /\bwould settle\b|\bsource that would\b|\bwould (fill|close) (that|this|the) gap\b/i;
const SPLIT =
  /(?<=(?<!\b(?:Inc|Corp|Ltd|Co|Plc|plc|JSC|LLP|B\.V|N\.V|S\.A|e\.g|i\.e|No|St))[.!?])\s+(?=[A-Z“"*[(])/;

/**
 * What is left once sentences have gone, cleaned so nothing points at nothing:
 * - a "what would settle it" sentence goes when no gap sentence survived to say
 *   what is missing (seen live, Russia: "…would settle it." after its gap went);
 * - a heading, a bold title or a short title-like line goes when nothing but
 *   another heading follows it (Russia: "Rare earths", "USGS Minerals Yearbook
 *   2022, Russia chapter", "Nickel …" over nothing);
 * - a ")" with no "(" goes ("…in the table below).", seen live, Peru).
 */
export function tidy(lines: string[]): string {
  let out = lines.map((l) => {
    if (/^\s*```/.test(l) || /^\s*[{["|]/.test(l)) return l;
    // A pointer left without its sentence ("…(source). See the table below",
    // "Nickel (2022) See the table below", seen live, Russia) points at the
    // table the reader is already under: it goes.
    let line = l.replace(/\s*\bsee the table below\b(?![^.!?]*[.!?]\s*\S)[.!?]?\s*$/i, '');
    // A title with nothing but the pointer after it ("Nickel (2022)") goes with it.
    if (line !== l && line.trim().split(/\s+/).length <= 8 && !/[.!?:]$/.test(line.trim()))
      line = '';
    while ((line.match(/\)/g) ?? []).length > (line.match(/\(/g) ?? []).length)
      line = line.replace(/\)(?=[.!?:]?\s*$)|\)(?![\s\S]*\))/, '');
    // An opening with no close ("*(Note: USGS prints no capacity…", seen live,
    // Mozambique): the "(" goes, and a lone "*" of emphasis that never closes.
    while ((line.match(/\(/g) ?? []).length > (line.match(/\)/g) ?? []).length)
      line = line.replace(/^(\s*(?:[-*•>]\s+)?\**)\(|\((?![\s\S]*\()/, '$1');
    if ((line.replace(/\*\*/g, '').match(/\*/g) ?? []).length % 2)
      line = line.replace(/^(\s*(?:[-•>]\s+)?)\*(?!\*)/, '$1');
    return line;
  });
  if (!GAP_SAYS.test(out.join('\n')))
    out = out
      .map((l) =>
        l
          .split(SPLIT)
          .filter((x) => !SETTLE.test(x))
          .join(' '),
      )
      .filter((l, i) => l.trim() || !lines[i].trim());
  // A gap sentence carries no "(source)" of the model's: there is nothing to source.
  out = out.map((l) => (GAP_SAYS.test(l) ? l.replace(/\s*\(?\[source\]\([^)]*\)\)?/gi, '') : l));
  // A sentence that announces what follows ("…the operator shown in the table
  // below is:", seen live, Zimbabwe) goes when nothing follows it: no list
  // item, no table, no code block.
  out = out.map((l, i) => {
    if (!/:\s*$/.test(l)) return l;
    const next = out.slice(i + 1).find((x) => x.trim()) ?? '';
    if (/^\s*([-*•]|\d+\.)\s|^\s*```|^\s*\|/.test(next)) return l;
    return l.replace(/(^|(?<=[.!?])\s+)[^.!?]*:\s*$/, '').trimEnd();
  });
  const titleLevel = (l: string): number => {
    const md = l.match(/^(#{1,6}) /)?.[1].length;
    if (md) return md;
    const t = l.trim();
    // A code fence, and anything it holds, is never a title; nor is a table row.
    if (/^`{3}/.test(t) || /^[{["|]/.test(t)) return 0;
    if (!t || /\[W\d+\]|\]\(|\d/.test(t.replace(/\b(19|20)\d{2}\b/g, ''))) return 0;
    if (/^\*\*[^*]+\*\*:?$/.test(t)) return 7;
    return t.split(/\s+/).length <= 8 && !/[.!?:;,]$/.test(t) ? 7 : 0;
  };
  // Repeat: dropping one orphan can orphan the title above it.
  for (let changed = true; changed;) {
    changed = false;
    const next = (i: number) => out.slice(i + 1).find((l) => l.trim()) ?? '';
    out = out.filter((l, i) => {
      const level = titleLevel(l);
      if (!level) return true;
      const n = next(i);
      const nLevel = titleLevel(n);
      // Kept over text, or over a deeper heading (its sub-section); dropped over nothing.
      const keep = Boolean(n) && (!nLevel || (nLevel > level && level < 7));
      if (!keep) changed = true;
      return keep;
    });
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
