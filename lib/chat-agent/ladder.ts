/**
 * The answer ladder: there is no wall (docs/architecture/2026-10-24-research-systems.md §1).
 *
 * Asked on 2026-10-24 "Which companies mine uranium in Kazakhstan, who owns
 * them, and who do they sell to?", the Ask gave one production figure and
 * then said the mining entities, their owners and their buyers "are not
 * recorded in the corpus". Two of the three were in a research file no tool
 * read, and the web was never tried for the third. This module is the code
 * half of the fix:
 *
 * - `missingLinks` reads what the lookups returned against what the question
 *   asked, and names each part nothing covered — precisely, with the kind of
 *   source that would settle it. The loop uses it to open the web for that
 *   part (one bounded lookup), to tell the model which link is missing, and
 *   to file the gap (gaps.ts).
 * - `wallProblem` catches the answer that only says what is missing, or that
 *   says rows it was handed are missing. It is sent back once (`reviseWall`),
 *   the same pattern as the figure guard in grounding.ts.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import type { EntityId } from '../entities/types';
import { resourceIn } from '../chat-tools/resources';
import { producerResource } from '../chat-tools/producers';
import { lookupIsEmpty } from './lookups';
import { companiesIn, countriesIn } from './question';
import { REVISION_RULE, type ModelTurn } from './turn';

/**
 * The dossier boxes a missing link fills. Named to match the dossier
 * definitions (lib/dossier, §5 of the design); if those names change, change
 * them here — this is the only list.
 */
export const LADDER_BOXES = ['facilities', 'owners', 'buyers', 'finance'] as const;
export type LadderBox = (typeof LADDER_BOXES)[number];

/** What a web lookup came to, in the four states a reader must be told apart. */
export type WebStatus = 'off' | 'could_not_look' | 'nothing' | 'found';

export interface MissingLink {
  box: LadderBox;
  /** The one sentence an answer says about it. */
  sentence: string;
  /** The kind of source that would settle it. */
  settles: string;
  /** The words a web engine is given for it. */
  search: string;
  entity?: EntityId;
  topics: string[];
}

interface Subject {
  label: string;
  country?: { iso2: string; name: string };
  resource?: string;
  company?: { slug: string; name: string };
}

function subjectOf(question: string): Subject | undefined {
  const country = countriesIn(question)[0];
  const resource = resourceIn(question)?.resource ?? producerResource(question);
  const company = companiesIn(question, 1)[0];
  if (country && resource)
    return { label: `${country.name}'s ${resource.replace(/-/g, ' ')}`, country, resource };
  if (company) return { label: company.name, company: { slug: company.slug, name: company.name } };
  return undefined;
}

export const ASKS: Record<LadderBox, RegExp> = {
  facilities:
    /\b(which compan(y|ies)|what compan(y|ies)|who (mines?|operates?|runs?|produces?|extracts?|refines?)|operators?|operating compan(y|ies)|mining compan(y|ies)|miners?|producers?|facilit(y|ies)|mines? (are|is) there)\b/i,
  owners:
    /\b(who owns|owns? them|owners?|owned by|ownership|stakes?|shareholders?|parent compan(y|ies)|controls? them)\b/i,
  buyers:
    /\b(sells? (it |them )?to|sell their|buyers?|customers?|offtake|off-take|who buys|purchasers?|clients?|exports? (it |them )?to)\b/i,
  finance: /\b(financ(e|es|ed|ing|iers?)|funds?|funded|lenders?|investors? in|backs?|backed)\b/i,
};

const SETTLES: Record<LadderBox, string> = {
  facilities:
    "the USGS Minerals Yearbook country chapter, the national mining cadastre, or the producers' own annual reports",
  owners:
    "company registries (GLEIF LEI relationships, the national company register) and the operators' annual reports",
  buyers:
    "offtake and supply agreements disclosed in the producers' annual reports and filings, customs and trade records (UN Comtrade), and the buyers' own procurement disclosures",
  finance:
    "project-finance announcements, loan and bond documents, development-bank project databases and the companies' filings",
};

const SEARCH: Record<LadderBox, string> = {
  facilities: 'mining companies operators',
  owners: 'ownership shareholders',
  buyers: 'offtake buyers supply contracts',
  finance: 'project financing investors',
};

interface Read {
  tool: string;
  value: Record<string, unknown>;
}

