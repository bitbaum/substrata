/**
 * Print the work queue: one task per empty or thin dossier box.
 *
 *   pnpm exec tsx scripts/research/gaps.ts [--kind country|company|resource|lab|science]
 *        [--entity country:kz] [--box facilities] [--limit 20] [--out tasks.json]
 *
 * JSON to stdout (an array of tasks, ordered by demand, then the owner's
 * country order); with --out, the same bytes are also written to that file.
 * Each task carries `instruction`, the text a data agent needs, and points at
 * `scripts/research/add.ts`, which stays the only gate. See prompts/data-entry.md.
 *
 * Deterministic: the same corpus gives the same output.
 */
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { DOSSIER_KINDS, type DossierKind } from '../../lib/dossier/definitions';
import { demandLedger } from '../../lib/dossier/demand';
import { emitTasks, type EmitOptions } from '../../lib/dossier/tasks';

export interface GapsArgs extends EmitOptions {
  out?: string;
}

/** Parse argv; throws with a usage line on anything it does not know. */
export function parseGapsArgs(argv: readonly string[]): GapsArgs {
  const args: GapsArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    i += 1;
    if (flag === '--kind') {
      if (!(DOSSIER_KINDS as readonly string[]).includes(value))
        throw new Error(`--kind must be one of ${DOSSIER_KINDS.join(', ')}`);
      args.kind = value as DossierKind;
    } else if (flag === '--entity') args.entity = value;
    else if (flag === '--box') args.box = value;
    else if (flag === '--out') args.out = value;
    else if (flag === '--limit') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) throw new Error('--limit must be a whole number');
      args.limit = n;
    } else throw new Error(`unknown flag ${flag}`);
  }
  return args;
}

/** The output, as the script prints it. */
export function gapsJson(args: GapsArgs): string {
  return `${JSON.stringify(emitTasks({ ...args, demand: demandLedger() }), null, 2)}\n`;
}

async function main(): Promise<void> {
  let args: GapsArgs;
  try {
    args = parseGapsArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${(error as Error).message}\nusage: gaps.ts [--kind k] [--entity id] [--box b] [--limit n] [--out file]\n`,
    );
    process.exit(1);
  }
  const json = gapsJson(args);
  process.stdout.write(json);
  if (args.out) await writeFile(args.out, json);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();
