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
 * - any other named system: the careers page still carries that system's mark
 *   (`myworkdayjobs`, `successfactors`, `snar.jp`, …) in its HTML or the URL it
 *   redirected to — or, when the served HTML does not (a page drawn by script,
 *   or one that refuses a plain request), in the page as Chromium draws it:
 *   every frame and every URL it loads;
 * - `in-house`: the careers page answers and reads as a careers page;
 * - `unknown` or no careers page (the record says something is NOT there):
 *   that is still so — the page links no careers page, or the site still does
 *   not answer, or every host the evidence names still does not answer.
 *
 * `--write` sets `checkedOn` to today ONLY on records that held in this run,
 * and the file's own `checkedOn` (what config/substrata-freshness.ts judges)
 * to the OLDEST record date — never newer than its least recently checked row.
 * Every record that did not hold keeps its date and is listed for a person.
 * `--only=<slug,slug>` limits the run.
 *
 * The browser is the workspace's Playwright (a dev dependency of
 * packages/chartkit; `CHROMIUM_PATH` picks the binary). Without one, only the
 * served HTML is read and pages drawn by script stay unconfirmed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

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
  'other:ukg-ready': /ukg|ultipro|kronos|saashr/i,
  'other:cornerstone': /csod|cornerstone/i,
  'other:hotjob': /hotjob/i,
  'other:wechat': /招聘/,
};

function markFor(ats: string): RegExp | null {
  if (MARKS[ats]) return MARKS[ats];
  if (ats === 'greenhouse' || ats === 'lever' || ats === 'ashby') return new RegExp(ats, 'i');
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

/** The page as a browser draws it: every frame's HTML, every URL it loaded, every link. */
async function rendered(url: string): Promise<{ ok: boolean; text: string; why: string }> {
  const page = await browserPage();
  if (!page) return { ok: false, text: '', why: 'no browser here' };
  const urls: string[] = [];
  const onRequest = (r: { url(): string }) => urls.push(r.url());
  page.on('request', onRequest);
  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(4_000);
    const status = response?.status() ?? 0;
    if (status >= 400) return { ok: false, text: '', why: `HTTP ${status} in a browser` };
    const frames = await Promise.all(page.frames().map((f) => f.content().catch(() => '')));
    return { ok: true, text: [page.url(), ...urls, ...frames].join('\n'), why: '' };
  } catch (error) {
    return { ok: false, text: '', why: `browser: ${(error as Error).message.split('\n')[0]}` };
  } finally {
    page.off('request', onRequest);
  }
}

/** The little of Playwright this uses; it is a dev dependency of packages/chartkit, not of the app. */
interface Page {
  goto(url: string, o: object): Promise<{ status(): number } | null>;
  on(event: 'request', f: (r: { url(): string }) => void): void;
  off(event: 'request', f: (r: { url(): string }) => void): void;
  frames(): { content(): Promise<string> }[];
  url(): string;
  waitForTimeout(ms: number): Promise<void>;
}
interface Chromium {
  launch(o: object): Promise<{ newPage(o: object): Promise<Page>; close(): Promise<void> }>;
}
let pagePromise: Promise<Page | null> | null = null;
let closeBrowser = async () => {};
/** One Chromium for the run, from the workspace's Playwright; none when it is not installed. */
function browserPage(): Promise<Page | null> {
  pagePromise ??= (async () => {
    try {
      const require = createRequire(
        new URL('../../packages/chartkit/package.json', import.meta.url),
      );
      const { chromium } = require('playwright') as { chromium: Chromium };
      const browser = await chromium.launch(
        process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
      );
      closeBrowser = () => browser.close();
      return await browser.newPage({ userAgent: AGENTS[0] });
    } catch {
      return null;
    }
  })();
  return pagePromise;
}

/** Host-and-path tokens in the evidence, e.g. "asml.wd3.myworkdayjobs.com/ASMLEXT1/...". */
const PLACES = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[\w.%=?&-]+)*/gi;

/** Hosts a record names, e.g. "fangyuan.com.cn does not resolve". */
const HOSTS = /\b(?:[a-z0-9-]+\.)+(?:com|cn|net|org|jp|kr|de|ch|io|co)(?:\.[a-z]{2})?\b/gi;

/**
 * A record that says something is NOT there: no careers page found, or the
 * site is gone. It holds while that is still so — the hosts it names still do
 * not answer, or the page it names still links no careers page.
 */
async function checkAbsence(r: BoardRecord): Promise<string | null> {
  if (!r.careersUrl) {
    const hosts = [...new Set(r.evidence.match(HOSTS) ?? [])];
    if (hosts.length === 0) return 'no careers page and no site named (re-open by hand)';
    for (const host of hosts) if ((await open(`https://${host}/`)).ok) return `${host} now answers`;
    return null;
  }
  const page = await open(r.careersUrl);
  if (!page.ok) return null;
  const drawn = await rendered(r.careersUrl);
  const html = drawn.ok ? drawn.text : page.html;
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const careers = links.find(([, href, text]) => CAREERS.test(href) || CAREERS.test(text));
  return careers ? `the page now links ${careers[1].slice(0, 80)}` : null;
}

/** Null when the record held; otherwise why it could not be confirmed. */
async function check(r: BoardRecord): Promise<string | null> {
  if (r.ats === 'unknown' || !r.careersUrl) return checkAbsence(r);
  const api = BOARD_API[r.ats];
  if (api) {
    if (!r.board) return `no ${r.ats} board token`;
    const b = await open(api(r.board));
    if (!b.ok) return `${r.ats} board ${r.board}: ${b.why}`;
  }
  const page = await open(r.careersUrl);
  if (page.ok && api) return null;
  const mark = r.ats === 'in-house' ? CAREERS : markFor(r.ats);
  if (!mark) return `no mark known for ${r.ats}`;
  if (page.ok && (mark.test(page.at) || mark.test(page.html))) return null;
  // Not in the served HTML, or refused to a script: open it as a browser would.
  const drawn = await rendered(r.careersUrl);
  if (!page.ok && !drawn.ok) return `careers page: ${page.why}; ${drawn.why}`;
  if (api || (drawn.ok && mark.test(drawn.text))) return null;
  // The system is often one click in (a job's Apply button, a jobs subdomain):
  // a site the evidence names must still answer, and still show that system.
  const places = [...new Set(r.evidence.match(PLACES) ?? [])].filter((t) => !t.includes('...'));
  for (const at of places.slice(0, 5)) {
    const tenant = await open(`https://${at.replace(/[./]+$/, '')}`);
    if (tenant.ok && (mark.test(tenant.at) || mark.test(tenant.html))) return null;
  }
  const what = r.ats === 'in-house' ? 'a careers page' : r.ats;
  return `neither the careers page (drawn in a browser) nor the tenant it names shows ${what}`;
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
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',');
  for (const [slug, record] of Object.entries(file.companies)) {
    if (only && !only.includes(slug)) continue;
    const problem = await check(record);
    if (problem) failed.push(`${slug} [${record.ats}] ${problem}`);
    else {
      held += 1;
      if (write) record.checkedOn = today;
    }
  }
  await closeBrowser();
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
