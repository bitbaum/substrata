/**
 * Re-opens each company's careers page in research/job-boards.json and checks
 * that the record still holds: the page answers, and the applicant-tracking
 * system the record names is still what it is served by.
 *
 *   pnpm tsx scripts/research/check-job-boards.ts            # report
 *   pnpm tsx scripts/research/check-job-boards.ts --write    # report, then date what held
 *
 * A record holds when
 * - Greenhouse / Lever / Ashby: the board's public API answers for its token
 *   AND the careers page answers;
 * - any other named system: the careers page answers and its HTML (or the URL
 *   it redirected to) still carries that system's mark (`myworkdayjobs`,
 *   `successfactors`, `snar.jp`, …);
 * - `in-house`: the careers page answers and reads as a careers page.
 *
 * `--write` sets `checkedOn` to today ONLY on records that held in this run,
 * and the file's own `checkedOn` (what config/substrata-freshness.ts judges)
 * to the OLDEST record date — never newer than its least recently checked row.
 * Records with no careers page, or whose system is `unknown`, assert an
 * absence a fetch cannot confirm, and pages that render their links with
 * JavaScript carry no mark in their HTML: those keep their date and are
 * listed, for a person to re-open.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { AGENTS } from '../../lib/quality/page-text';

const FILE = new URL('../../research/job-boards.json', import.meta.url);

interface BoardRecord {
  careersUrl: string | null;
  ats: string;
  board: string | null;
  evidence: string;
  checkedOn: string;
}

/** What a system leaves in a page that links to it. */
const MARKS: Record<string, RegExp> = {
  workday: /myworkdayjobs|workday/i,
  successfactors: /successfactors|sapsf|rmkcdn|jobs\.sap\.com/i,
  icims: /icims/i,
  smartrecruiters: /smartrecruiters/i,
  taleo: /taleo/i,
  'other:adp-workforce-now': /workforcenow|adp\.com/i,
  'other:adp': /workforcenow|adp\.com/i,
  'other:martianlogic': /martianlogic|myrecruitmentplus/i,
  'other:sonar-ats': /snar\.jp/i,
  'other:sonar': /snar\.jp/i,
  'other:job-shop': /job-shop|jobshop/i,
  'other:i-web': /i-webs?\.jp|i-web/i,
  'other:oracle-cloud-hcm': /oraclecloud/i,
  'other:oracle-hcm': /oraclecloud/i,
  'other:ukg-ready': /ukg|ultipro|kronos/i,
  'other:cornerstone': /csod|cornerstone/i,
  'other:hotjob': /hotjob/i,
  'other:wechat': /招聘/,
};

function markFor(ats: string): RegExp | null {
  if (MARKS[ats]) return MARKS[ats];
  if (!ats.startsWith('other:')) return null;
  const name = ats.slice(6).replace(/-/g, '[-. ]?');
  return new RegExp(name, 'i');
}

const CAREERS = /career|job|recruit|vacanc|stellen|karriere|emploi|採用|招聘|채용|인재/i;

async function open(url: string): Promise<{ ok: boolean; html: string; at: string; why: string }> {
  let why = '';
  for (const agent of AGENTS) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': agent, Accept: 'text/html,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });
      if (r.ok) return { ok: true, html: await r.text(), at: r.url, why: '' };
      why = `HTTP ${r.status}`;
    } catch (error) {
      const cause = ((error as Error).cause as Error | undefined)?.message;
      why = `${(error as Error).message}${cause ? ` (${cause})` : ''}`;
    }
  }
  return { ok: false, html: '', at: url, why };
}

const BOARD_API: Partial<Record<string, (board: string) => string>> = {
  greenhouse: (b) => `https://boards-api.greenhouse.io/v1/boards/${b}`,
  lever: (b) => `https://api.lever.co/v0/postings/${b}?mode=json&limit=1`,
  ashby: (b) => `https://api.ashbyhq.com/posting-api/job-board/${b}`,
};

/** Null when the record held; otherwise why it could not be confirmed. */
async function check(r: BoardRecord): Promise<string | null> {
  if (!r.careersUrl) return 'no careers page on record (an absence; re-open by hand)';
  if (r.ats === 'unknown') return 'system unknown (an absence; re-open by hand)';
  const api = BOARD_API[r.ats];
  if (api) {
    if (!r.board) return `no ${r.ats} board token`;
    const b = await open(api(r.board));
    if (!b.ok) return `${r.ats} board ${r.board}: ${b.why}`;
  }
  const page = await open(r.careersUrl);
  if (!page.ok) return `careers page: ${page.why}`;
  if (api) return null;
  const mark = r.ats === 'in-house' ? CAREERS : markFor(r.ats);
  if (!mark) return `no mark known for ${r.ats}`;
  return mark.test(page.at) || mark.test(page.html)
    ? null
    : `careers page HTML does not show ${r.ats === 'in-house' ? 'a careers page' : r.ats} (moved, or drawn by script)`;
}

async function main() {
  const write = process.argv.includes('--write');
  const file = JSON.parse(readFileSync(FILE, 'utf8')) as {
    version: number;
    checkedOn: string;
    companies: Record<string, BoardRecord>;
  };
  const today = new Date().toISOString().slice(0, 10);
  const failed: string[] = [];
  let held = 0;
  for (const [slug, record] of Object.entries(file.companies)) {
    const problem = await check(record);
    if (problem) failed.push(`${slug} [${record.ats}] ${problem}`);
    else {
      held += 1;
      if (write) record.checkedOn = today;
    }
  }
  console.log(`${held} records held; ${failed.length} not confirmed`);
  for (const line of failed) console.log(`NOT CONFIRMED  ${line}`);
  if (write) {
    file.checkedOn = Object.values(file.companies)
      .map((r) => r.checkedOn)
      .sort()[0];
    writeFileSync(FILE, `${JSON.stringify(file, null, 2)}\n`);
    console.log(
      `records held re-dated ${today}; file checkedOn = oldest record, ${file.checkedOn}`,
    );
  }
}

void main();
