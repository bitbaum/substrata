/**
 * What every adapter hands back, and the one gate its rows pass before anyone
 * sees them. An adapter drafts relation rows from records it fetched; then
 * `finalise`:
 *
 *   1. finds the row's quote in the text the adapter fetched for that URL
 *      (PDFs page by page, recording "page N"); not found → skipped, never kept
 *   2. caps the grade at the adapter's ceiling (Wikidata: `lead`)
 *   3. parses the row with the relations schema add.ts uses; a failure → skipped
 *
 * So no adapter output reaches `stated` without its quote standing in the
 * fetched text. add.ts then re-reads the URL and checks again on --write.
 */
import type { RelationCandidate, SubmittedBy } from '@/lib/entry/candidate';
import { MODEL_ADAPTER } from '@/lib/entry/common-schema';
import { RelationEntry } from '@/lib/entry/relation-schema';
import { verbatimIn } from '@/lib/event-rules';
import type { DocumentRead } from './document';
import { findQuoteInPages } from './pdf';

/** A record the adapter read but did not turn into a row, and why. */
export interface Skipped {
  record: string;
  reason: string;
}

export interface AdapterResult<R = unknown> {
  adapter: string;
  /** The structured records as fetched, for a person to read. */
  records: R[];
  /** Rows that passed `finalise`: ready for `add.ts relations --dry-run`. */
  rows: RelationCandidate[];
  skipped: Skipped[];
}

/** A row as an adapter drafts it, before the gate: no `evidence`, no `submittedBy`. */
export interface Draft {
  from: string;
  to: string;
  type: RelationCandidate['type'];
  grade: 'stated' | 'lead';
  asOf: string;
  url: string;
  quote: string;
  share?: RelationCandidate['share'];
  volume?: RelationCandidate['volume'];
  /** Where in the source (a table row), when not a PDF page. */
  locator?: string;
  /** For the reviewer: what a figure measures, or why the row is a lead. */
  note?: string;
  /** What the row came from, for the skipped list. */
  label: string;
}

export interface FinaliseContext {
  adapter: string;
  /** The documents the adapter fetched, by URL. */
  docs: ReadonlyMap<string, DocumentRead>;
  submittedBy: SubmittedBy;
  /** The strongest grade this adapter may write on its own. */
  ceiling: 'stated' | 'lead';
  today?: string;
}

/** Where the quote stands in the fetched document: a locator, or null when it is not there. */
export function locateQuote(
  quote: string,
  doc: DocumentRead | undefined,
): { locator?: string } | null {
  if (!doc || !doc.ok) return null;
  if (doc.pages) {
    const hit = findQuoteInPages(quote, doc.pages);
    if (!hit) return null;
    return hit.page ? { locator: `page ${hit.page}` } : {};
  }
  return verbatimIn(quote, doc.text) ? {} : null;
}

export function finalise(
  drafts: readonly Draft[],
  ctx: FinaliseContext,
): Omit<AdapterResult, 'adapter' | 'records'> {
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const rows: RelationCandidate[] = [];
  const skipped: Skipped[] = [];
  for (const d of drafts) {
    const doc = ctx.docs.get(d.url);
    const found = locateQuote(d.quote, doc);
    if (!found) {
      skipped.push({
        record: d.label,
        reason: `the quote is not in the text fetched from ${d.url}`,
      });
      continue;
    }
    const capped = ctx.ceiling === 'lead' && d.grade !== 'lead';
    const grade = capped ? 'lead' : d.grade;
    const note = capped
      ? [d.note, `${ctx.adapter} proposes leads only.`].filter(Boolean).join(' ')
      : d.note;
    const locator = found.locator ?? d.locator;
    const row = {
      evidence: 'candidate',
      asOf: d.asOf,
      source: { url: d.url, quote: d.quote, readOn: today, ...(locator ? { locator } : {}) },
      submittedBy: ctx.submittedBy,
      provenance: { adapter: ctx.adapter, fetchedAt: doc!.ok ? doc!.fetchedAt : '', url: d.url },
      from: d.from,
      to: d.to,
      type: d.type,
      grade,
      ...(d.share ? { share: d.share } : {}),
      ...(d.volume ? { volume: d.volume } : {}),
      ...(note ? { note } : {}),
    };
    const parsed = RelationEntry.safeParse(row);
    if (!parsed.success) {
      const why = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'row'}: ${i.message}`)
        .join('; ');
      skipped.push({ record: d.label, reason: `not a valid relation row (${why})` });
      continue;
    }
    rows.push(parsed.data as RelationCandidate);
  }
  return { rows, skipped };
}

/** The `submittedBy` an adapter run carries: no model wrote it. */
export function adapterRun(adapter: string, runId: string): SubmittedBy {
  return { agent: `source-adapter:${adapter}`, model: MODEL_ADAPTER, runId };
}

/** Why a row is a lead, for the dry run: its note, or the plain fact when it has none. */
export function whyLead(row: RelationCandidate): string {
  return row.note ?? `${row.provenance?.adapter ?? 'its writer'} graded it lead`;
}
