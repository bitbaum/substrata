/**
 * The research engine: look for a primary source behind every unverified
 * producer row, and file what it finds as evidence.
 *
 *   pnpm research:source              every unverified row not yet examined
 *   pnpm research:source --all        re-examine every unverified row
 *   pnpm research:source --limit 10   stop after N rows (for a quick run)
 *   pnpm research:source --material "Neon, excimer laser grade"
 *
 * What it does, per row: build a query from the company name and the material's
 * trade name, search through ai-kit's web layer, read the results through its
 * SSRF-checked page reader, and keep a page as a candidate only if its text
 * carries the company name AND a material term in the same window. The excerpt
 * around the match is filed with the URL.
 *
 * What it does not do: flip a row to "sourced". The coverage file is the
 * project's claim and a person promotes a candidate by reading the excerpt and
 * attaching the URL there. The engine narrows the search; it does not lower the
 * bar. The judgement itself — the query, the domain-ranking, the excerpt match
 * — lives in `lib/source.ts`, shared with the scheduled run
 * (`app/api/cron/source`) for the same reason `lib/sweep.ts` is shared with
 * the event sweep's: a second copy of "what counts as a match" living in an
 * API route is how the timer and this CLI would quietly stop agreeing. This
 * file keeps what is genuinely its own: argument parsing, the evidence FILE
 * (the timer writes to a database queue instead — see `lib/source-store.ts`
 * for why), and the blindness-streak guard below.
 *
 * ---------------------------------------------------------------------------
 * THE BUG THIS FILE ALREADY HAD, AND THE GUARD THAT NOW PREVENTS IT
 *
 * The first full run filed 33 rows as "nothing" — including `"Air Liquide"
 * helium` and `"MP Materials" rare earth`, which cannot plausibly return zero
 * results. The timestamps gave it away: 18 of those rows completed in under
 * three seconds, which is the inter-row pause plus a search and no page read at
 * all. The shared SearXNG instance had started answering HTTP 200 with an empty
 * result list. ai-kit reports that as `nothing`, correctly — the request
 * succeeded — and `nothing` is not `could_not_look`, so the outage guard below
 * never fired and a backend brownout was recorded as an absence of producers.
 *
 * That is the precise failure this engine's three-valued design exists to stop,
 * and it still happened, because the third value was attached to the wrong
 * signal. So: a run of consecutive empty searches is now treated as blindness
 * rather than as evidence. An engine that cannot tell "nobody makes this" from
 * "I could not see" is worse than no engine.
 * ---------------------------------------------------------------------------
 *
 * Needs SEARXNG_URL (or a Brave / Tavily key) in the environment. The fleet's
 * SearXNG listens on the box's loopback only; from a laptop, tunnel it:
 *   ssh -N -L 8899:127.0.0.1:8899 ubuntu@167.233.22.31 &
 *   SEARXNG_URL=http://127.0.0.1:8899 pnpm research:source
 *
 * Created: 2026-09-14
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { examineRow, unsourcedRows } from '../../lib/source';
import {
  evidenceKey,
  type EvidenceFile,
  type EvidenceRow,
  type EvidenceStatus,
} from '../../config/substrata-evidence';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = path.resolve(HERE, '../../research/evidence.json');

/** Sequential, with a pause: the SearXNG instance is shared and the sites are not ours. */
const PAUSE_BETWEEN_ROWS_MS = 2500;
/** Consecutive empty searches before we conclude we are blind rather than alone. */
const EMPTY_RUN_IS_BLINDNESS = 3;

