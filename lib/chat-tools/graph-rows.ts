/**
 * One relation as a chat tool hands it to the model: never a bare claim. Each
 * row carries the other end, the stake, the grade in words, whether a number
 * may use it, and the source with its quote and what KIND of text that quote
 * is — because a USGS table cell, a corpus row a person wrote and a sentence
 * from a filing are said three different ways.
 */
import { resolveEntity } from '../entities/registry';
import { printedAs } from '../graph/aliases';
import { graphNode, relationEvidence, type GraphNode, type Relation } from '../graph/index';
import { countryHref } from '@/lib/world/pages';
import { remember, type ToolEnv } from './ledger';
import { readCompanies } from './producers';

/** Longer than this, a table cell is cut to the part that names this relation. */
const QUOTE_MAX = 320;

/** Where a reader can open a node: its own page, else its country's. */
export function nodePage(n: GraphNode): string | undefined {
  const entity = resolveEntity(n.id);
  if (entity) return entity.href;
  return n.iso2[0] ? countryHref(n.iso2[0]) : undefined;
}

/**
 * The part of a long quote that names this relation, copied verbatim: in a
 * USGS "Companies:" cell, the one venture's entry; otherwise the sentence
 * around the first name found. Never re-worded, so it is always a substring.
 */
export function quoteExcerpt(quote: string, names: string[]): { text: string; whole: boolean } {
  if (quote.length <= QUOTE_MAX) return { text: quote, whole: true };
  const found = names.filter(Boolean).find((n) => quote.includes(n));
  if (/^companies:/i.test(quote)) {
    // Entry boundaries: each venture's name, in order, where the cell prints it.
    const starts: number[] = [];
    let from = 0;
    for (const r of readCompanies(quote)) {
      const head = (r.operator ?? r.owner ?? '').slice(0, 30);
      const at = head ? quote.indexOf(head, from) : -1;
      if (at >= 0) {
        starts.push(at);
        from = at + head.length;
      }
    }
    const entries = starts.map((s, i) => quote.slice(s, starts[i + 1] ?? quote.length).trim());
    const both = entries.find((e) => names.filter((n) => e.includes(n)).length >= 2);
    const one = both ?? entries.find((e) => found !== undefined && e.includes(found));
    if (one) return { text: one, whole: false };
  }
  const at = found ? quote.indexOf(found) : 0;
  const start = Math.max(0, quote.lastIndexOf(' ', Math.max(0, at - 120)) + 1);
  const end = quote.indexOf(' ', Math.min(quote.length, at + 200));
  return { text: quote.slice(start, end < 0 ? quote.length : end).trim(), whole: false };
}

/** What each kind of quote is, said once in the tool's note rather than on every row. */
export const READING_NOTE =
  "`source.reading`: `table-cell` is a cell of a published table — quote it as printed; `curated-record` is a corpus row a person wrote from the source, not the source's words — say \"as read from <the source's site>\", never quote it; `verbatim` is the source's own words.";

/** The table and column a cell sits in, without the row's long place list. */
function where(locator: string | undefined): string | undefined {
  if (!locator) return undefined;
  const parts = locator.split('; ');
  return parts.slice(0, 2).join('; ').slice(0, 120);
}

/** A relation as seen from `from`: the other end and the evidence behind the edge. */
export function relationRow(r: Relation, viewpoint: string) {
  const ev = relationEvidence(r);
  const other = graphNode(r.from === viewpoint ? r.to : r.from);
  const names = [
    graphNode(r.from).name,
    graphNode(r.to).name,
    ...printedAs(r.from),
    ...printedAs(r.to),
  ];
  const source = r.evidence[0];
  const excerpt = quoteExcerpt(source.quote, names);
  return {
    name: other.name,
    ...(other.inDirectory ? { page: nodePage(other) } : {}),
    relation: ev.sentence,
    ...(r.share ? { share: `${r.share.value}%` } : {}),
    grade: ev.gradeLabel,
    counted: ev.counted,
    as_of: r.asOf,
    ...(ev.candidate ? { candidate: 'not yet reviewed (candidate row)' } : {}),
    source: {
      url: source.source,
      ...(where(source.locator) ? { where: where(source.locator) } : {}),
      quote: excerpt.text,
      ...(excerpt.whole ? {} : { quote_is: 'the part of the cell naming this relation, verbatim' }),
      reading: source.reading ?? 'verbatim',
    },
    ...(r.evidence.length > 1 ? { more_sources: r.evidence.slice(1).map((e) => e.source) } : {}),
    ...(ev.rule ? { worked_out_by: ev.rule } : {}),
  };
}

export type RelationRow = ReturnType<typeof relationRow>;

/** The node in the records read, under its page (or its country's). */
export function rememberNode(env: ToolEnv, n: GraphNode) {
  const page = nodePage(n);
  // A minted firm with no entity has no page of its own: the record is its
  // country's. A stub company (lib/entities/sources/company-stubs.ts) has one.
  const country = n.iso2[0] && resolveEntity(`country:${n.iso2[0]}`)?.name;
  const ownPage = n.inDirectory || resolveEntity(n.id) !== undefined;
  if (page)
    remember(env.ledger, {
      title: ownPage ? n.name : `Relations in ${country || 'the graph'}`,
      href: page,
      kind: n.id.slice(0, n.id.indexOf(':')),
      evidence: 'Relation graph (sourced edges)',
      primary: [],
    });
}
