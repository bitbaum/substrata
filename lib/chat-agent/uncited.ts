/**
 * Nothing is made up. A link the sources do not hold — the buyers, suppliers,
 * owners or financiers `missingLinks` (ladder.ts) names — may appear in an
 * answer only as a web page we actually fetched says it ([W#]) or with a
 * corpus link. Otherwise the sentence goes, and the precise gap sentence (the
 * named link and the source that would settle it) stands in its place.
 *
 * Seen live on 2026-10-24, with every other guard passing: "Outside the corpus
 * — Kazatomprom and its operating joint ventures sell uranium under bilateral
 * supply contracts to electric power utilities … across North America, Europe,
 * and East Asia" — a buyers claim, on the exact link the answer had just said
 * was not in our sources, labelled as background so the prompt's rule against
 * background supplier claims did not stop it.
 *
 * Two rules, both decided in code:
 * 1. A sentence asserting content of a missing link's box (who buys, sells
 *    to, supplies, finances, owns) carries a [W#] for a fetched page, or a
 *    markdown link, or it goes.
 * 2. With a code table shown, a sentence about an entity the table names
 *    (an operator or an owner) carries a citation too: uncited background
 *    about them is the same thing, made up.
 * Sentences that state the gap, say what would settle it, present leads as
 * leads, or invite evidence are what an honest answer says, and stay.
 */
import type { MissingLink, LadderBox } from './ladder';
import type { TableFacts } from './table-guard';

const ABOUT: Record<LadderBox, RegExp> = {
  buyers:
    /\b(sells?|sold|selling|buy(s|ers?|ing)?|bought|purchas\w*|offtake|off-take|customers?|clients?|exports? (to|its|it)|exported to|deliver(s|ed|ies|ing)? (to|into)|supply contracts?|suppl(y|ies|ied) (to|utilities)|shipped to|ships to)\b/i,
  finance:
    /\b(financ\w*|fund(s|ed|ing)?|lend(s|er|ers|ing)?|loans?|investors? in|invested in|backed by)\b/i,
  owners: /\b(owns?|owned|owners?|ownership|stakes?|shareholders?|controlled by|controls?)\b/i,
  facilities: /\b(operat(es|ed|ing|or|ors)|runs? the|mines? (at|in)|produces? at)\b/i,
};

/** What an honest answer says about a gap: that it is one, what would settle it, the leads, the way to send evidence. */
const HONEST =
  /\b(not in (our|the) (sources|corpus|data(set)?|records)|(does|do|did) not (contain|hold|have|record|include|name|list)|no (buyers?|customers?|financiers?|owners?|data|information|records?)\b|names? no\b|(are|is) not (recorded|tracked|captured|covered|included|available)|would settle|source that would|unchecked|unreviewed|not part of the corpus|leads?\b|send (us )?evidence|you can send|if you have)\b/i;

const CITED_LINK = /\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)/;

/** Generic words of firm names: they name no one in particular. */
const COMMON = new Set(
  'llp jsc llc ltd inc corp company limited mining chemical holding holdings group plant international resources energy metals uranium lithium nickel copper rare earth earths mineral minerals industries national corporation joint venture ventures southern northern private investors properties electric power japanese chinese consortium investment kazakh beijing netherlands government sociedad minera compania compañía'.split(
    ' ',
  ),
);

/** The distinctive words of the firms a table names ("kazatomprom", "cameco", "albemarle"). */
export function tableEntityWords(facts: TableFacts | null): string[] {
  if (!facts) return [];
  const names = facts.rows.flatMap((r) => [
    r.operator ?? '',
    ...(r.owner ?? '').split(/[;,()[\]]|\band\b|\d+(?:\.\d+)?%/),
  ]);
  const words = new Set<string>();
  for (const n of names)
    for (const w of n.toLowerCase().match(/[\p{L}]{6,}/gu) ?? []) if (!COMMON.has(w)) words.add(w);
  return [...words];
}

/** The web leads a sentence cites, by number. */
const leadsIn = (s: string) => [...s.matchAll(/\[W(\d+)\]/g)].map((m) => Number(m[1]));

function cited(s: string, webCount: number): boolean {
  const leads = leadsIn(s);
  if (leads.length) return leads.every((n) => n >= 1 && n <= webCount);
  return CITED_LINK.test(s);
}

/** A sentence that makes a claim the sources do not back, and why. */
export interface Uncited {
  sentence: string;
  why: string;
  /** For a fetched page's claim said as fact: the same sentence, said as the page's. */
  reword?: string;
}

/** Words that say a page said it. */
const ATTRIBUTED =
  /\b(says?|said|reports?|reported|mentions?|notes?|states?|claims?|discuss(es)?|according|describes?|covers?|announced?|writes?|suggests?)\b/i;

