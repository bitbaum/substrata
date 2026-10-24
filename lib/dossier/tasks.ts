/**
 * The work queue: one task per empty or thin box, written so a cheaper model
 * can do it from the task alone. Emitted fresh from the dossiers every time,
 * so it never goes stale: a box filled since the last run simply stops
 * producing a task.
 */
import { JURISDICTIONS } from '@/config/substrata-policy';
import { FACETS } from '@/lib/entry/candidate';
import type { GapTask } from '@/lib/graph/types';
import { participantBySlug } from '@/lib/participants';
import { computeDossier, type BoxResult, type ComputeOptions } from './compute';
import { NO_DEMAND, type DemandReader } from './demand';
import {
  DOSSIER_KINDS,
  PRIORITY_COUNTRIES,
  boxDefinition,
  boxesFor,
  type BoxDefinition,
  type DossierKind,
} from './definitions';
import { subjectsOf, type Subject } from './subjects';

/** A GapTask plus what a model needs to act on it without reading the code. */
export interface DossierTask extends GapTask {
  kind: DossierKind;
  name: string;
  href: string;
  label: string;
  fullMeans: string;
  counted: number;
  basis: string;
  example: Record<string, unknown>;
  command: string;
  /** Set when the task cannot be done through add.ts today, with the reason. */
  blockedBy: string | null;
  /** The whole instruction, ready to paste after prompts/data-entry.md. */
  instruction: string;
}

export interface TaskFilter {
  kind?: DossierKind;
  entity?: string;
  box?: string;
  limit?: number;
}

export interface EmitOptions extends ComputeOptions, TaskFilter {
  demand?: DemandReader;
}

const KIND_ORDER: Record<DossierKind, number> = { country: 0, company: 1, resource: 2, lab: 3 };
const PRIORITY = new Map<string, number>(PRIORITY_COUNTRIES.map((iso2, i) => [iso2, i]));
const KNOWN_JURISDICTIONS = new Set<string>(JURISDICTIONS.map((j) => j.id));

/** Where a subject sits in the owner's country order; companies by their best jurisdiction. */
function priorityOf(subject: Subject): number {
  const isos =
    subject.kind === 'country'
      ? [subject.key]
      : subject.kind === 'company'
        ? (participantBySlug(subject.key)?.jurisdictions ?? []).map((j) => j.toLowerCase())
        : [];
  const rest = PRIORITY_COUNTRIES.length;
  return Math.min(rest, ...isos.map((iso2) => PRIORITY.get(iso2) ?? rest));
}

function blockedBy(def: BoxDefinition, subject: Subject): string | null {
  const facet = def.writeTo.facet;
  if (facet === null)
    return `A person fills this box (${def.writeTo.command}); a data agent does not edit ${def.writeTo.file}.`;
  if (!(FACETS as readonly string[]).includes(facet))
    return `The "${facet}" facet is not in scripts/research/add.ts yet; skip until it is.`;
  if (def.id === 'law_licensing' && !KNOWN_JURISDICTIONS.has(subject.key))
    return `The instruments register has no jurisdiction "${subject.key}" yet; a person adds it to JURISDICTIONS in config/substrata-policy.ts first.`;
  return null;
}

function instructionFor(t: Omit<DossierTask, 'instruction'>, def: BoxDefinition): string {
  const facet = def.writeTo.facet;
  const lines = [
    `Task ${t.id}: ${t.missing}`,
    `Subject: ${t.name} (${t.entity}), page ${t.href}. Read the page first; do not add a row it already shows.`,
    `Box: ${t.label} — ${def.question} Now ${t.status} (${t.basis || 'nothing counted'}). Full means ${t.fullMeans}.`,
    `Look in these sources, in this order, and nowhere else: ${t.allowedSources.map((s, i) => `${i + 1}. ${s}`).join(' ')}`,
  ];
  if (t.blockedBy) {
    lines.push(`Blocked: ${t.blockedBy} Report "skipped: ${t.blockedBy}" and stop.`);
  } else if (facet) {
    lines.push(
      `Write candidate rows for facet "${facet}" (${def.writeTo.file}). Shape: pnpm exec tsx scripts/research/add.ts ${facet} --schema.`,
      `Example of a good row (shape only — its quote is a placeholder; copy yours from the page): ${JSON.stringify(def.example)}`,
      `Run ${def.writeTo.command} and fix every exit code (2 schema, 3 unreachable, 4 quote, 5 duplicate) before running it without --dry-run.`,
      'If no source on the list states it, write nothing and report "skipped" with the reason. Never estimate, never infer a share or a rank.',
    );
  }
  return lines.join('\n');
}

function taskFor(
  subject: Subject,
  def: BoxDefinition,
  r: BoxResult,
  demand: DemandReader,
): DossierTask {
  const base = {
    id: `${subject.id}#${def.id}`,
    entity: subject.id,
    box: def.id,
    status: r.status as Exclude<BoxResult['status'], 'full'>,
    missing: r.missing ?? '',
    allowedSources: [...def.allowedSources],
    writeTo: def.writeTo.facet
      ? `${def.writeTo.file} (facet ${def.writeTo.facet}; shape: add.ts ${def.writeTo.facet} --schema)`
      : `${def.writeTo.file} (by a person: ${def.writeTo.command})`,
    demand: demand.count(subject.id, def.id),
    kind: subject.kind,
    name: subject.name,
    href: subject.href,
    label: def.label,
    fullMeans: r.fullMeans,
    counted: r.counted,
    basis: r.counts.basis,
    example: def.example,
    command: def.writeTo.command,
    blockedBy: blockedBy(def, subject),
  };
  return { ...base, instruction: instructionFor(base, def) };
}

/** Every task for one subject, in box order. */
export function tasksForSubject(subject: Subject, opts: EmitOptions = {}): DossierTask[] {
  const dossier = computeDossier(subject.id, { relations: opts.relations });
  if (!dossier) return [];
  return dossier.boxes
    .filter((r) => r.status !== 'full' && (!opts.box || r.box === opts.box))
    .map((r) => taskFor(subject, boxDefinition(subject.kind, r.box)!, r, opts.demand ?? NO_DEMAND));
}

/**
 * The queue, ordered: demand first, then the owner's country order, then kind
 * (country, company, resource, lab), empty before thin, box order, id.
 * Deterministic: the same corpus gives the same list, byte for byte.
 */
export function emitTasks(opts: EmitOptions = {}): DossierTask[] {
  const kinds = opts.kind ? [opts.kind] : [...DOSSIER_KINDS];
  const rows: { task: DossierTask; priority: number; boxIndex: number }[] = [];
  for (const kind of kinds) {
    const order = boxesFor(kind).map((b) => b.id);
    for (const subject of subjectsOf(kind)) {
      if (opts.entity && subject.id !== opts.entity) continue;
      const priority = priorityOf(subject);
      for (const task of tasksForSubject(subject, opts))
        rows.push({ task, priority, boxIndex: order.indexOf(task.box) });
    }
  }
  rows.sort(
    (a, b) =>
      b.task.demand - a.task.demand ||
      a.priority - b.priority ||
      Number(a.task.blockedBy !== null) - Number(b.task.blockedBy !== null) ||
      KIND_ORDER[a.task.kind] - KIND_ORDER[b.task.kind] ||
      (a.task.status === b.task.status ? 0 : a.task.status === 'empty' ? -1 : 1) ||
      a.boxIndex - b.boxIndex ||
      a.task.id.localeCompare(b.task.id),
  );
  const tasks = rows.map((r) => r.task);
  return opts.limit !== undefined ? tasks.slice(0, opts.limit) : tasks;
}
