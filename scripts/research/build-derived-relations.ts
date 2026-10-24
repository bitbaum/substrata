/**
 * Run the inference rules over the graph and write their proposals where a
 * reviewer can read them.
 *
 *   pnpm exec tsx scripts/research/build-derived-relations.ts          write research/derived-relations.json
 *   pnpm exec tsx scripts/research/build-derived-relations.ts --check  exit 1 if the file is stale
 *
 * Rules: lib/coverage/rules.ts. Input: the graph WITHOUT this file (hand-written,
 * corpus and USGS relations), so a proposal never rests on another proposal.
 * Every row is `derived` or `lead` and carries its rule and chain; the store
 * loads them as origin `rule`, and none is ever counted. Generated, never
 * hand-edited: test/coverage-rules.test.ts fails when the file differs from a
 * fresh run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { RELATIONS } from '../../config/substrata-relations';
import { proposeRelations, RULES } from '../../lib/coverage/rules';
import { buildStore } from '../../lib/graph/store';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUTPUT = path.join(ROOT, 'research/derived-relations.json');

/** The file's whole text, deterministic: no build time, sorted throughout. */
export function derivedRelationsText(): string {
  const relations = proposeRelations(buildStore({ hand: RELATIONS, derived: { relations: [] } }));
  const byRule: Record<string, number> = {};
  for (const r of relations) byRule[r.rule!] = (byRule[r.rule!] ?? 0) + 1;
  const out = {
    generatedBy:
      'scripts/research/build-derived-relations.ts from the relation graph (lib/coverage/rules.ts)',
    note: 'Proposals, not facts: every row is derived or a lead, names its rule and the relation ids it follows from, and is never counted in a completeness score or a coverage ratio.',
    rules: RULES,
    byRule,
    relations,
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

async function main(argv: string[]): Promise<number> {
  const text = derivedRelationsText();
  if (argv.includes('--check')) {
    const current = await readFile(OUTPUT, 'utf8').catch(() => '');
    if (current !== text) {
      console.error(
        'research/derived-relations.json is stale: run scripts/research/build-derived-relations.ts',
      );
      return 1;
    }
    console.log('research/derived-relations.json is current.');
    return 0;
  }
  await writeFile(OUTPUT, text);
  console.log(JSON.stringify((JSON.parse(text) as { byRule: unknown }).byRule));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