interface Args {
  all: boolean;
  limit: number | null;
  material: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { all: false, limit: null, material: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--material') args.material = argv[++i] ?? null;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function loadEvidence(): Promise<EvidenceFile> {
  const raw = JSON.parse(await readFile(EVIDENCE_PATH, 'utf8')) as EvidenceFile;
  if (raw.version !== 1)
    throw new Error(`evidence.json is version ${raw.version}; this engine writes version 1`);
  return raw;
}

async function saveEvidence(file: EvidenceFile): Promise<void> {
  file.rows.sort(
    (a, b) => a.material.localeCompare(b.material) || a.producer.localeCompare(b.producer),
  );
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(file, null, 2)}\n`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const evidence = await loadEvidence();
  const examined = new Set(evidence.rows.map((row) => evidenceKey(row.material, row.producer)));

  const queue = unsourcedRows()
    .filter(({ material }) => args.material === null || material === args.material)
    .filter(
      ({ material, producer }) => args.all || !examined.has(evidenceKey(material, producer.name)),
    )
    .slice(0, args.limit ?? undefined);

  if (queue.length === 0) {
    console.log('Nothing to examine: every unverified row already has an entry (use --all).');
    return;
  }
  console.log(`Examining ${queue.length} row(s).`);

  let blindStreak = 0;
  let emptyStreak = 0;
  const pending: EvidenceRow[] = [];

  /**
   * Write a row into the file — but never replace a better one with a worse.
   *
   * `--all` re-examines rows that already had candidates. The first attempt at
   * this overwrote three good rows with failed looks when the search backend
   * hiccuped mid-run, which is the same mistake as filing a brownout as an
   * absence: a look that failed today says nothing about a page that was read
   * successfully yesterday. So a new result only replaces the stored one when
   * it is at least as informative.
   */
  const RANK: Record<EvidenceStatus, number> = {
    candidate: 2,
    nothing: 1,
    could_not_look: 0,
  };
  const record = (row: EvidenceRow) => {
    const key = evidenceKey(row.material, row.producer);
    const at = evidence.rows.findIndex((r) => evidenceKey(r.material, r.producer) === key);
    if (at < 0) {
      evidence.rows.push(row);
      return;
    }
    const stored = evidence.rows[at];
    if (RANK[row.status] < RANK[stored.status]) {
      console.log(
        `      keeping the earlier ${stored.status} for ${row.producer} — this look was worse`,
      );
      return;
    }
    evidence.rows[at] = row;
  };

  for (const [index, item] of queue.entries()) {
    const { row, searchWasEmpty } = await examineRow(item.producer, item.material);

    if (searchWasEmpty) {
      emptyStreak += 1;
      pending.push(row);
      // A run of empty searches is a dark backend, not an empty world. Rewrite
      // the whole run as "could not look" so nobody reads it as a finding.
      if (emptyStreak >= EMPTY_RUN_IS_BLINDNESS) {
        for (const stale of pending) record({ ...stale, status: 'could_not_look', candidates: [] });
        pending.length = 0;
        console.error(
          `Search returned nothing ${emptyStreak} rows running — treating this as blindness, ` +
            'not as an absence of producers. Stopping so the run can be repeated.',
        );
        evidence.generatedAt = new Date().toISOString();
        await saveEvidence(evidence);
        break;
      }
    } else {
      // The streak broke, so the empties before it were real: keep them as filed.
      for (const real of pending) record(real);
      pending.length = 0;
      emptyStreak = 0;
      record(row);
    }

    const summary =
      row.status === 'candidate'
        ? `${row.candidates.length} candidate page(s)`
        : row.status === 'nothing'
          ? searchWasEmpty
            ? 'search returned nothing'
            : 'read pages, none usable'
          : 'could not look';
    console.log(`[${index + 1}/${queue.length}] ${row.producer} — ${row.material}: ${summary}`);

    if (row.status === 'could_not_look') {
      if (++blindStreak >= EMPTY_RUN_IS_BLINDNESS) {
        console.error('Search backend unreachable three rows running — stopping.');
        break;
      }
    } else {
      blindStreak = 0;
    }

    evidence.generatedAt = new Date().toISOString();
    await saveEvidence(evidence);
    if (index < queue.length - 1) await sleep(PAUSE_BETWEEN_ROWS_MS);
  }

  for (const leftover of pending) record(leftover);
  await saveEvidence(evidence);

  const totals = evidence.rows.reduce(
    (acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }),
    {} as Record<EvidenceStatus, number>,
  );
  console.log(
    `Evidence file holds ${evidence.rows.length} row(s): ` +
      `${totals.candidate ?? 0} with candidates, ${totals.nothing ?? 0} read but nothing usable, ` +
      `${totals.could_not_look ?? 0} could not look.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
