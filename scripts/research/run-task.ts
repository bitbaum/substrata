/**
 * Work one dossier task with the source adapters, in dry-run by default.
 *
 *   pnpm exec tsx scripts/research/run-task.ts <task-id>            e.g. country:kz#trade
 *   pnpm exec tsx scripts/research/run-task.ts --entity country:kz --box trade
 *        [--lei <LEI>] [--qid <Q…>] [--cik <n>] [--hs <code>] [--period <yyyy>] [--top <n>]
 *        [--run-id <id>] [--out rows.json] [--write]
 *   pnpm exec tsx scripts/research/run-task.ts --find-lei "Name" | --find-qid "Name"
 *
 * Prints the task's instruction and allowed sources, then, for each adapter
 * that applies (lib/sources/registry.ts), the records it read, the candidate
 * rows it proposes (each marked whether it fills this box) and what it
 * skipped and why. Nothing is written. With --write the rows go through
 * `scripts/research/add.ts relations` — every check, the page re-read and the
 * quote found again — and only then into config/candidates/relations.json.
 *
 * Exit codes: 0 done, 1 usage or no such task, otherwise add.ts's on --write.
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { boxDefinition } from '../../lib/dossier/definitions';
import { emitTasks, type DossierTask } from '../../lib/dossier/tasks';
import { relationCandidateId, type RelationCandidate } from '../../lib/entry/candidate';
import { readDocument } from '../../lib/sources/document';
import { searchLei } from '../../lib/sources/gleif';
import { countsFor, plansFor, runPlans, type RunOptions } from '../../lib/sources/registry';
import { WIKIDATA_SPARQL, labelQuery } from '../../lib/sources/wikidata';
import { run as addRun } from './add';

export interface RunTaskArgs extends Omit<RunOptions, 'runId'> {
  task?: string;
  entity?: string;
  box?: string;
  runId?: string;
  out?: string;
  write: boolean;
  findLei?: string;
  findQid?: string;
}

const VALUE_FLAGS = [
  '--entity',
  '--box',
  '--lei',
  '--qid',
  '--cik',
  '--hs',
  '--period',
  '--top',
  '--run-id',
  '--out',
  '--find-lei',
  '--find-qid',
];

export function parseRunTaskArgs(argv: readonly string[]): RunTaskArgs {
  const a: RunTaskArgs = { write: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--write') a.write = true;
    else if (VALUE_FLAGS.includes(flag)) {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      const key = flag
        .slice(2)
        .replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof RunTaskArgs;
      (a as unknown as Record<string, unknown>)[key] =
        key === 'cik' || key === 'top' ? Number(v) : v;
    } else if (!flag.startsWith('--') && !a.task) a.task = flag;
    else throw new Error(`unknown argument ${flag}`);
  }
  if (a.task && !a.entity) [a.entity, a.box] = a.task.split('#');
  return a;
}

export function findTask(args: RunTaskArgs): DossierTask | undefined {
  return emitTasks({ entity: args.entity, box: args.box }).find(
    (t) => t.entity === args.entity && t.box === args.box,
  );
}

function show(label: string, value: unknown, log: (l: string) => void) {
  log(`${label}${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);
}

export async function main(
  argv: readonly string[],
  log: (l: string) => void = console.log,
): Promise<number> {
  let args: RunTaskArgs;
  try {
    args = parseRunTaskArgs(argv);
  } catch (error) {
    log(
      `${(error as Error).message}\nusage: run-task.ts <task-id> | --entity <id> --box <box> [--write] (see the file header)`,
    );
    return 1;
  }
  if (args.findLei) {
    show('GLEIF LEIs for that name (pass one as --lei):\n', await searchLei(args.findLei), log);
    return 0;
  }
  if (args.findQid) {
    const doc = await readDocument(
      `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(labelQuery(args.findQid))}`,
    );
    show(
      'Wikidata items with that exact English label (pass one as --qid):\n',
      doc.ok ? JSON.parse(doc.text).results.bindings : doc.reason,
      log,
    );
    return 0;
  }
  const task = args.entity && args.box ? findTask(args) : undefined;
  if (!task) {
    log(
      `No open task for ${args.entity ?? '?'}#${args.box ?? '?'} (the box may be full, or the id is wrong). List them: pnpm exec tsx scripts/research/gaps.ts --entity <id>`,
    );
    return 1;
  }
  log(`${task.instruction}\n`);
  log(`Allowed sources: ${task.allowedSources.map((s, i) => `${i + 1}. ${s}`).join('  ')}`);
  if (task.blockedBy) log(`Blocked: ${task.blockedBy}`);
  const runId = args.runId ?? `run-task-${new Date().toISOString().slice(0, 10)}`;
  const plans = plansFor(task, { ...args, runId });
  if (!plans.length) {
    log(
      '\nNo source adapter covers this box yet. Work it by hand from the allowed sources (prompts/data-entry.md).',
    );
    return 0;
  }
  for (const p of plans.filter((x) => x.needs)) log(`\n[${p.adapter}] not run: ${p.needs}`);
  const queries = boxDefinition(task.kind, task.box)?.relations ?? [];
  const rows: RelationCandidate[] = [];
  for (const r of await runPlans(plans)) {
    log(
      `\n[${r.adapter}] ${r.records.length} record(s) read, ${r.rows.length} row(s) proposed, ${r.skipped.length} skipped`,
    );
    for (const row of r.rows) {
      const id = relationCandidateId(row);
      if (rows.some((x) => relationCandidateId(x) === id)) {
        // A relation's id is from|type|to|asOf: a second commodity to the same partner in the same year is the same edge.
        log(
          `  skipped: ${id} from ${row.source.url} — same relation id as a row above (the id carries no commodity)`,
        );
        continue;
      }
      const fills = countsFor(task, row, queries)
        ? 'fills this box'
        : 'related; does not fill this box';
      show(`  proposed (${fills}, ${row.grade}): `, row, log);
      rows.push(row);
    }
    for (const s of r.skipped) log(`  skipped: ${s.record} — ${s.reason}`);
  }
  if (!rows.length) {
    log('\nNo rows to propose. Report the task "skipped" with the reasons above.');
    return 0;
  }
  const file = args.out ?? path.join(await mkdtemp(path.join(tmpdir(), 'run-task-')), 'rows.json');
  await writeFile(file, `${JSON.stringify(rows, null, 2)}\n`);
  log(`\n${rows.length} row(s) saved to ${file}.`);
  if (!args.write) {
    log(
      `Dry run: nothing written. Check them: pnpm exec tsx scripts/research/add.ts relations ${file} --dry-run`,
    );
    return 0;
  }
  return addRun(['relations', file], { log });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
