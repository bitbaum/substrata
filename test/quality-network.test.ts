/**
 * The quality run's fetches: every hop of a source URL passes ai-kit's SSRF
 * guard, so a public link that redirects into the private network or the cloud
 * metadata service is refused, while public links answer as before.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { probeUrl } from '../lib/quality/network';
import { guardedFetch, pageText, ReadError } from '../lib/quality/page-text';

const PUBLIC = '93.184.216.34';

/** A resolver: every name public unless listed. */
const lookup =
  (names: Record<string, string | Error> = {}) =>
  async (host: string) => {
    const answer = names[host] ?? PUBLIC;
    if (answer instanceof Error) throw answer;
    return [{ address: answer }];
  };

/** A fetch that answers from a table of URL → response, recording what it was asked. */
function routes(table: Record<string, () => Response>) {
  const asked: { url: string; redirect?: RequestRedirect; method?: string }[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, redirect: init?.redirect, method: init?.method });
    const route = table[url];
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return route();
  }) as typeof globalThis.fetch;
  return { fetch, asked };
}

const redirect = (to: string, status = 302) =>
  new Response(null, { status, headers: { location: to } });

test('guardedFetch follows public redirects by hand, checking each hop', async () => {
  const { fetch, asked } = routes({
    'https://a.example/x': () => redirect('/y', 301),
    'https://a.example/y': () => redirect('https://b.example/z'),
    'https://b.example/z': () => new Response('<p>ok</p>', { status: 200 }),
  });
  const res = await guardedFetch('https://a.example/x', {}, { fetch, lookup: lookup() });
  assert.equal(res.status, 200);
  assert.deepEqual(
    asked.map((a) => [a.url, a.redirect]),
    [
      ['https://a.example/x', 'manual'],
      ['https://a.example/y', 'manual'],
      ['https://b.example/z', 'manual'],
    ],
  );
});

test('a redirect into the cloud metadata service is refused, never fetched', async () => {
  const { fetch, asked } = routes({
    'https://a.example/x': () => redirect('http://169.254.169.254/latest/meta-data/'),
  });
  await assert.rejects(
    guardedFetch('https://a.example/x', {}, { fetch, lookup: lookup() }),
    (error: unknown) => error instanceof ReadError && /refused/.test(error.message),
  );
  assert.equal(asked.length, 1);
});

test('a redirect to a name that resolves privately is refused', async () => {
  const { fetch, asked } = routes({
    'https://a.example/x': () => redirect('https://internal.example/admin'),
  });
  await assert.rejects(
    guardedFetch(
      'https://a.example/x',
      {},
      { fetch, lookup: lookup({ 'internal.example': '10.0.0.5' }) },
    ),
    ReadError,
  );
  assert.equal(asked.length, 1);
});

test('a redirect loop stops', async () => {
  const { fetch } = routes({ 'https://a.example/x': () => redirect('https://a.example/x') });
  await assert.rejects(
    guardedFetch('https://a.example/x', {}, { fetch, lookup: lookup() }),
    /more than \d+ redirects/,
  );
});

test('a failed lookup still reads as fetch reports it, with the resolver code', async () => {
  const { fetch, asked } = routes({});
  const hiccup = Object.assign(new Error('getaddrinfo EAI_AGAIN a.example'), {
    code: 'EAI_AGAIN',
  });
  await assert.rejects(
    guardedFetch('https://a.example/', {}, { fetch, lookup: lookup({ 'a.example': hiccup }) }),
    (error: unknown) =>
      error instanceof TypeError &&
      (error.cause as { code?: string } | undefined)?.code === 'EAI_AGAIN',
  );
  assert.equal(asked.length, 0);
});

test('pageText reads a public page through redirects, and refuses a private one', async () => {
  const { fetch } = routes({
    'https://a.example/x': () => redirect('https://a.example/page'),
    'https://a.example/page': () =>
      new Response('<p>Gallium and germanium</p>', { headers: { 'content-type': 'text/html' } }),
    'https://a.example/bad': () => redirect('http://127.0.0.1/'),
  });
  const deps = { fetch, lookup: lookup() };
  const text = await pageText('https://a.example/x', undefined, 5_000, undefined, deps);
  assert.match(text, /Gallium and germanium/);
  await assert.rejects(
    pageText('https://a.example/bad', undefined, 5_000, undefined, deps),
    ReadError,
  );
});

test('probeUrl: public links classify as before; a private redirect is an error at once', async () => {
  const { fetch, asked } = routes({
    'https://a.example/ok': () => redirect('https://a.example/final'),
    'https://a.example/final': () => new Response(null, { status: 200 }),
    'https://a.example/gone': () => new Response(null, { status: 404 }),
    'https://a.example/bad': () => redirect('http://localhost/'),
  });
  const deps = { fetch, lookup: lookup({ localhost: '127.0.0.1' }) };
  assert.deepEqual(await probeUrl('https://a.example/ok', 5_000, undefined, deps), {
    url: 'https://a.example/ok',
    status: 'ok',
    code: 200,
    detail: 'HTTP 200',
  });
  assert.equal((await probeUrl('https://a.example/gone', 5_000, undefined, deps)).status, 'gone');
  assert.ok(asked.some((a) => a.url === 'https://a.example/gone' && a.method === 'GET'));
  const before = asked.length;
  const bad = await probeUrl('https://a.example/bad', 5_000, undefined, deps);
  assert.equal(bad.status, 'error');
  assert.match(bad.detail, /refused/);
  assert.equal(asked.length - before, 1, 'refused once, not retried');
});
