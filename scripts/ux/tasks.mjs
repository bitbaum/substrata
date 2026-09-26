/**
 * The top tasks per audience, with what "done" means for each.
 *
 * This file is the criteria. Each task names who it is for, the one question
 * they arrive with, what counts as answered, and two budgets: steps (clicks,
 * keystrokes into a field, choices, and screens of scrolling — see
 * harness.mjs) and seconds to the first useful answer. A task passes only
 * when it is answered within both budgets. `run.mjs` drives each flow at a
 * phone and a desktop width; the budgets are the same for both on purpose,
 * because a phone reader has the same question.
 *
 * A flow uses only what a first-time visitor can see: visible labels and
 * roles, never test ids, so a flow that passes is a path a person could find.
 */

const TICKERS = [
  'NVDA US',
  'TSM US',
  'ASML NA',
  '8035 JP',
  'AMAT US',
  'MU US',
  'GEV US',
  'AVGO US',
  'LRCX US',
  'KLAC US',
].join('\n');

const EUROPE = new Set(
  'AT BE BG CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LT LU LV MT NL NO PL PT RO SE SI SK'.split(
    ' ',
  ),
);

export const TASKS = [
  {
    id: 'xray-top-risk',
    audience: 'Fund analyst',
    task: 'Pastes 10 tickers and finds their biggest single-source risk.',
    success:
      'The result names ONE biggest single-source risk (company, bottleneck, share of weight).',
    maxSteps: 3,
    maxSeconds: 8,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/xray');
      await ctx.fill(page.getByRole('textbox').first(), TICKERS, 'the holdings box');
      await ctx.click(page.getByRole('button', { name: /x-ray/i }), 'the X-ray button');
      return ctx.answer(page.getByText(/biggest single-source risk/i), 'the biggest risk');
    },
  },
  {
    id: 'xray-first-run',
    audience: 'Fund analyst, first visit',
    task: 'Has no list to hand and wants to see what the X-ray does.',
    success: 'One click on an example produces a full result.',
    maxSteps: 2,
    maxSeconds: 8,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/xray');
      await ctx.click(page.getByRole('button', { name: /sample|example/i }), 'the example');
      return ctx.answer(page.getByText(/holdings? read/i), 'the result summary');
    },
  },
  {
    id: 'scenario-taiwan',
    audience: 'Risk manager',
    task: 'Asks what breaks if Taiwan is cut off, and sends the answer to a colleague.',
    success: 'The count of bottlenecks hit is on screen and the link copies in one click.',
    maxSteps: 3,
    maxSeconds: 6,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/scenarios');
      await ctx.click(page.getByRole('link', { name: 'Taiwan is cut off' }), 'the Taiwan preset');
      const text = await ctx.answer(page.getByText(/hit directly/i), 'bottlenecks hit');
      const copy = await ctx.optional(page.getByRole('button', { name: /copy link/i }));
      if (!copy) throw new Error('No one-click way to share: the URL is printed as text.');
      await ctx.click(copy, 'copy link');
      return text;
    },
  },
  {
    id: 'gallium-moves',
    audience: 'Commodity trader',
    task: 'Sees what moved in gallium this month.',
    success: 'A gallium series with its latest change is on screen.',
    maxSteps: 3,
    maxSeconds: 6,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/data/series');
      const box = page.getByRole('searchbox').or(page.getByPlaceholder(/gallium/i));
      await ctx.fill(box, 'gallium', 'the search box');
      await ctx.press(box, 'Enter', 'to search');
      await page.waitForURL(/q=gallium/i, { timeout: 10_000 });
      const row = page.locator('li', { hasText: /gallium/i }).filter({ hasText: /%|vs /i });
      return ctx.answer(row, 'the first gallium move');
    },
  },
  {
    id: 'gallium-producers-csv',
    audience: 'Commodity trader',
    task: 'Gets who produces gallium, as a CSV.',
    success: 'The top producer and the CSV link are both on the first screen.',
    maxSteps: 1,
    maxSeconds: 4,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/resources/gallium');
      await ctx.answer(page.getByRole('link', { name: /csv/i }), 'the CSV link');
      return ctx.answer(page.locator('tbody tr').first(), 'the top producer row');
    },
  },
  {
    id: 'jobs-europe',
    audience: 'Job seeker',
    task: 'Finds process-engineer roles in Europe.',
    success: 'Process-engineering roles filtered to Europe, at least one listed.',
    maxSteps: 3,
    maxSeconds: 8,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/careers');
      const family = page.getByRole('combobox', { name: /role family/i });
      await ctx.select(family, { label: await optionLabel(family, /process/i) }, 'role family');
      await page.waitForURL(/family=/, { timeout: 10_000 });
      const where = page.getByRole('combobox', { name: /country|region|where/i });
      const europe = await optionLabel(where, /europe/i).catch(() => null);
      if (!europe) {
        const codes = await where.locator('option').evaluateAll((os) => os.map((o) => o.value));
        const n = codes.filter((c) => EUROPE.has(c)).length;
        throw new Error(`No Europe option: ${n} European countries to pick one at a time.`);
      }
      await ctx.select(where, { label: europe }, 'Europe');
      await page.waitForURL(/europe/i, { timeout: 10_000 });
      return ctx.answer(page.locator('.careers-job').first(), 'the first role');
    },
  },
  {
    id: 'exposure-sole-listed',
    audience: 'Fund analyst',
    task: 'Lists the listed companies that are the only recorded maker of a bottleneck, as a CSV.',
    success: 'The filtered table and its CSV link are on screen.',
    maxSteps: 4,
    maxSeconds: 8,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/exposure');
      await ctx.check(page.getByRole('checkbox', { name: /listed only/i }), 'Listed only');
      await page.waitForURL(/listed=1/, { timeout: 10_000 });
      await ctx.check(page.getByRole('checkbox', { name: /only recorded maker/i }), 'sole maker');
      await page.waitForURL(/sole=1/, { timeout: 10_000 });
      await ctx.answer(page.getByRole('link', { name: /csv/i }), 'the CSV link');
      return ctx.answer(page.locator('tbody tr').first(), 'the first row');
    },
  },
  {
    id: 'pipeline-new',
    audience: 'Researcher',
    task: 'Sees what is new in the science pipeline for advanced packaging.',
    success: 'The collected items for advanced packaging are on screen.',
    maxSteps: 3,
    maxSeconds: 6,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/science/pipeline');
      await ctx.click(
        page.getByRole('link', { name: /^advanced packaging capacity$/i }),
        'advanced packaging',
      );
      await page.waitForURL(/pipeline\/advanced-packaging/, { timeout: 10_000 });
      return ctx.answer(page.getByText(/collected by the feeds/i), 'the collected items');
    },
  },
  {
    id: 'follow-signed-out',
    audience: 'Reader',
    task: 'Wants to follow a bottleneck (then two more) and see what is new on them.',
    success: 'A follow action is on the bottleneck page, and signed out it says what to do.',
    maxSteps: 2,
    maxSeconds: 5,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/bottlenecks/gallium-refined');
      const follow = page
        .getByRole('link', { name: /follow/i })
        .or(page.getByRole('button', { name: /follow/i }));
      if (!(await ctx.optional(follow, 4_000))) {
        throw new Error('Signed out there is no follow action at all: a dead end.');
      }
      return ctx.answer(follow, 'the follow action');
    },
  },
  {
    id: 'update-news',
    audience: 'Reader',
    task: 'On a bottleneck page, gets the latest news now.',
    success: '"Update news now" is reachable within one screen of scrolling.',
    maxSteps: 1,
    maxSeconds: 5,
    async flow(ctx) {
      const { page } = ctx;
      await ctx.go('/bottlenecks/gallium-refined');
      return ctx.answer(page.getByRole('button', { name: /update news now/i }), 'Update news');
    },
  },
];

/** Every empty or error state must offer the next action, not only say what is missing. */
export const DEAD_ENDS = [
  { id: 'exposure-no-match', path: '/exposure?q=zzqxv', message: /no rows match/i },
  { id: 'careers-no-match', path: '/careers?q=zzqxv', message: /no open roles match/i },
  { id: 'series-no-match', path: '/data/series?q=zzqxv', message: /no series match/i },
  {
    id: 'xray-nothing-read',
    path: '/xray',
    message: /not a ticker|nothing (was |could be )?read|none of these/i,
    async setup(page) {
      await page.getByRole('textbox').first().fill('ZZQX\nQXVV');
      await page.getByRole('button', { name: /x-ray/i }).first().click();
    },
  },
  { id: 'resource-unknown', path: '/resources/unobtainium', message: /not found|could not|404/i },
];

async function optionLabel(select, pattern) {
  const labels = await select.locator('option').allInnerTexts();
  const hit = labels.find((l) => pattern.test(l));
  if (!hit) throw new Error(`No option matching ${pattern}`);
  return hit;
}
