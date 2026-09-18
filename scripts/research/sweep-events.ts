/**
 * The event sweep: for every bottleneck, what changed recently?
 *
 *   pnpm research:sweep                 every bottleneck
 *   pnpm research:sweep --limit 5       a quick run
 *   pnpm research:sweep --name "Neon, excimer laser grade"
 *
 * Per bottleneck: search the web (the fleet's SearXNG through ai-kit) for the
 * node's trade name with event words — shortage, expansion, plant, lead time,
 * export, licence — read the top results through the SSRF-checked reader,
 * and file each page whose text carries the node's term as a CANDIDATE event
 * with the excerpt, the search engine's published date where it gave one,
 * and a guessed effect from the words around the match.
 *
 * It never writes an accepted event. `config/substrata-events.ts` is the
 * analyst's file; the sweep's output is `research/events.json`, a worklist.
 * Three-valued like the source engine: a dead backend files could_not_look.
 *
 * Needs SEARXNG_URL (tunnel: ssh -N -L 8899:127.0.0.1:8899 ubuntu@167.233.22.31).
 *
 * Created: 2026-09-15
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// What counts as an event now lives in lib/sweep.ts, shared with the scheduled
// run, so the two cannot drift apart.
import { isNeverAnEvent, nodes, sweep } from '../../lib/sweep';
import type { EventsWorklist as EventsFile } from '../../config/substrata-events';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(HERE, '../../research/events.json');

const PAUSE_MS = 1500;

/** Words that mark a page as being about a change, not a product listing. */
interface Args {
  limit: number | null;
  name: string | null;
  /** Drop stored candidates the CURRENT filter would never have filed. */
  prune: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: null, name: null, prune: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--name') args.name = argv[++i] ?? null;
    else if (arg === '--prune') args.prune = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/** Every bottleneck with the term the trade uses for it. */

async function load(): Promise<EventsFile> {
  const raw = JSON.parse(await readFile(OUT_PATH, 'utf8')) as EventsFile;
  if (raw.version !== 1) throw new Error(`events.json is version ${raw.version}; expected 1`);
  return raw;
}

async function save(file: EventsFile): Promise<void> {
  file.candidates.sort(
    (x, y) =>
      x.bottleneck.localeCompare(y.bottleneck) ||
      (y.published ?? '').localeCompare(x.published ?? ''),
  );
  await writeFile(OUT_PATH, `${JSON.stringify(file, null, 2)}\n`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const file = await load();

  // The block list grows as the sweep learns what a market-report farm looks
  // like, but rows filed before a domain was added sit in the worklist forever
  // — a human cost, since every one of them has to be read and rejected by
  // hand. Pruning applies today's filter to yesterday's rows, from the same
  // list, so there is never a second definition of what counts as junk.
  if (args.prune) {
    const before = file.candidates.length;
    file.candidates = file.candidates.filter((c) => !isNeverAnEvent(c.url));
    const dropped = before - file.candidates.length;
    file.generatedAt = new Date().toISOString();
    await save(file);
    console.log(
      `Pruned ${dropped} candidate(s) the filter now rejects; ${file.candidates.length} left.`,
    );
    return;
  }

  const known = new Set(file.candidates.map((c) => c.id));

  const queue = nodes()
    .filter((n) => args.name === null || n.name === args.name)
    .slice(0, args.limit ?? undefined);
  console.log(`Sweeping ${queue.length} bottleneck(s).`);

  let couldNotLook = 0;
  let added = 0;
  for (const [index, node] of queue.entries()) {
    const found = await sweep(node);
    const fresh = found.filter((c) => !known.has(c.id));
    for (const c of fresh) {
      file.candidates.push(c);
      known.add(c.id);
    }
    added += fresh.filter((c) => c.status === 'candidate').length;
    const blind = found.some((c) => c.status === 'could_not_look');
    console.log(
      `[${index + 1}/${queue.length}] ${node.name}: ${blind ? 'could not look' : `${fresh.length} new candidate(s)`}`,
    );
    if (blind && ++couldNotLook >= 3) {
      console.error(
        'Search backend unreachable three nodes running — stopping. Is SEARXNG_URL set and tunnelled?',
      );
      break;
    }
    if (!blind) couldNotLook = 0;
    file.generatedAt = new Date().toISOString();
    await save(file);
    if (index < queue.length - 1) await sleep(PAUSE_MS);
  }
  console.log(`Filed ${added} new candidate event(s); ${file.candidates.length} in the worklist.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
