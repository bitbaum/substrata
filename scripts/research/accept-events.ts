/**
 * Carry events accepted at /review into the corpus file, for a commit.
 *
 *   pnpm run research:accept-events accepted-events.json   rows downloaded from /review/accepted
 *   pnpm run research:accept-events                        rows read from DATABASE_URL
 *   pnpm run research:accept-events --dry-run …            say what would change, write nothing
 *
 * The site's claim is that a row reached a page because a person accepted it
 * in a commit. Accepting at /review is the reading; this is the writing: it
 * appends each accepted row to `config/substrata-events-accepted.json`, which
 * `EVENTS` includes, and leaves the commit to you. Every row is checked with
 * the same rules the review page used (lib/event-rules.ts), rows already in
 * the corpus (same id or same source) are skipped, and `pnpm test` then runs
 * the corpus tests over the result.
 *
 * Why not a bot commit from the box: the box runs releases, not checkouts,
 * and holds no GitHub token. A person carrying the rows is the whole point.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EVENTS, type CoverageEvent } from '../../config/substrata-events';
import { eventProblems } from '../../lib/event-rules';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(HERE, '../../config/substrata-events-accepted.json');

async function incoming(file: string | undefined): Promise<CoverageEvent[]> {
  if (file) return JSON.parse(await readFile(file, 'utf8')) as CoverageEvent[];
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Give a file downloaded from /review/accepted, or set DATABASE_URL (e.g. through an ssh tunnel).',
    );
  }
  const { acceptedAwaitingCommit } = await import('../../lib/event-draft-store');
  const rows = await acceptedAwaitingCommit();
  const { database } = await import('../../lib/db');
  await database().end();
  return rows;
}

/** Fields in the order the hand-written rows use; jsonb hands them back sorted by length. */
function canonical(e: CoverageEvent): CoverageEvent {
  const { id, date, headline, kind, effect, bottlenecks, participants, jurisdictions } = e;
  const { source, primary, quote, acceptedOn } = e;
  return {
    id,
    date,
    headline,
    kind,
    effect,
    bottlenecks,
    participants,
    jurisdictions,
    source,
    primary,
    quote,
    acceptedOn,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const file = argv.find((a) => !a.startsWith('--'));
  const rows = await incoming(file);

  const current = JSON.parse(await readFile(TARGET, 'utf8')) as CoverageEvent[];
  const ids = new Set(EVENTS.map((e) => e.id));
  const sources = new Set(EVENTS.map((e) => e.source));
  const added: CoverageEvent[] = [];
  let refused = 0;

  for (const row of rows) {
    if (ids.has(row.id) || sources.has(row.source)) {
      console.log(`skip  ${row.id} — already in the corpus`);
      continue;
    }
    const problems = eventProblems(row);
    if (problems.length) {
      refused += 1;
      console.log(`REFUSE ${row.id}: ${problems.join(' ')}`);
      continue;
    }
    ids.add(row.id);
    sources.add(row.source);
    added.push(canonical(row));
    console.log(`add   ${row.id} — ${row.headline}`);
  }

  if (added.length && !dryRun) {
    await writeFile(TARGET, `${JSON.stringify([...current, ...added], null, 2)}\n`);
    execFileSync('pnpm', ['exec', 'prettier', '--write', TARGET], { stdio: 'ignore' });
  }
  console.log(
    `${added.length} added, ${refused} refused${dryRun ? ' (dry run, nothing written)' : ''}.`,
  );
  if (added.length && !dryRun) {
    console.log(
      'Next: pnpm test, then commit config/substrata-events-accepted.json on a branch and open a PR.',
    );
  }
  if (refused) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