function read(results: string[]): Read[] {
  return results.flatMap((r) => {
    const m = r.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
    if (!m) return [];
    try {
      const value: unknown = JSON.parse(m[2]);
      return value && typeof value === 'object'
        ? [{ tool: m[1], value: value as Read['value'] }]
        : [];
    } catch {
      return [];
    }
  });
}

interface FacilityRow {
  read_as?: { operator: string | null; owner: string | null }[];
}

function facilityRows(reads: Read[]): FacilityRow[] {
  return reads
    .filter((r) => r.tool === 'producers_in')
    .flatMap((r) =>
      Array.isArray(r.value.facilities) ? (r.value.facilities as FacilityRow[]) : [],
    );
}

/** Keys a result carries when it names buyers: related_to's `buyers` once supply edges exist. */
const BUYER_KEYS = ['buyers', 'ships_to', 'buys_from', 'customers', 'listed_makers_downstream'];
/** Keys related_to fills with the holders of an entity. */
const OWNER_KEYS = ['owners', 'shareholders'];
const FINANCE_KEYS = ['financiers', 'finances', 'lenders', 'investors'];

function hasListed(reads: Read[], keys: string[]): boolean {
  return reads.some((r) =>
    keys.some((k) => Array.isArray(r.value[k]) && (r.value[k] as unknown[]).length > 0),
  );
}

function covered(box: LadderBox, reads: Read[]): boolean {
  const rows = facilityRows(reads);
  if (box === 'facilities') return rows.length > 0;
  if (box === 'owners')
    return (
      rows.some((f) => f.read_as?.some((c) => c.owner)) ||
      reads.some((r) => r.tool === 'ownership' && !lookupIsEmpty(JSON.stringify(r.value))) ||
      // The relation graph (related_to): owners or shareholders it listed, with their sources.
      reads.some((r) => r.tool === 'related_to' && hasListed([r], OWNER_KEYS))
    );
  if (box === 'buyers') return hasListed(reads, BUYER_KEYS);
  return hasListed(reads, FINANCE_KEYS);
}

function sentenceFor(box: LadderBox, s: Subject): string {
  if (box === 'facilities') return `The operating companies of ${s.label} are not in our sources.`;
  if (box === 'owners') return `Who owns the companies behind ${s.label} is not in our sources.`;
  if (box === 'buyers') return `The buyers of ${s.label} output are not in our sources.`;
  return `Who finances ${s.label} is not in our sources.`;
}

/**
 * The parts of the question no lookup covered, each named precisely. A part
 * counts only when the question asks it AND names a subject the corpus can
 * hang it on (a country with a resource, or a company): "who makes EUV
 * scanners" is answered by the bottleneck record, not by this ladder.
 */
export function missingLinks(question: string, results: string[]): MissingLink[] {
  const subject = subjectOf(question);
  if (!subject) return [];
  const reads = read(results);
  return LADDER_BOXES.filter((box) => {
    if (!ASKS[box].test(question)) return false;
    // Facilities and owners are a country chain; for a company they are its own record.
    if ((box === 'facilities' || box === 'owners') && !subject.country) return false;
    return !covered(box, reads);
  }).map((box) => {
    const where = subject.country
      ? `${subject.country.name} ${subject.resource?.replace(/-/g, ' ') ?? ''}`
      : subject.company!.name;
    return {
      box,
      sentence: sentenceFor(box, subject),
      settles: SETTLES[box],
      search: `${where.trim()} ${SEARCH[box]}`,
      entity: (subject.country
        ? `country:${subject.country.iso2}`
        : `company:${subject.company!.slug}`) as EntityId,
      topics: [subject.resource, subject.country?.iso2, subject.company?.slug, box].filter(
        (t): t is string => Boolean(t),
      ),
    };
  });
}

/** What a web_search result came to. */
export function webStatusOf(result: string | undefined): WebStatus {
  if (!result) return 'off';
  const json = result.replace(/^\[[^\]]+\]\s*/, '');
  try {
    const value = JSON.parse(json) as { status?: string; error?: string; results?: unknown[] };
    if (value.status === 'off' || value.status === 'could_not_look' || value.status === 'nothing')
      return value.status;
    if (value.error) return /not configured/i.test(value.error) ? 'off' : 'could_not_look';
    return value.results?.length ? 'found' : 'nothing';
  } catch {
    return 'could_not_look';
  }
}

// ---------------------------------------------------------------------------
// The answer that is only a wall.
// ---------------------------------------------------------------------------