const SPLIT =
  /(?<=(?<!\b(?:Inc|Corp|Ltd|Co|Plc|plc|JSC|LLP|B\.V|N\.V|S\.A|e\.g|i\.e|No|St))[.!?])\s+(?=[A-Z“"*[(])/;

export function uncitedClaims(
  answer: string,
  opts: { gaps: MissingLink[]; entities: string[]; webCount: number; summary?: string[] },
): Uncited[] {
  const boxes = opts.gaps.map((g) => g.box);
  const out: Uncited[] = [];
  const body = answer.replace(/```[\s\S]*?```/g, ' ');
  for (const line of body.split('\n')) {
    if (/^\s*#/.test(line)) continue;
    // A link's title may hold a full stop ("…Its Uranium. China Is Built…"): mask links while splitting.
    const links: string[] = [];
    const masked = line.replace(/\[[^\]]*\]\([^)]*\)/g, (m) => `\u0000${links.push(m) - 1}\u0000`);
    const parts = masked
      .split(SPLIT)
      .map((p) => p.replace(/\u0000(\d+)\u0000/g, (_, i: string) => links[Number(i)]).trim())
      .filter(Boolean);
    for (const sentence of parts) {
      // A fetched page's claim on a missing link is said as the page's, never as fact.
      const leadBox = leadsIn(sentence).length && boxes.find((b) => ABOUT[b].test(sentence));
      if (
        cited(sentence, opts.webCount) &&
        leadBox &&
        !ATTRIBUTED.test(sentence) &&
        !/^[-*•[]/.test(sentence) &&
        // A lead's title line ("EnergyX inks ... deal with Trafigura [W1]") is a title, not a claim.
        !/^[^.!?]*\[W\d+\]\s*$/.test(sentence)
      ) {
        out.push({
          sentence,
          why: `gives a web page's ${leadBox} claim as fact`,
          // Kept as written after the attribution: a name keeps its capital.
          reword: `According to a web page, ${sentence}`,
        });
        continue;
      }
      if (cited(sentence, opts.webCount) || HONEST.test(sentence)) continue;
      if (opts.summary?.some((s) => sentence.includes(s) || s.includes(sentence))) continue;
      const box = boxes.find((b) => ABOUT[b].test(sentence));
      if (box) {
        out.push({ sentence, why: `asserts the missing ${box} link without a source` });
        continue;
      }
      const low = sentence.toLowerCase();
      const who = opts.entities.find((w) => new RegExp(`\\b${w}`, 'u').test(low));
      if (who) out.push({ sentence, why: `says something about ${who} without a source` });
    }
  }
  return out;
}

/** The answer without them; the gap sentences stand where the first one was, unless already said. */
/** Words that name each link, however a sentence paraphrases it. */
export const BOX_WORDS: Record<LadderBox, RegExp> = {
  buyers:
    /\b(buyers?|customers?|purchas\w*|offtake|off-take|clients?|who buys|sold to|sells? to)\b/i,
  finance: /\b(financ\w*|funders?|lenders?|investors?)\b/i,
  owners: /\b(owners?|ownership|shareholders?|stakes?|who owns)\b/i,
  facilities: /\b(operators?|operating compan(y|ies)|mining compan(y|ies)|facilit(y|ies))\b/i,
};

/** The words of a sentence that says a link is missing. */
export const GAP_SAYS =
  /not in (our|the) (sources|corpus|data|records)|(is|are) not (recorded|tracked|captured|covered)|(does|do|did) not (record|contain|list|hold|track|name|include)|no .{0,30}(is|are) named/i;

/** The sentences that say this link is missing, in any words (the live Chile answer said it twice). */
export function gapSentences(answer: string, box: LadderBox): string[] {
  return answer
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => BOX_WORDS[box].test(s) && GAP_SAYS.test(s));
}

const saysGap = (answer: string, box: LadderBox) => gapSentences(answer, box).length > 0;

/**
 * Each missing link said once: the first sentence that says it stays (the
 * computed one, where code put it), a paraphrase of it later goes — seen live
 * on Chile, 2026-10-24, the same gap twice in a row.
 */
export function oneGapEach(answer: string, gaps: MissingLink[]): string {
  let out = answer;
  for (const g of gaps)
    for (const extra of gapSentences(out, g.box).slice(1)) {
      // The paraphrase and the "what would settle it" sentence that follows it.
      const at = out.indexOf(extra);
      const after = out
        .slice(at + extra.length)
        .match(/^\s*A source that would settle it:[^\n]*?[.!?](?=\s|$)/);
      out = out.slice(0, at) + out.slice(at + extra.length + (after?.[0].length ?? 0));
    }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function dropUncited(answer: string, claims: Uncited[], gaps: MissingLink[]): string {
  if (!claims.length) return answer;
  const missing = gaps
    .filter((g) => !saysGap(answer, g.box))
    .map((g) => `${g.sentence} A source that would settle it: ${g.settles}.`)
    .join(' ');
  let out = answer;
  let placed = false;
  for (const c of claims) {
    if (c.reword) {
      out = out.replace(c.sentence, c.reword);
      continue;
    }
    out = out.replace(c.sentence, placed ? '' : missing);
    placed = true;
  }
  return out
    .split('\n')
    .map((l) =>
      l
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^ (?=\S)/, '')
        .trimEnd(),
    )
    .filter((l, i, all) => !/^\s*([-*•]|\d+\.)\s*$/.test(l) && (l.trim() || all[i - 1]?.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The highest [W#] the answer's lookups actually fetched (each result names its `cite_as`). */
export function webCountIn(results: string[]): number {
  let max = 0;
  for (const r of results.filter((x) => /^\[web_search\]/.test(x)))
    for (const m of r.matchAll(/"cite_as":"W(\d+)"/g)) max = Math.max(max, Number(m[1]));
  return max;
}
