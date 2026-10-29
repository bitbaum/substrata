import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { hashPassword } from 'better-auth/crypto';
import { createAuthRuntime } from '@bitbaum/accountkit/auth/next';
import { authSchema } from '@bitbaum/accountkit/auth/schema';

/**
 * scripts/db/017-accounts.sql, applied twice (the deploy may meet it again,
 * and every file there must be re-runnable) to a real in-memory Postgres,
 * carries the tables the account package needs. A column that drifts from the
 * package fails here, not at someone's sign-in.
 */
const site = { url: 'https://substrata.orangecat.ch', title: 'Substrata', slug: 'substrata' };

async function setUp() {
  const pg = new PGlite();
  const sql = readFileSync('scripts/db/017-accounts.sql', 'utf8');
  await pg.exec(sql);
  await pg.exec(sql);
  const runtime = createAuthRuntime({
    site,
    mail: { configured: false, send: async () => {} },
    env: { NODE_ENV: 'test', BETTER_AUTH_SECRET: 'r'.repeat(48) },
    isDatabaseConfigured: () => true,
    getDatabase: () => drizzle(pg, { schema: authSchema }),
    legacyIdentityProvider: 'orangecat',
  });
  const post = (path: string, body: unknown) =>
    runtime.POST(
      new Request(`${site.url}/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: site.url },
        body: JSON.stringify(body),
      }),
    );
  const cookieOf = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
  return { pg, runtime, post, cookieOf };
}

test('a reader signs up without OrangeCat and is their own account id', async () => {
  const { pg, runtime, post, cookieOf } = await setUp();
  const signUp = await post('/sign-up/email', {
    email: 'reader@example.ch',
    password: 'a long phrase to read by',
    name: '',
  });
  assert.equal(signUp.status, 200);
  const session = await runtime.sessionFor(new Headers({ cookie: cookieOf(signUp) }));
  assert.equal(session?.user.email, 'reader@example.ch');
  assert.equal(session?.user.actorId, session?.user.id);
  await pg.close();
});

test('a reader whose first way in was OrangeCat keeps the OrangeCat actor id', async () => {
  // Desks, follows, saved AI keys and reviewer ids are keyed on this id.
  const { pg, runtime, post, cookieOf } = await setUp();
  await pg.exec(`INSERT INTO users (id, email) VALUES ('u1', 'oc-reader@orangecat.invalid')`);
  await pg.exec(`INSERT INTO accounts (id, account_id, provider_id, user_id, created_at)
    VALUES ('a1', 'oc-actor-123', 'orangecat', 'u1', now() - interval '1 day')`);
  // A password added later, so the test can sign in without OrangeCat itself.
  await pg.query(
    `INSERT INTO accounts (id, account_id, provider_id, user_id, password)
     VALUES ('a2', 'u1', 'credential', 'u1', $1)`,
    [await hashPassword('a long phrase to read by')],
  );
  const signIn = await post('/sign-in/email', {
    email: 'oc-reader@orangecat.invalid',
    password: 'a long phrase to read by',
  });
  assert.equal(signIn.status, 200);
  const session = await runtime.sessionFor(new Headers({ cookie: cookieOf(signIn) }));
  assert.equal(session?.user.id, 'u1');
  assert.equal(session?.user.actorId, 'oc-actor-123');
  await pg.close();
});
