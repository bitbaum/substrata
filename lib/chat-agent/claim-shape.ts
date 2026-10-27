/**
 * Claim check, the answer's shape: a take on a screenshot or a pasted post.
 *
 * What a reader wants from "what's your take on it??" over a post full of
 * figures: the bottom line first, then each claim with its status and the
 * link that settles it, then the reasoning — labelled as reasoning — and what
 * would change the view. The model is asked for that (`claimInstruction`);
 * code makes sure of what code can:
 * - every claim the reading found gets exactly one status line, in order;
 * - a status other than "Not found" stands only with a citation behind it;
 *   without one the line is rewritten, in code, from the reading itself;
 * - a claim that someone SAID something is "Reported" when the source only
 *   shows they said it, and "Confirmed" only when it establishes the fact
 *   itself: "Confirmed" over "Gartner estimates a $4.9T gap [W2]" told the
 *   reader the gap was real, when the page showed only that Gartner said so;
 * - a figure that comes only from the material, stated anywhere else without
 *   a citation, goes — the post's own words are the reader's material, never
 *   a source, and an unverified claim is never repeated as fact;
 * - "Sources" is built from the [W#] the answer actually cites.
 * Pure.
 */
import { REASONING } from './labels';
import type { Claim, Reading } from './read-claims';
import { numbersIn } from './read-claims';
import type { ResearchPassage } from './research-read';
import { CITED, sectionsOf } from './research-shape';

export const STATUSES = ['Confirmed', 'Reported', 'Partly', 'Contradicted', 'Not found'] as const;
export type ClaimStatus = (typeof STATUSES)[number];

export const CLAIMS_HEADING = 'Claim by claim';
/** Sections whose lines are the answer's own reasoning (default-deny.ts reads it). */
export const CLAIM_REASONING_SECTIONS = /^(reasoning|what would change)/i;
const ORDER = [CLAIMS_HEADING, 'Reasoning', 'What would change the view', 'Sources'];

/** What the writer is told, after the ordinary system prompt. */
export function claimInstruction(
  reading: Reading,
  passages: ResearchPassage[],
  from: string,
): string {
  const claims = reading.claims.map((c) => {
    const cites = passages.filter((p) => p.for === c.id).map((p) => `[W${p.n}]`);
    return `- ${c.id}: ${c.text}${c.who ? ` (attributed to ${c.who})` : ''} — pages: ${cites.length ? cites.join(' ') : 'none found'}`;
  });
  return [
    `## The reader's ${from}, as read (THEIR MATERIAL — quote it as "the ${from} says", never cite it as a source)`,
    reading.text ? `"""\n${reading.text}\n"""` : '(no text could be read)',
    '## The claims in it, and the pages found for each',
    ...claims,
    "## Answer the reader's actual question, in exactly this shape",
    '1. No heading: the bottom line in 2–3 sentences — your take, resting only on what the pages and records above confirm, each figure cited.',
    `### ${CLAIMS_HEADING} — one line per claim, in order, exactly: \`- **C1 · Confirmed** — what the source says, cited [W#]\`. Status is one of ${STATUSES.join(', ')}. Confirmed, Reported, Partly or Contradicted ONLY with a citation to a page or record above that says so; otherwise Not found. For a claim that someone said, warned or estimated something: Reported when the page shows only that they said it (name them: "Gartner estimates…"); Confirmed only when the page establishes the thing itself.`,
    `### Reasoning — what it adds up to, each line opening "${REASONING}", with no figure in it.`,
    '### What would change the view — the evidence that would move it, one line each.',
    'Do not write a Sources section; it is added from your citations.',
    `Rules: a figure or statement that only the ${from} gives is NOT a fact — never repeat it as one; say the ${from} claims it and that no source above confirmed it. Never describe the picture's look; answer about its content. Never say the material is not in a database.`,
  ].join('\n');
}

const LINE =
  /^\s*[-*]\s*\*\*\s*(C\d+)\s*[·:\-–—]\s*(confirmed|reported|partly|contradicted|not found)\s*\*\*\s*[—–:-]?\s*(.*)$/i;

/** The model's status lines, by claim id. */
export function claimLines(section: string): Map<string, { status: ClaimStatus; rest: string }> {
  const out = new Map<string, { status: ClaimStatus; rest: string }>();
  for (const line of section.split('\n')) {
    const m = LINE.exec(line);
    if (!m || out.has(m[1].toUpperCase())) continue;
    const status = STATUSES.find((s) => s.toLowerCase() === m[2].toLowerCase())!;
    out.set(m[1].toUpperCase(), { status, rest: m[3].trim() });
  }
  return out;
}

