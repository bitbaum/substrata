/**
 * Add candidate rows for one facet — the only write a data agent makes.
 *
 *   pnpm exec tsx scripts/research/add.ts <facet> <rows.json|-> [--dry-run] [--branch]
 *   pnpm exec tsx scripts/research/add.ts <facet> --schema         the row shape, short
 *   pnpm exec tsx scripts/research/add.ts <facet> --json-schema    the same, as JSON Schema
 *
 * facet ∈ producers | events | endowments | facilities | instruments | science
 *         | ownership | series-points | relations
 *
 * Input is a JSON array of rows (or one row) in the facet's shape, from a file
 * or stdin (`-`). Every row is, in order:
 *   1. parsed with the facet schema (lib/entry/schemas.ts)            exit 2
 *   2. checked against what is already there, corpus and sidecar      exit 5
 *   3. its source.url read (lib/sources/document.ts: SSRF-guarded,
 *      3 tries; HTML as text, JSON as served, PDF page by page);
 *      an unreadable source                                           exit 3
 *   4. its source.quote found verbatim in that text after whitespace
 *      and typography folding (lib/event-rules.ts `verbatimIn`); in a
 *      PDF also across line-end hyphenation, and the page is printed  exit 4
 * Nothing is written unless every row passes. Then the rows are appended to
 * `config/candidates/<facet>.json`, the file sorted by row key, and with
 * `--branch` committed on `data/<facet>-<key>` with a PR body printed.
 *
 * Duplicates are checked before the network so a re-run is cheap: running the
 * same input twice changes nothing and exits 5.
 *
 * Decided: docs/architecture/2026-10-23-knowledge-system.md, §3.3.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { COVERAGE } from '../../config/substrata-coverage';
import { EVENTS } from '../../config/substrata-events';
import { FACILITIES } from '../../config/substrata-facilities';
import { OWNERSHIP } from '../../config/substrata-ownership';
import { INSTRUMENTS } from '../../config/substrata-policy';
import { ENDOWMENTS } from '../../config/substrata-quantities';
import { SCIENCE } from '../../config/substrata-science';
import { evidenceKey } from '../../config/substrata-evidence';
import { FACETS, isFacet, type CandidateCommon, type Facet } from '../../lib/entry/candidate';
import { FACET_SPECS } from '../../lib/entry/schemas';
import { printedSchema, shapeOf } from '../../lib/entry/shape';
import { verbatimIn } from '../../lib/event-rules';
import { readDocument } from '../../lib/sources/document';
import { findQuoteInPages } from '../../lib/sources/pdf';
import { corpusSeries } from '../../lib/series';
import { allRelations } from '../../lib/graph/index';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

export const EXIT = { ok: 0, usage: 1, schema: 2, unreachable: 3, quote: 4, duplicate: 5 } as const;

/** What the page reader returns: its text (a PDF's also page by page), or why it could not be read. */
export type PageRead = { ok: true; text: string; pages?: string[] } | { ok: false; reason: string };

export interface AddDeps {
  /** Read a source page. Defaults to ai-kit's SSRF-guarded reader. */
  read?: (url: string) => Promise<PageRead>;
  /** Where the sidecars live. Defaults to config/candidates. */
  candidatesDir?: string;
  /** Read stdin when the input is `-`. */
  stdin?: () => Promise<string>;
  log?: (line: string) => void;
}

/** Keys of the rows the corpus already has, candidates included, per facet. */
function corpusKeys(facet: Facet): Set<string> {
  switch (facet) {
    case 'producers':
      return new Set(
        COVERAGE.flatMap((c) => c.producers.map((p) => evidenceKey(c.material, p.name))),
      );
    case 'events':
      return new Set(EVENTS.map((e) => e.id));
    case 'endowments':
      return new Set(ENDOWMENTS.map((e) => `${e.material}/${e.place}/${e.stage}`));
    case 'facilities':
      return new Set(FACILITIES.map((f) => f.id));
    case 'instruments':
      return new Set(INSTRUMENTS.map((i) => i.id));
    case 'science':
      return new Set(SCIENCE.map((s) => s.id));
    case 'ownership':
      return new Set(OWNERSHIP.flatMap((o) => o.holders.map((h) => `${o.company}/${h.name}`)));
    case 'series-points':
      return new Set(corpusSeries().flatMap((s) => s.points.map((p) => `${s.id}/${p.date}`)));
    case 'relations':
      return new Set(allRelations().map((r) => r.id));
  }
}

/**
 * Read a source through lib/sources/document: HTML as readable text, JSON as
 * served, a PDF page by page. Three tries for a transient failure.
 */
async function readSource(url: string): Promise<PageRead> {
  let last = 'not read';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const doc = await readDocument(url);
    if (doc.ok) return { ok: true, text: doc.text, ...(doc.pages ? { pages: doc.pages } : {}) };
    last = doc.reason;
    if (!doc.transient) break;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  return { ok: false, reason: last };
}

