#!/usr/bin/env node
/**
 * Run every task flow at a phone and a desktop width and write the report.
 *
 *   node scripts/ux/run.mjs --base https://substrata.orangecat.ch --label after
 *   node scripts/ux/run.mjs --base http://localhost:4270 --label local --shots /tmp/ux
 *
 * Writes scripts/ux/reports/<label>.json and .md. Compare two runs with
 * compare.mjs. Read-only against the site: the X-ray POST is analysed in
 * memory and never stored, and no flow presses "Update news now" (that runs
 * a web search) — the flow only checks that it can be reached.
 *
 * Needs a Playwright build. Set PLAYWRIGHT_CORE to its path if it is not
 * resolvable from here (the fleet keeps one in loki's node_modules).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { makeContext, nextActionNear } from './harness.mjs';
import { DEAD_ENDS, TASKS } from './tasks.mjs';
import { markdown } from './report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE ?? '/home/g/dev/loki/node_modules/playwright-core',
);

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'https://substrata.orangecat.ch' },
    label: { type: 'string', default: 'run' },
    shots: { type: 'string' },
    only: { type: 'string' },
  },
});

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function runTask(browser, task, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  // A reader arrives from inside the site: connection and shared chunks warm.
  // The clock measures the tool, not TLS and the first download of the shell.
  await page.goto(values.base, { waitUntil: 'load', timeout: 45_000 }).catch(() => {});
  const ctx = makeContext(page, { viewport: vp });
  ctx.base = values.base;
  let answer = null;
  let failure = null;
  try {
    answer = await task.flow(ctx);
  } catch (e) {
    failure = e instanceof Error ? e.message.split('\n')[0] : String(e);
  }
  const seconds = Math.round(ctx.elapsed() / 100) / 10;
  if (values.shots) {
    mkdirSync(values.shots, { recursive: true });
    await page.screenshot({ path: join(values.shots, `${task.id}-${vp.width}.png`) });
  }
  await context.close();
  const answered = failure === null && ctx.answered();
  const withinSteps = ctx.steps <= task.maxSteps;
  const withinTime = seconds <= task.maxSeconds;
  return {
    viewport: vp.width,
    answered,
    steps: ctx.steps,
    seconds: answered ? seconds : null,
    pass: answered && withinSteps && withinTime,
    why: failure ?? (!withinSteps ? 'over the step budget' : !withinTime ? 'over time' : null),
    answer,
    log: ctx.log,
  };
}

async function runDeadEnd(browser, check, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(values.base + check.path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (check.setup) await check.setup(page).catch(() => {});
  const result = await nextActionNear(page, check.message);
  if (values.shots) {
    mkdirSync(values.shots, { recursive: true });
    await page.screenshot({ path: join(values.shots, `deadend-${check.id}-${vp.width}.png`) });
  }
  await context.close();
  return { viewport: vp.width, ...result, pass: result.found && result.actions.length > 0 };
}

const browser = await chromium.launch();
const tasks = TASKS.filter((t) => !values.only || values.only.split(',').includes(t.id));
const results = [];
for (const task of tasks) {
  const runs = [];
  for (const vp of VIEWPORTS) runs.push(await runTask(browser, task, vp));
  results.push({
    id: task.id,
    audience: task.audience,
    task: task.task,
    success: task.success,
    maxSteps: task.maxSteps,
    maxSeconds: task.maxSeconds,
    runs,
  });
  console.log(
    task.id,
    runs.map((r) => `${r.viewport}:${r.pass ? 'pass' : 'FAIL'} ${r.steps}st`),
  );
}
const deadEnds = [];
for (const check of values.only ? [] : DEAD_ENDS) {
  const runs = [];
  for (const vp of VIEWPORTS) runs.push(await runDeadEnd(browser, check, vp));
  deadEnds.push({ id: check.id, path: check.path, runs });
  console.log(
    'dead-end',
    check.id,
    runs.map((r) => (r.pass ? 'ok' : 'DEAD END')),
  );
}
await browser.close();

const report = {
  label: values.label,
  base: values.base,
  at: new Date().toISOString(),
  tasks: results,
  deadEnds,
};
const out = join(HERE, 'reports');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${values.label}.json`), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, `${values.label}.md`), markdown(report));
console.log(`wrote scripts/ux/reports/${values.label}.{json,md}`);
