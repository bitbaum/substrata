/**
 * Default deny: when an answer had tool results, a sentence reaches the reader
 * only if it is cited or is one of a few kinds an honest answer is built from.
 * Everything else is dropped in code.
 *
 * Why the invariant changed (2026-10-24): every guard before this one blocked
 * a known bad pattern, and every live answer found the next one. Chile, after
 * all of them: "Outside the corpus — Many Chilean brine producers have
 * long-term supply agreements with various battery manufacturers and trading
 * companies; however, these specific buyer relationships are not tracked" — a
 * made-up buyers claim that passed because it ended in an honest clause. So
 * the question is no longer "is this sentence a known lie" but "what stands
 * behind it".
 *
 * A sentence survives when it is:
 * - CITED: a markdown link (a corpus page or a primary source), a [F#]/[R#]
 *   marker, or a [W#] for a page the lookups read whose passage prints every
 *   figure the sentence gives (web-figures.ts) — said as the page's
 *   (uncited.ts rewords a bare one) or a lead's title line; or it sits in a
 *   section whose "Source: …" / "All of the above: …" line carries a link;
 * - a FIGURE SAID WITH ITS SOURCE: it names its source ("according to the
 *   World Nuclear Association", "as printed in the USGS Minerals Yearbook",
 *   "(Sourced)") and every figure in it is in the lookups' rows;
 * - the computed SUMMARY, a GAP sentence for a link the QUESTION asked about,
 *   a WHAT-WOULD-SETTLE-IT sentence for one, the CAPACITY caveat, the
 *   web-LEAD heading or intro, an EVIDENCE invitation;
 * - BACKGROUND the answer marks as general knowledge (labels.ts), with no
 *   figure and no buyer, supplier, owner or financier link in it;
 * - a TRANSITION with no content of its own: a heading-like line, or a
 *   pointer to the table below, with no figure, no name and no claim word.
 *
 * A sentence that mixes kinds is split at its clause boundary (";", ",
 * however", ", but") and only the parts that survive on their own are kept.
 */
import { numbersIn } from './grounding';
import { ASKS, LADDER_BOXES, type LadderBox } from './ladder';
import { BOX_WORDS, GAP_SAYS } from './uncited';
import { tidy } from './default-deny-tidy';
import { BACKGROUND_LABEL } from './labels';
import { unbackedWebFigures } from './web-figures';

export interface DenyContext {
  /** The question: a gap is said only for a link it asked about. */
  question: string;
  summary: string[];
  /** The highest [W#] the lookups fetched. */
  webCount: number;
  /** Every tool result's text, to find a figure in. */
  evidence: string;
  /** Each read web page's passage by its [W#] number (web-figures.ts): a cited figure must be in it. */
  web?: Map<number, string>;
  /**
   * Headings of sections whose lines are the answer's own reasoning (research
   * mode: "What would change this", "Confidence and gaps"): each line is held
   * to the labelled-background rule — no figure, no link claim — never let through.
   */
  reasoningSections?: RegExp;
}

export type Kind =
  | 'cited'
  | 'figure with its source'
  | 'summary'
  | 'gap'
  | 'what would settle it'
  | 'capacity caveat'
  | 'lead heading'
  | 'evidence invitation'
  | 'background'
  | 'transition';

/** Words that make a sentence a claim about the world, whatever else it is. */
const CLAIMY =
  /\b(many|most|typically|usually|generally|often|mostly|largest|biggest|major|leading|dominant|main|top|world'?s|globally|owns?|owned|sells?|sold|buys?|bought|suppl(y|ies|ied)|exports?|imports?|produces?|produced|mines?|mined|controls?|holds?|accounts? for|ranks?|ranking|dominates?|depends?|relies?|contracts?|agreements?|customers?|buyers?|investors?|purchasers?)\b/i;

/** Background may explain; it never names who sells to, buys from, owns or finances whom. */
const LINKS_CLAIM =
  /\b(sells?|sold|buys?|bought|suppl(y|ies|ied|iers?)|customers?|buyers?|offtake|owns?|owned|owners?|stakes?|shareholders?|financ\w*|investors?|lenders?|contracts?|agreements?)\b/i;
const LINK = /\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)|\[(F|R)\d+\]/;
const SOURCE_NAMED =
  /\b(according to|as printed in|as reported (by|in)|reports?|reported|printed|usgs|minerals yearbook|world nuclear association|wna|energy institute|eia|iea|oecd)\b|\(sourced\)/i;