/** Where the quote stands: `''` on a page, ` (page N)` in a PDF, or null when absent. */
function quoteAt(quote: string, page: { text: string; pages?: string[] }): string | null {
  if (page.pages) {
    const hit = findQuoteInPages(quote, page.pages);
    return hit ? (hit.page ? ` (page ${hit.page})` : ' (across a page break)') : null;
  }
  return verbatimIn(quote, page.text) === null ? null : '';
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const USAGE = `usage: add.ts <facet> <rows.json|-> [--dry-run] [--branch]
       add.ts <facet> --schema | --json-schema
facets: ${FACETS.join(' | ')}`;

/** Runs the gate; returns the exit code. Exported so the test can drive it against a local server. */
export async function run(argv: string[], deps: AddDeps = {}): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const [facet, input] = argv.filter((a) => !a.startsWith('--'));
  if (!facet || !isFacet(facet)) {
    log(USAGE);
    return EXIT.usage;
  }
  if (flags.has('--schema')) {
    log(shapeOf(facet));
    return EXIT.ok;
  }
  if (flags.has('--json-schema')) {
    log(JSON.stringify(printedSchema(facet), null, 2));
    return EXIT.ok;
  }
  if (!input) {
    log(USAGE);
    return EXIT.usage;
  }

  const spec = FACET_SPECS[facet];
  const raw = input === '-' ? await (deps.stdin ?? readStdin)() : await readFile(input, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    log(`SCHEMA  input is not JSON: ${(error as Error).message}`);
    return EXIT.schema;
  }
  const incoming = Array.isArray(parsed) ? parsed : [parsed];
  if (incoming.length === 0) {
    log('SCHEMA  no rows given');
    return EXIT.schema;
  }

  // 1. Schema.
  const rows: CandidateCommon[] = [];
  let schemaFailed = false;
  const today = new Date().toISOString().slice(0, 10);
  incoming.forEach((row, i) => {
    const result = spec.schema.safeParse(row);
    if (!result.success) {
      schemaFailed = true;
      for (const issue of result.error.issues)
        log(`SCHEMA  row ${i}: ${issue.path.join('.') || '(row)'}: ${issue.message}`);
      return;
    }
    const ok = result.data as CandidateCommon;
    if (ok.asOf > today || ok.source.readOn > today) {
      schemaFailed = true;
      log(`SCHEMA  row ${i}: asOf and readOn cannot be after today (${today})`);
      return;
    }
    rows.push(ok);
  });
  if (schemaFailed) return EXIT.schema;

  // 2. Duplicates — against the corpus, the sidecar, and the input itself.
  const dir = deps.candidatesDir ?? path.join(ROOT, 'config/candidates');
  const target = path.join(dir, `${facet}.json`);
  const current = JSON.parse(await readFile(target, 'utf8')) as CandidateCommon[];
  const seen = new Set([...corpusKeys(facet), ...current.map(spec.key)]);
  let duplicate = false;
  for (const row of rows) {
    const key = spec.key(row);
    if (seen.has(key)) {
      duplicate = true;
      log(`DUPLICATE  ${key} is already in the corpus or ${path.relative(ROOT, target)}`);
    }
    seen.add(key);
  }
  if (duplicate) return EXIT.duplicate;

  // 3 + 4. The page, and the quote on it.
  const read = deps.read ?? readSource;
  const pages = new Map<string, PageRead>();
  let unreachable = false;
  let absent = false;
  for (const row of rows) {
    const { url, quote } = row.source;
    if (!pages.has(url)) pages.set(url, await read(url));
    const page = pages.get(url)!;
    if (!page.ok) {
      unreachable = true;
      log(`UNREACHABLE  ${spec.key(row)}: ${url} — ${page.reason}`);
    } else {
      const at = quoteAt(quote, page);
      if (at === null) {
        absent = true;
        log(`QUOTE ABSENT  ${spec.key(row)}: the quote is not word for word on ${url}`);
      } else log(`ok  ${spec.key(row)}${at}`);
    }
  }
  if (unreachable) return EXIT.unreachable;
  if (absent) return EXIT.quote;

  if (flags.has('--dry-run')) {
    log(`${rows.length} row(s) pass every gate (dry run, nothing written).`);
    return EXIT.ok;
  }

  // 5. Append, sorted by key.
  const next = [...current, ...rows].sort((a, b) => spec.key(a).localeCompare(spec.key(b)));
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`);
  try {
    execFileSync('pnpm', ['exec', 'prettier', '--write', target], { stdio: 'ignore', cwd: ROOT });
  } catch {
    // Formatting is a courtesy; `pnpm run format:check` in CI is the gate.
  }
  log(`${rows.length} row(s) added to ${path.relative(ROOT, target)}.`);

  if (flags.has('--branch')) {
    const branch = `data/${facet}-${slug(spec.key(rows[0]))}`;
    const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, stdio: 'pipe' });
    git('switch', '-c', branch);
    git('add', path.relative(ROOT, target));
    const subject = `data(${facet}): ${rows.length} candidate row(s)`;
    const runIds = [...new Set(rows.map((r) => r.submittedBy.runId))].join(', ');
    git('commit', '-m', `${subject}\n\nAdded through scripts/research/add.ts, run ${runIds}.`);
    log(`Committed on ${branch}. PR body:\n`);
    log(
      [
        `Candidate rows for \`${facet}\`, added through \`scripts/research/add.ts\` (every quote found verbatim on its page).`,
        '',
        ...rows.map((r) => `- **${spec.key(r)}** — ${r.source.url}\n  > ${r.source.quote}`),
      ].join('\n'),
    );
  } else {
    log('Next: pnpm test, then commit on a branch (or re-run with --branch) and open a PR.');
  }
  return EXIT.ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
