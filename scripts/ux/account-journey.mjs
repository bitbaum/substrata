#!/usr/bin/env node
/**
 * Substrata's account journey, in a real browser against a running production
 * build and a real PostgreSQL (scripts/db/*.sql applied). The fleet's shared
 * journey assumes account mail; Substrata sends none (lib/auth.ts,
 * `mail.configured: false`), so a password account signs in at once, and this
 * drives Substrata's own screens:
 *
 *   sign up → signed in → sign out → sign back in → a wrong password is refused
 *
 *   AUTH_URL=http://localhost:3000 node scripts/ux/account-journey.mjs --base http://localhost:3000
 *
 * Run it with the server's NODE_ENV=production and neither NODE_ENV=test nor
 * TEST set: better-auth skips its origin check under those, and the journey
 * must pass with the check on. Synthetic people only. Screenshots go to
 * layout-artifacts/account/.
 *
 * Needs a Playwright build: set PLAYWRIGHT_CORE to its path if it is not
 * resolvable from here, and CHROMIUM_PATH to a Chromium.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const { values } = parseArgs({
  options: { base: { type: 'string', default: 'http://localhost:3000' } },
});
const BASE = values.base.replace(/\/$/, '');
const OUT = 'layout-artifacts/account';
const run = Date.now().toString(36);
const EMAIL = `journey-${run}@example.test`;
const PASSWORD = `synthetic journey password ${run}`;

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

/** The session as the browser holds it: its cookie, read by the auth route. */
const sessionEmail = async (page) =>
  page.evaluate(async () => {
    const response = await fetch('/api/auth/get-session', { cache: 'no-store' });
    const body = response.ok ? await response.json() : null;
    return body?.user?.email ?? null;
  });

async function fillCredentials(page, password) {
  await page.locator('#acct-email').fill(EMAIL);
  await page.locator('#acct-password').fill(password);
}

/** The account menu in the header shows the reader, not "Sign in". */
async function headerShowsSignedIn(page) {
  const avatar = page.locator('summary[aria-label^="Account menu for"]').first();
  await avatar.waitFor({ state: 'visible', timeout: 15_000 });
  return avatar.isVisible();
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (error) => console.error('page error:', error.message));

try {
  // 1. Sign up with an email and a password.
  await page.goto(`${BASE}/sign-up`);
  await fillCredentials(page, PASSWORD);
  await page.screenshot({ path: `${OUT}/sign-up.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/account', { timeout: 20_000 });

  // 2. Signed in at once (no mail): the session and the header both say so.
  check((await sessionEmail(page)) === EMAIL, 'sign-up signs the new account in at once');
  check(await headerShowsSignedIn(page), 'the header shows the account menu, not "Sign in"');
  await page.screenshot({ path: `${OUT}/desk-signed-in.png`, fullPage: true });

  // 3. Sign out from the account menu.
  await page.locator('summary[aria-label^="Account menu for"]').first().click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
  check((await sessionEmail(page)) === null, 'signing out ends the session');
  await page.goto(`${BASE}/account`);
  check(
    await page
      .getByRole('heading', { name: 'Your research desk' })
      .isVisible({ timeout: 10_000 })
      .catch(() => false),
    'the desk offers sign-in again after signing out',
  );

  // 4. A wrong password is refused, and nobody is signed in.
  await page.goto(`${BASE}/sign-in`);
  await fillCredentials(page, `not the password ${run}`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  const alert = page.locator('p[role="alert"]');
  await alert.waitFor({ state: 'visible', timeout: 15_000 });
  check(
    new URL(page.url()).pathname === '/sign-in' && (await sessionEmail(page)) === null,
    `a wrong password is refused ("${(await alert.textContent())?.trim()}")`,
  );
  await page.screenshot({ path: `${OUT}/wrong-password.png`, fullPage: true });

  // 5. Sign back in with the right one.
  await page.locator('#acct-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.waitForURL((url) => url.pathname === '/account', { timeout: 20_000 });
  check((await sessionEmail(page)) === EMAIL, 'signing back in with the right password works');
  check(await headerShowsSignedIn(page), 'the header shows the account menu again');
  await page.screenshot({ path: `${OUT}/signed-back-in.png`, fullPage: true });

  // 6. The origin check was on throughout: a stranger's origin is refused.
  const foreign = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { origin: 'https://foreign.example.test', 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check(foreign.status === 403, `a foreign origin is refused (status ${foreign.status})`);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error(error);
  await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} account journey check(s) failed`);
  process.exit(1);
}
console.log('\naccount journey passed');
