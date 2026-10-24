/**
 * What run-task decides about the rows its adapters proposed, and the plain
 * report it ends with. Pure, so the test drives it without a network:
 *
 *   - a row already in the corpus or the sidecar is skipped, so a re-run
 *     proposes only what is new (add.ts would refuse the whole batch, exit 5).
 *     A trade flow is matched by its FLOW (from, type, to, asOf, HS code),
 *     not only by id, so renaming a commodity can never re-propose a stored
 *     flow under a new id;
 *   - a `lead` is held back unless the worker passes --include-leads, and the
 *     run says why each one is a lead;
 *   - the closing list (rows written, rows skipped with reasons) is plain
 *     text a worker pastes into the PR description as it stands.
 */
import { relationCandidateId, type RelationCandidate } from '../../lib/entry/candidate';
import type { Relation } from '../../lib/graph/types';
import { whyLead } from '../../lib/sources/proposal';

/** A record or row that did not become a written row, and why. */
export interface SkipLine {
  /** The adapter that read it, when one did. */
  adapter?: string;
  record: string;
  reason: string;
}

/**
 * What makes two rows the same fact: a flow whose commodity starts with an HS
 * code is one flow per (from, type, to, asOf, HS code), whatever words follow
 * the code; anything else is its relation id.
 */
export function flowKey(r: Pick<Relation, 'from' | 'to' | 'type' | 'asOf' | 'volume'>): string {
  const hs = r.volume?.commodity?.match(/^HS\s*(\d+)/i)?.[1];
  return hs ? `${r.from}|${r.type}|${r.to}|${r.asOf}|hs:${hs}` : relationCandidateId(r);
}

export interface Selection {
  /** The rows to hand to add.ts: stated rows, and leads only with --include-leads. */
  write: RelationCandidate[];
  skipped: SkipLine[];
}

/** Which proposed rows go to add.ts, and every one that does not, with its reason. */
export function selectRows(
  rows: readonly RelationCandidate[],
  /** `known`: the relation ids AND flow keys already in the corpus or sidecar. */
  opts: { known: ReadonlySet<string>; includeLeads: boolean },
): Selection {
  const write: RelationCandidate[] = [];
  const skipped: SkipLine[] = [];
  for (const row of rows) {
    const id = relationCandidateId(row);
    const adapter = row.provenance?.adapter;
    if (opts.known.has(id) || opts.known.has(flowKey(row)))
      skipped.push({
        adapter,
        record: id,
        reason: 'already in the corpus or config/candidates/relations.json',
      });
    else if (row.grade === 'lead' && !opts.includeLeads)
      skipped.push({
        adapter,
        record: id,
        reason: `a lead, not written without --include-leads: ${whyLead(row)}`,
      });
    else write.push(row);
  }
  return { write, skipped };
}

export interface ReportInput {
  task: string;
  runId: string;
  /** 'dry-run': nothing written; a number: add.ts's exit code on --write. */
  outcome: 'dry-run' | number;
  rows: readonly RelationCandidate[];
  skipped: readonly SkipLine[];
}

const line = (r: RelationCandidate) =>
  `- ${relationCandidateId(r)} (${r.grade}) — ${r.source.url}${r.note ? `\n  note: ${r.note}` : ''}`;

/** The closing list, plain text, for the PR description. */
export function prReport(input: ReportInput): string {
  const { outcome, rows, skipped } = input;
  const heading =
    outcome === 'dry-run'
      ? `Rows proposed, not written (dry run) (${rows.length}):`
      : outcome === 0
        ? `Rows written to config/candidates/relations.json (${rows.length}):`
        : `Rows NOT written: scripts/research/add.ts exited ${outcome}, see its lines above (${rows.length}):`;
  return [
    `run-task ${input.task}, run ${input.runId}`,
    '',
    heading,
    ...(rows.length ? rows.map(line) : ['- none']),
    '',
    `Rows skipped (${skipped.length}):`,
    ...(skipped.length
      ? skipped.map((s) => `- ${s.adapter ? `[${s.adapter}] ` : ''}${s.record} — ${s.reason}`)
      : ['- none']),
  ].join('\n');
}
