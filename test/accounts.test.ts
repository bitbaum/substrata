import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createAuthInstance } from '@bitbaum/accountkit/auth/server';
import { authSchema } from '@bitbaum/accountkit/auth/schema';

/**
 * scripts/db/015-accounts.sql, applied twice (it must be re-runnable, like
 * every file provision-service.py takes) to a real in-memory Postgres,
 * carries the tables the account package needs: a reader can create an
 * account with an email and a password, with no OrangeCat account, and is
 * signed in. A column that drifts from the package fails here.
 */
test('a reader signs up without OrangeCat against 015-accounts.sql', async () => {
  const pg = new PGlite();
  const sql = readFileSync('scripts/db/015-accounts.sql', 'utf8');
  await pg.exec(sql);
  await pg.exec(sql);
  const site = { url: 'https://substrata.orangecat.ch', title: 'Substrata', slug: 'substrata' };
  const auth = createAuthInstance({
    site,
    database: drizzle(pg, { schema: authSchema }),
    mail: { configured: false, send: async () => {} },
    env: { NODE_ENV: 'test', BETTER_AUTH_SECRET: 'r'.repeat(48) },
  });
  const signUp = await auth.handler(
    new Request(`${site.url}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: site.url },
      body: JSON.stringify({
        email: 'reader@example.ch',
        password: 'a long phrase to read by',
        name: '',
      }),
    }),
  );
  assert.equal(signUp.status, 200);
  const cookie = signUp.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const session = await (
    await auth.handler(new Request(`${site.url}/api/auth/get-session`, { headers: { cookie } }))
  ).json();
  assert.equal(session.user.email, 'reader@example.ch');
  await pg.close();
});
