/**
 * The daily fetch of open roles into research_jobs.
 *
 * One request per board, a second apart (Lever's robots.txt asks for a
 * one-second crawl delay; the others ask for nothing and get the same). A
 * board that fails leaves its postings as they were — a network error is not
 * every job on it closing. A board that answers closes whatever it no longer
 * lists. Reads are lib/careers-query.ts.
 */
import { database } from './db';
import { classify, type Posting } from './careers';
import { boardUrl, parseBoard } from './careers-ats';
import { liveBoards } from './job-boards';

const USER_AGENT = 'Substrata research (https://substrata.orangecat.ch; cato@orangecat.ch)';
const GAP_MS = 1_000;

export interface JobRun {
  boards: number;
  seen: number;
  jobsNew: number;
  closed: number;
  failed: number;
}

async function upsert(slug: string, p: Posting): Promise<boolean> {
  const result = await database().query<{ inserted: boolean }>(
    `INSERT INTO research_jobs
       (id, company_slug, company, title, location, countries, remote, department,
        family, seniority, bottlenecks, skills, posted_at, url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, location = EXCLUDED.location, countries = EXCLUDED.countries,
       remote = EXCLUDED.remote, department = EXCLUDED.department, family = EXCLUDED.family,
       seniority = EXCLUDED.seniority, bottlenecks = EXCLUDED.bottlenecks,
       skills = EXCLUDED.skills, posted_at = EXCLUDED.posted_at, url = EXCLUDED.url,
       last_seen = now(), closed_at = NULL
     RETURNING (xmax = 0) AS inserted`,
    [
      p.id,
      slug,
      p.company,
      p.title,
      p.location,
      p.countries,
      p.remote,
      p.department,
      p.family,
      p.seniority,
      p.bottlenecks,
      p.skills,
      p.postedAt,
      p.url,
    ],
  );
  return result.rows[0]?.inserted === true;
}

export async function fetchJobs(): Promise<JobRun> {
  const db = database();
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_job_runs DEFAULT VALUES RETURNING id',
  );
  const outcome: JobRun = { boards: 0, seen: 0, jobsNew: 0, closed: 0, failed: 0 };

  for (const b of liveBoards()) {
    outcome.boards += 1;
    try {
      const response = await fetch(boardUrl(b.ats, b.board), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(String(response.status));
      const postings = parseBoard(b.ats, b.board, b.company, await response.json()).map(classify);
      const ids: string[] = [];
      for (const p of postings) {
        ids.push(p.id);
        if (await upsert(b.slug, p)) outcome.jobsNew += 1;
      }
      outcome.seen += postings.length;
      // An empty answer is more often a changed format than a company that
      // stopped hiring overnight; closing everything on it would be a guess.
      if (postings.length === 0) continue;
      const closed = await db.query(
        `UPDATE research_jobs SET closed_at = now()
          WHERE id LIKE $1 AND closed_at IS NULL AND NOT (id = ANY($2::text[]))`,
        [`${b.ats}:${b.board}:%`, ids],
      );
      outcome.closed += closed.rowCount ?? 0;
    } catch {
      outcome.failed += 1;
    } finally {
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
  }

  await db.query(
    `UPDATE research_job_runs
        SET finished_at = now(), boards = $2, seen = $3, jobs_new = $4, closed = $5, failed = $6
      WHERE id = $1`,
    [run.rows[0].id, outcome.boards, outcome.seen, outcome.jobsNew, outcome.closed, outcome.failed],
  );
  return outcome;
}