const SETTLE = /\bwould settle\b|\bsource that would\b|\bwould (fill|close) (that|this|the) gap\b/i;
const CAVEAT =
  /\bcapacit(y|ies)( figures?)? (is|are|represents?|reflects?)\b[^.]*\bnot\b[^.]*\b(production|output)\b|\bcapacity is capacity\b|\bfigures are (in|given in) (metric )?(tons|tonnes)\b/i;
const LEADS =
  /\b(unchecked|unreviewed|not (part of|verified)|have not been (verified|checked)|open[- ]web)\b/i;
const INVITE =
  /\b(send (us )?evidence|submit evidence|you can (send|submit|provide)|if you have)\b/i;
const POINTER =
  /\b(the table below|in the table|see (the )?table|listed below|below|the following|(these|the) rows)\b/i;

const YEAR = /^(19|20)\d{2}$/;

const TABLE_TALK = /\b(rows?|printed|owners?|shares?|stakes?|capacit(y|ies)|operators?)\b/i;

/** Common words a sentence opens with: never a name. */
const STARTERS =
  /^(?:\*\*)?(a|an|the|this|these|that|those|it|here|there|in|for|to|as|we|you|your|our|below|above|see|note|what|which|who|how|why|when|where|if|each|some|no|so|and|also|both|one|answer|short answer)\b/i;

/** The figures of a sentence that are not years or small counts. */
function figures(s: string): string[] {
  return [...numbersIn(s)].filter((n) => !YEAR.test(n) && !(Number(n) < 20 && !n.includes('.')));
}

/** Boxes a sentence talks about. */
const boxesIn = (s: string): LadderBox[] => LADDER_BOXES.filter((b) => BOX_WORDS[b].test(s));

function wCited(s: string, webCount: number): boolean {
  const leads = [...s.matchAll(/\[W(\d+)\]/g)].map((m) => Number(m[1]));
  return leads.length > 0 && leads.every((n) => n >= 1 && n <= webCount);
}

/** What kind of sentence this is, or null when nothing stands behind it. */
export function kindOf(
  sentence: string,
  ctx: DenyContext,
  asked: LadderBox[],
  sectionCited = false,
  /** The line opens with the general-knowledge label (labels.ts). */
  background = false,
): Kind | null {
  const s = sentence.trim();
  if (!s) return 'transition';
  if (ctx.summary.some((x) => s.includes(x) || (s.length > 20 && x.includes(s)))) return 'summary';
  // A web page cited for a figure it does not print cites nothing (web-figures.ts).
  if (wCited(s, ctx.webCount))
    return ctx.web && unbackedWebFigures(s, ctx.web).length ? null : 'cited';
  if (LINK.test(s) || sectionCited) return 'cited';
  const boxes = boxesIn(s);
  const unasked = boxes.some((b) => !asked.includes(b));
  // A gap is said only for a link the question asked about (the Russia answer
  // appended a buyers gap to a question that never mentioned buyers).
  if (GAP_SAYS.test(s)) return boxes.length && unasked ? null : 'gap';
  if (SETTLE.test(s)) return unasked ? null : 'what would settle it';
  if (CAVEAT.test(s)) return 'capacity caveat';
  if (INVITE.test(s)) return 'evidence invitation';
  // Marked background: kept with no figure and no supplier, buyer or owner link in it.
  if (background || BACKGROUND_LABEL.test(s))
    return figures(s).length || LINKS_CLAIM.test(s) ? null : 'background';
  const nums = figures(s);
  if (LEADS.test(s) && !nums.length) return 'lead heading';
  if (nums.length && SOURCE_NAMED.test(s)) {
    const known = numbersIn(ctx.evidence);
    if (nums.every((n) => known.has(n))) return 'figure with its source';
    return null;
  }
  if (nums.length || CLAIMY.test(s)) return null;
  const words = s.split(/\s+/).length;
  const headingLike = words <= 10 && !/[.!?]$/.test(s.replace(/[*_]+$/, ''));
  // A capital inside the sentence is a name (an entity, a place): a transition has none.
  const names = (s.match(/(?<=\s)\p{Lu}\p{Ll}+/gu) ?? []).length;
  // A pointer to the table may name the table's source ("…as printed in the USGS Minerals Yearbook").
  if (headingLike || (POINTER.test(s) && (!names || SOURCE_NAMED.test(s)))) return 'transition';
  // A sentence with no figure, no name and no claim word says nothing about the
  // world ("Here is what the sources hold."): it opens with a common word, not a name.
  // …but one that talks about the table's rows, owners or shares is a claim
  // about the table, and only the computed summary may make it ("No owner is
  // printed for the other three rows", seen live, Russia).
  if (!names && STARTERS.test(s) && !TABLE_TALK.test(s)) return 'transition';
  return null;
}