const cites = (s: string, webCount: number) =>
  [...s.matchAll(/\[W(\d+)\]/g)].some((m) => Number(m[1]) >= 1 && Number(m[1]) <= webCount) ||
  /\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)/.test(s);

/** A source line that only shows who said it: it names the speaker, or reports a saying. */
const REPORTING =
  /\b(said|says|told|wrote|writes|warn(s|ed)?|estimat(es|ed)|predict(s|ed)|claim(s|ed)|stat(es|ed)|according to|quoted|report(s|ed))\b/i;

/**
 * The status a source line earns. An attributed claim's "Confirmed" stays
 * only when the line stands on the fact, not on the speaker: a line that
 * names who said it, or reports a saying, confirms the saying — "Reported".
 */
export function statusFor(claim: Claim, status: ClaimStatus, rest: string): ClaimStatus {
  if (status !== 'Confirmed' || (claim.kind !== 'quote' && !claim.who)) return status;
  const speaker = claim.who && rest.toLowerCase().includes(claim.who.toLowerCase());
  return speaker || REPORTING.test(rest) ? 'Reported' : status;
}

/** One claim's line, as the reader sees it. */
function lineFor(
  claim: Claim,
  model: { status: ClaimStatus; rest: string } | undefined,
  webCount: number,
  from: string,
) {
  if (model && model.status !== 'Not found' && cites(model.rest, webCount))
    return `- **${statusFor(claim, model.status, model.rest)}** — ${model.rest}`;
  const said = claim.who ? `${claim.who}, per the ${from}` : `the ${from}`;
  return `- **Not found** — ${said}: “${claim.text}” No source read for this answer confirms or refutes it.`;
}

/** Sentences that repeat a figure only the material gives, with no citation: they go. */
export function withoutMaterialFigures(text: string, reading: Reading): string {
  // A single digit ("3 claims", "2 pages") is too common to be the material's figure.
  const material = new Set(
    numbersIn(`${reading.text} ${reading.claims.map((c) => c.text).join(' ')}`).filter(
      (n) => n.length > 1,
    ),
  );
  if (!material.size) return text;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(\||```|#)/.test(line)) return line;
      return line
        .split(/(?<=[.!?])\s+/)
        .filter((s) => CITED.test(s) || !numbersIn(s).some((n) => material.has(n)))
        .join(' ');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** The answer in its shape, with every claim accounted for. */
export function shapeClaimAnswer(
  answer: string,
  reading: Reading,
  opts: { webCount: number; from: string },
): string {
  const { lead, sections } = sectionsOf(answer);
  const at = sections.findIndex((s) => /^claim/i.test(s.title));
  const model = claimLines(at >= 0 ? sections[at].body : answer);
  const lines = reading.claims.map((c) => lineFor(c, model.get(c.id), opts.webCount, opts.from));
  const rest = sections
    .filter((s, i) => i !== at && !/^sources?\b/i.test(s.title))
    .map((s) => ({ ...s, body: withoutMaterialFigures(s.body, reading).trim() }))
    .filter((s) => s.body);
  const rank = (t: string) => {
    const i = ORDER.findIndex((o) => t.toLowerCase().startsWith(o.toLowerCase().slice(0, 9)));
    return i < 0 ? 2.5 : i;
  };
  const body = [
    ...(lines.length ? [{ title: CLAIMS_HEADING, body: lines.join('\n') }] : []),
    ...rest,
  ].sort((a, b) => rank(a.title) - rank(b.title));
  const top = withoutMaterialFigures(lead, reading).trim();
  const kept = [top, ...body.map((s) => s.body)].join('\n');
  const cited = [
    ...new Set(
      [...kept.matchAll(/\[W(\d+)\]/g)]
        .map((m) => Number(m[1]))
        .filter((n) => n >= 1 && n <= opts.webCount),
    ),
  ].sort((a, b) => a - b);
  if (cited.length) body.push({ title: 'Sources', body: cited.map((n) => `[W${n}]`).join(' ') });
  const opening =
    top ||
    `I read your ${opts.from}${reading.claims.length ? ` and checked ${reading.claims.length} of its claims` : ''}; here is what the sources say.`;
  return [opening, ...body.map((s) => `### ${s.title}\n\n${s.body}`)].join('\n\n');
}
