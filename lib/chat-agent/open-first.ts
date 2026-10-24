/**
 * The answer comes first; what the corpus lacks comes last, once.
 *
 * Seen live on 2026-10-24, asked what Kazatomprom said about its 2026
 * production guidance: "The Substrata corpus does not track Kazatomprom's
 * forward-looking volumetric guidance…" — the first thing the reader read
 * was an apology from a database, and the web passages sat underneath under
 * an "Unchecked web results" heading. The prompt now forbids both; this is
 * the code half, after every revision, so no model can undo it:
 * - an opening made of corpus-gap sentences moves to the end of the answer;
 * - a heading that fences the web off from the answer ("Unchecked web
 *   results", "Looked outside the corpus") goes; what stood under it stays,
 *   cited [W#] claim by claim.
 */

/** A sentence that says the corpus (not the world) lacks something. */
export const CORPUS_GAP =
  /\b(corpus|substrata|our (data(base)?|records|sources)|the database|(the|our) (data|records) (provided|available))\b[^.!?]*\b(does not|doesn't|do not|don't|did not|is not|isn't|are not|aren't|cannot|not)\b[^.!?]*\b(track|record|hold|contain|cover|include|list|have|in|available|captured|tracked|recorded)\b|\b(not|isn't|is not|are not) (tracked|recorded|covered|held) (in|by) (the |our )?(substrata|corpus|database|records)\b|\bmissing link in the corpus\b/i;

const WEB_GHETTO =
  /^\s*(#{1,6}\s+|\*\*)?(unchecked web (results|leads|pages|sources)|web (results|leads)( \(unchecked\))?|looked outside the corpus|outside the corpus|from the open web \(unchecked\))\s*(\*\*)?:?\s*$/i;

const SPLIT = /(?<=[.!?])\s+(?=[A-Z“"*[(])/;

/** Whether an answer opens with what the corpus lacks. */
export function opensWithCorpusGap(answer: string): boolean {
  const first = answer
    .split('\n')
    .map((l) => l.replace(/^\s*(#{1,6}\s+|[-*•>]\s+)/, '').trim())
    .find(Boolean);
  return Boolean(first && CORPUS_GAP.test(first.split(SPLIT)[0] ?? ''));
}

/** The answer first, a corpus gap at the end, and no heading fencing the web off. */
export function answerFirst(answer: string): string {
  let lines = answer.split('\n').filter((l) => !WEB_GHETTO.test(l));
  const moved: string[] = [];
  for (let guard = 0; guard < 6 && opensWithCorpusGap(lines.join('\n')); guard++) {
    const i = lines.findIndex((l) => l.trim());
    const line = lines[i];
    const lead = line.match(/^\s*(?:[-*•>]\s+)?/)?.[0] ?? '';
    const body = line.slice(lead.length);
    if (/^#{1,6}\s/.test(body)) {
      lines.splice(i, 1);
      continue;
    }
    const parts = body.split(SPLIT);
    let k = 0;
    while (k < parts.length && CORPUS_GAP.test(parts[k])) k++;
    moved.push(...parts.slice(0, k));
    const rest = parts.slice(k).join(' ').trim();
    if (rest) lines[i] = `${lead}${rest}`;
    else lines.splice(i, 1);
  }
  lines = lines.filter((l, i, all) => l.trim() || all[i - 1]?.trim());
  const body = lines.join('\n').trim();
  // Said again further down (a "What is missing" line): once is enough.
  moved.splice(0, moved.length, ...moved.filter((m) => !body.includes(m.replace(/[.!?]$/, ''))));
  if (!moved.length) return body;
  if (!body) return moved.join(' ');
  return `${body}\n\n${moved.join(' ')}`;
}