/** A sentence that says something is missing, in the ways small models say it. */
const GAP =
  /\b(not (recorded|tracked|available|listed|included|covered|captured|found|present|held|documented|specified|given|provided)|no (data|records?|information|details|figures?)|(is|are|isn't|aren't) not (in|part of)|(is|are)n't (in|part of)|(do|does|did) not (hold|contain|have|record|track|cover|include|list|name|mention)|(don't|doesn't|didn't) (hold|contain|have|record|track|cover|include|list|name|mention)|cannot (find|answer|provide|say|confirm)|can't (find|answer|provide|say)|could not (find|look)|unable to (find|provide|answer)|beyond (the|our) (data|corpus|sources)|outside (of )?(the|our) (data|database|corpus|records))\b/i;
const FILLER = /send evidence|add evidence|contribut|ask (again|another)|let me know|feel free/i;

function sentences(answer: string): string[] {
  return answer
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) =>
      s
        .replace(/[*_#>`]/g, '')
        .replace(/^\s*[-•\d.]+\s*/, '')
        .trim(),
    )
    .filter((s) => s.length > 0 && !/^outside the corpus/i.test(s)); // labelled background denies nothing
}

/** A gap sentence that denies operators or owners — checked against rows that carry them. */
const DENIES: Record<'facilities' | 'owners', RegExp> = {
  facilities:
    /\b(mining (entities|companies|firms)|operat(ors|ing (companies|entities))|which companies|the companies (that|which|mining|operating)|producing companies|producers|facilit(y|ies))\b/i,
  owners: /\b(ownership|owners?|who owns|shareholders?|stakes?|equity holders?)\b/i,
};

export type WallProblem =
  { kind: 'refusal-only' } | { kind: 'denies'; what: ('facilities' | 'owners')[] };

/**
 * Whether an answer is a wall: when any lookup returned rows, an answer whose
 * every sentence is a gap (or filler) is refused; so is one that says the
 * operators or owners are missing while the rows above carry them.
 */
export function wallProblem(answer: string, results: string[]): WallProblem | null {
  const withRows = results.filter((r) => !lookupIsEmpty(r) && !/^\[web_search\]/.test(r));
  if (!withRows.length || !answer.trim()) return null;
  const all = sentences(answer);
  const gaps = all.filter((s) => GAP.test(s));
  const content = all.filter((s) => !GAP.test(s) && !FILLER.test(s) && s.length > 15);
  if (!content.length && gaps.length) return { kind: 'refusal-only' };
  const reads = read(withRows);
  const what = (['facilities', 'owners'] as const).filter(
    (box) => covered(box, reads) && gaps.some((s) => DENIES[box].test(s)),
  );
  return what.length ? { kind: 'denies', what } : null;
}

const WHAT: Record<'facilities' | 'owners', string> = {
  facilities: 'the operating companies',
  owners: 'their owners and stakes',
};

/** The instruction a wall is sent back with: what the sources DO say first, then the one missing link. */
export function wallInstruction(problem: WallProblem, links: MissingLink[]): string {
  const why =
    problem.kind === 'refusal-only'
      ? 'your answer only says what is missing, but the lookups above returned rows'
      : `your answer says ${problem.what.map((w) => WHAT[w]).join(' and ')} are not in the sources, but the USGS facility table above names them, exactly as printed`;
  const missing = links.length
    ? ` What is genuinely missing: ${links.map((l) => `${l.sentence} A source that would settle it: ${l.settles}.`).join(' ')}`
    : '';
  return `Check before I read this: ${why}. Rewrite the whole answer. First state what the sources DO say — names, owners with their stakes, figures — copying each company entry, stake, capacity and figure exactly as printed, with links. Then, for the part that is missing, name the single missing link in one sentence and say which kind of source would settle it. If web results [W#] are above, show them under their own heading as unchecked leads, never as corpus rows.${missing} Never answer only "not in the corpus". No tools. ${REVISION_RULE}`;
}

/** Send a wall back once. The revised text, or null when the revision failed. */
export async function reviseWall(opts: {
  messages: ChatMessage[];
  answer: string;
  problem: WallProblem;
  links: MissingLink[];
  turn: ModelTurn;
  onText: (text: string) => void;
}): Promise<string | null> {
  try {
    const result = await opts.turn({
      messages: [
        ...opts.messages,
        { role: 'assistant', content: opts.answer },
        { role: 'user', content: wallInstruction(opts.problem, opts.links) },
      ],
      onText: opts.onText,
    });
    return result.text.trim() && !result.truncated ? result.text : null;
  } catch {
    return null;
  }
}