const CLAUSE = /;\s+|,\s+(?=(however|but)\b)|\s+[—–-]\s+(?=(however|but)\b)/i;

/** The parts of a sentence that survive on their own, rejoined; '' when none do. */
function surviving(
  s: string,
  ctx: DenyContext,
  asked: LadderBox[],
  sectionCited: boolean,
  bg = false,
): string {
  const whole = kindOf(s, ctx, asked, sectionCited, bg);
  const clauses = s.split(CLAUSE).filter((c) => c && !/^(however|but)$/i.test(c));
  if (whole === 'cited' || whole === 'summary' || (whole && clauses.length < 2)) return s;
  if (clauses.length < 2) return '';
  const kept = clauses
    .map((c) => c.replace(/^(however|but),?\s+/i, '').trim())
    .filter((c) => kindOf(c, ctx, asked, sectionCited, bg));
  if (!kept.length) return '';
  // Every clause stands on its own: the sentence stands as written.
  if (kept.length === clauses.length) return s;
  const joined = kept.join('; ');
  const cap = joined.charAt(0).toUpperCase() + joined.slice(1);
  return /[.!?:]$/.test(cap) ? cap : `${cap}.`;
}

const SPLIT =
  /(?<=(?<!\b(?:Inc|Corp|Ltd|Co|Plc|plc|JSC|LLP|B\.V|N\.V|S\.A|e\.g|i\.e|No|St))[.!?])\s+(?=[A-Z“"*[(])/;
const SECTION_SOURCE =
  /^\s*(?:[-*•]\s*)?(?:\*\*)?(sources?|all of the above)\b[^\n]*\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)/im;

/** The answer with every sentence that nothing stands behind dropped, and what went. */
export function defaultDeny(
  answer: string,
  ctx: DenyContext,
): { answer: string; dropped: string[] } {
  const asked = LADDER_BOXES.filter((b) => ASKS[b].test(ctx.question));
  const dropped: string[] = [];
  const out: string[] = [];
  // Sections run from heading to heading; a "Source: [link]" line cites its section.
  const sections = answer.split(/\n(?=#{1,6} )/);
  for (const section of sections) {
    const sectionCited = SECTION_SOURCE.test(section);
    const heading = section.match(/^\s*#{1,6} (.+)/)?.[1] ?? '';
    const reasoning = Boolean(heading && ctx.reasoningSections?.test(heading));
    let fence = false;
    let carrying: boolean = false;
    for (const raw of section.split('\n')) {
      if (/^\s*```/.test(raw)) fence = !fence;
      if (fence || /^\s*```/.test(raw) || /^\s*#{1,6} /.test(raw) || !raw.trim()) {
        out.push(raw);
        continue;
      }
      const lead = raw.match(/^\s*(?:[-*•>]|\d+\.)?\s*/)?.[0] ?? '';
      const bg = reasoning || BACKGROUND_LABEL.test(raw);
      // A link's title may hold a full stop: mask links while splitting.
      const links: string[] = [];
      const masked = raw
        .slice(lead.length)
        .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => `\u0000${links.push(m) - 1}\u0000`);
      const sentences = masked
        .split(SPLIT)
        .map((x) => x.replace(/\u0000(\d+)\u0000/g, (_, i: string) => links[Number(i)]).trim())
        .filter(Boolean);
      // The items under a sentence that ended "…would be:" or "…leads:" belong
      // to it, as long as they bring no figure of their own.
      const listed: boolean = carrying && lead.trim() !== '' && !figures(raw).length;
      const kept: string[] = sentences.map((x) => {
        const k: string = listed ? x : surviving(x, ctx, asked, sectionCited, bg);
        if (k !== x) dropped.push(x);
        return k;
      });
      const line = kept.filter(Boolean).join(' ');
      if (line) out.push(`${lead}${line}`);
      const last: string = kept.filter(Boolean).pop() ?? '';
      if (!listed) carrying = /:\s*$/.test(last) && /would|leads?|unchecked|following/i.test(last);
    }
  }
  return { answer: tidy(out), dropped };
}
