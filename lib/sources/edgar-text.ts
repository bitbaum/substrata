/**
 * Reading an SEC filing's text for two kinds of sentence, by pattern only:
 *
 *   customers — "sales to X", "revenue from X", "X accounted for 31% of total
 *               revenue" (10-K Item 1 and the revenue note; 20-F Item 4/7)
 *   holders   — the rows of the beneficial-ownership table under its
 *               "5% or greater" heading (DEF 14A; 10-K Part III; 20-F Item 7)
 *
 * No inference: a name is a customer or holder only when it stands in one of
 * those sentences or rows, and it becomes an edge only when it is an entity
 * the site already names. "Customer A" stays anonymous — that is what the
 * filing says.
 */
import { companyEndpoint } from './endpoints';
import { quoteAround } from './text';

/** A capitalised name of one to six words, allowing "&", "-", "." and a comma before Inc./Ltd. */
const NAME = String.raw`([A-Z][\w&'’.-]*(?:,? (?:[A-Z][\w&'’.-]*|&|of|de|and)){0,5})`;

const CUSTOMER_PATTERNS: { rx: RegExp; share: boolean }[] = [
  {
    rx: new RegExp(String.raw`\b(?:[Ss]ales|[Rr]evenues?) (?:to|from) ${NAME}`, 'g'),
    share: false,
  },
  {
    rx: new RegExp(
      String.raw`${NAME} accounted for (?:approximately |about )?(\d+(?:\.\d+)?) ?% of (?:the Company[’']s |our |its )?(?:total |net |consolidated )?(?:revenues?|net sales|sales)`,
      'g',
    ),
    share: true,
  },
];

export interface NameHit {
  /** The name as it stands in the text. */
  name: string;
  /** The entity it is, when it is one. */
  endpoint: string | null;
  reason?: string;
  quote: string | null;
  /** Per cent (holders) or per cent of revenue (customers), when stated. */
  percent?: number;
}

/** The longest leading run of words of `raw` that is an entity; else the whole run, unresolved. */
function resolveLeading(raw: string): { name: string; endpoint: string | null; reason?: string } {
  const words = raw.replace(/[,.]$/, '').split(' ');
  for (let n = words.length; n > 0; n--) {
    const name = words.slice(0, n).join(' ').replace(/,$/, '');
    const r = companyEndpoint(name);
    if (r.id) return { name, endpoint: r.id };
  }
  const name = words.join(' ');
  return { name, endpoint: null, reason: `"${name}" is not an entity on the site` };
}

/** Sentences naming a customer, each with its quote. */
export function customerHits(text: string): NameHit[] {
  const out: NameHit[] = [];
  for (const { rx, share } of CUSTOMER_PATTERNS) {
    for (const m of text.matchAll(rx)) {
      const who = resolveLeading(m[1]);
      if (/^(?:Customers?|Customer [A-Z])\b/.test(who.name) && !who.endpoint) continue; // anonymised in the filing
      out.push({
        ...who,
        quote: quoteAround(text, m.index!, m.index! + m[0].length),
        ...(share ? { percent: Number(m[2]) } : {}),
      });
    }
  }
  return out;
}

const HOLDER_SECTION =
  /(?:5% or Greater (?:Stockholders|Shareholders|Holders)|Principal (?:Stockholders|Shareholders)|Greater than 5% (?:Stockholders|Shareholders))/i;
const SECTION_END =
  /Named Executive Officers|Directors and (?:Named )?Executive Officers|Executive Officers and Directors/;
const HOLDER_ROW =
  /([A-Z][A-Za-z.,&'’ -]{2,80}?)\s*(?:\(\d+\))?\s+(\d{1,3}(?:,\d{3})+)\s+(\d{1,2}(?:\.\d+)?)\s?%/g;

/** The rows of the "5% or greater" block of a beneficial-ownership table. */
export function holderHits(text: string): NameHit[] {
  const heading = HOLDER_SECTION.exec(text);
  if (!heading) return [];
  const start = heading.index + heading[0].length;
  const rest = text.slice(start);
  const stop = rest.slice(20).search(SECTION_END);
  const block = stop < 0 ? rest.slice(0, 4000) : rest.slice(0, stop + 20);
  const out: NameHit[] = [];
  for (const m of block.matchAll(HOLDER_ROW)) {
    const name = m[1].trim();
    const r = companyEndpoint(name);
    const row = m[0].trim();
    out.push({
      name,
      endpoint: r.id,
      ...(r.id === null ? { reason: r.reason } : {}),
      quote:
        row.length >= 20
          ? row
          : quoteAround(text, start + m.index!, start + m.index! + m[0].length),
      percent: Number(m[3]),
    });
  }
  return out;
}
