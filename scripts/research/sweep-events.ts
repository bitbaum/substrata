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

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webSearch, readPage } from '@bitbaum/ai-kit/web';

import { MATERIALS } from '../../config/substrata';
import { CHOKEPOINTS } from '../../config/substrata-coverage';
import type {
  CandidateEvent,
  EventEffect,
  EventsWorklist as EventsFile,
} from '../../config/substrata-events';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(HERE, '../../research/events.json');

const RESULTS_PER_NODE = 8;
const PAGES_PER_NODE = 4;
const EXCERPT_RADIUS = 200;
const PAUSE_MS = 1500;

/** Words that mark a page as being about a change, not a product listing. */
const EVENT_WORDS =
  'shortage OR expansion OR "new plant" OR "lead time" OR export OR licence OR license OR closure OR outage OR contract';

/**
 * Domains that never carry an event.
 *
 * A triage of the first 77 candidates found 54 were not events at all, and
 * almost all of that noise came from the same handful of sources: market-size
 * forecasts, SEO listicles, press-release wires and "industry outlook"
 * vendors. They rank well for exactly the terms this sweep searches, so they
 * crowd out the announcement that actually happened.
 *
 * This is a blocklist rather than an allowlist on purpose: a real event can
 * appear anywhere, and refusing everything unfamiliar would lose more than it
 * saves.
 */
const NEVER_AN_EVENT = [
  'researchandmarkets',
  'mordorintelligence',
  'precedenceresearch',
  'marketreportsworld',
  'markwideresearch',
  'maximizemarketresearch',
  'datainsightsreports',
  'datamintelligence',
  'globenewswire',
  'einpresswire',
  'linkedin.com',
  'techinsights.com',
  'patsnap.com',
  'gtaic.ai',
  'hdinresearch',
  'x.com',
  'youtube.com',
  'justetf.com',
  'wallstreet-online',
  'pitchbook.com',
  'unjobnet.org',
  'neonscience.org',
];

/**
 * Matched on a host boundary, not a substring.
 *
 * `host.includes('x.com')` is true of `semiconductorx.com` and
 * `simplytronix.com`, so the list was quietly discarding trade press it was
 * never meant to touch — invisibly, because a filtered result leaves no trace.
 *
 * The list mixes two spellings and both have to keep working: a full host
 * (`linkedin.com`) matches that host or a subdomain of it, and a bare name
 * (`researchandmarkets`) matches a whole label, so it catches every TLD the
 * same farm publishes under without also catching a name it is a substring of.
 */
function isNeverAnEvent(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return NEVER_AN_EVENT.some((bad) =>
      bad.includes('.') ? host === bad || host.endsWith(`.${bad}`) : host.split('.').includes(bad),
    );
  } catch {
    return true;
  }
}

const TIGHTENS =
  /shortag|delay|cut|halt|suspend|ban|restrict|control|licen[cs]e requir|liquidat|clos(e|ure|ing)|outage|fire|explosion|strike|sanction|tariff|backlog|sold out|wait(ing)? list|years? of lead/i;
const LOOSENS =
  /expan|new plant|new facilit|capacity|open(s|ed|ing)|commission|ramp|second source|agreement|approv|granted|breakthrough|recycl|ease|resum/i;

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
function nodes(): Array<{ name: string; term: string }> {
  return [
    ...MATERIALS.map((m) => ({ name: m.title, term: m.search })),
    ...CHOKEPOINTS.map((c) => ({ name: c.name, term: chokepointTerm(c.name) })),
  ];
}

/** "Large power transformer slots" → "large power transformer"; the last word is usually the count noun we added. */
function chokepointTerm(name: string): string {
  return name
    .replace(
      /\b(slots|order books|queues|capacity|yield|formulation|engineers|sintering|drives)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function guessEffect(text: string): EventEffect {
  const tight = TIGHTENS.test(text);
  const loose = LOOSENS.test(text);
  if (tight && !loose) return 'tightens';
  if (loose && !tight) return 'loosens';
  return 'neutral';
}

function excerptAround(text: string, term: string): string | null {
  const lower = text.toLowerCase();
  const at = lower.indexOf(term.toLowerCase());
  if (at < 0) return null;
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(text.length, at + term.length + EXCERPT_RADIUS);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function idFor(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}

async function sweep(node: { name: string; term: string }): Promise<CandidateEvent[]> {
  const foundAt = new Date().toISOString();
  const query = `"${node.term}" (${EVENT_WORDS}) 2026`;
  const search = await webSearch(query, { limit: RESULTS_PER_NODE, timeoutMs: 15_000 });

  if (search.status === 'could_not_look') {
    return [
      {
        id: idFor(`could_not_look:${node.name}:${foundAt}`),
        bottleneck: node.name,
        term: node.term,
        url: '',
        title: '',
        published: null,
        excerpt: '',
        effectGuess: 'neutral',
        foundAt,
        status: 'could_not_look',
      },
    ];
  }
  if (search.status === 'nothing') return [];

  const out: CandidateEvent[] = [];
  for (const result of search.results
    .filter((r) => !isNeverAnEvent(r.url))
    .slice(0, PAGES_PER_NODE)) {
    const page = await readPage(result.url, { timeoutMs: 15_000, maxChars: 60_000 });
    if (!page.ok) continue;
    const excerpt = excerptAround(page.text, node.term);
    if (!excerpt) continue;
    out.push({
      id: idFor(page.url),
      bottleneck: node.name,
      term: node.term,
      url: page.url,
      title: page.title || result.title,
      published: result.published ?? null,
      excerpt,
      effectGuess: guessEffect(excerpt),
      foundAt,
      status: 'candidate',
    });
  }
  return out;
}

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
