/**
 * Parse the USGS facility rows into relations and write them where a reviewer
 * can read them.
 *
 *   pnpm exec tsx scripts/research/build-usgs-relations.ts          write research/usgs-relations.json
 *   pnpm exec tsx scripts/research/build-usgs-relations.ts --check  exit 1 if the file is stale
 *
 * Input: research/usgs-producers.json. Parser: lib/graph/usgs-operators.ts.
 * The output is generated, never hand-edited: the report inside it lists every
 * string left unparsed and why, and test/graph.test.ts fails when the committed
 * file differs from a fresh run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import producers from '../../research/usgs-producers.json';
import { buildUsgsRelations, type UsgsProducersFile } from '../../lib/graph/usgs-operators';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUTPUT = path.join(ROOT, 'research/usgs-relations.json');

/** The file's whole text, deterministic: no build time, sorted throughout. */
export function usgsRelationsText(): string {
  const file = producers as unknown as UsgsProducersFile & { source: string; licence: string };
  const built = buildUsgsRelations(file);
  const out = {
    source: file.source,
    licence: file.licence,
    readOn: file.retrieved,
    generatedBy: 'scripts/research/build-usgs-relations.ts from research/usgs-producers.json',
    note: 'Operators and owners as the Minerals Yearbook table prints them; one edge per reading in lib/graph/usgs-operators.ts. A string the parser could not read with confidence makes no edge and is listed under report.unparsed.',
    report: built.report,
    nodes: built.nodes,
    relations: built.relations,
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

async function main(argv: string[]): Promise<number> {
  const text = usgsRelationsText();
  const parsed = JSON.parse(text) as { report: Record<string, unknown> };
  const { unparsed, ...summary } = parsed.report as { unparsed: unknown[] };
  if (argv.includes('--check')) {
    const current = await readFile(OUTPUT, 'utf8').catch(() => '');
    if (current !== text) {
      console.error(
        'research/usgs-relations.json is stale: run scripts/research/build-usgs-relations.ts',
      );
      return 1;
    }
    console.log('research/usgs-relations.json is current.');
    return 0;
  }
  await writeFile(OUTPUT, text);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`${unparsed.length} distinct string(s) unparsed; see report.unparsed in the file.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
