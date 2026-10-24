/**
 * The source layer: PDF text and the quote check on it, the host allow-list,
 * and the gate every adapter row passes (no `stated` row without its quote in
 * the fetched text). Offline: recorded responses only (./sources-fixtures.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

import { ALLOWED_HOSTS, HostNotAllowed, assertAllowed } from '../lib/sources/hosts';
import { documentText } from '../lib/sources/document';
import { sourceFetch } from '../lib/sources/http';
import { findQuoteInPages, pdfPages, quoteText } from '../lib/sources/pdf';
import { finalise, adapterRun, type Draft } from '../lib/sources/proposal';
import { EXIT, run } from '../scripts/research/add';
import { fixtureBytes } from './sources-fixtures';

const PDF = 'kazatomprom-2q26-trading-update-p6.pdf';
const today = new Date().toISOString().slice(0, 10);

test('a real PDF reads page by page, and a quote broken across its lines is found on its page', async () => {
  const pages = await pdfPages(fixtureBytes(PDF));
  assert.equal(pages.length, 1);
  assert.match(pages[0], /primary customers/);
  // In the PDF this sentence runs over two lines; the reader sees one.
  const quote =
    'The Group’s primary customers are operators of nuclear power plants, the principal export markets for the Group’s products are countries in Asia, Europe, and the Americas.';
  assert.deepEqual(findQuoteInPages(quote, pages)?.page, 1);
  assert.equal(
    findQuoteInPages(quote.replace('operators', 'owners'), pages),
    null,
    'a paraphrase is refused',
  );
});

test('line-end hyphenation closes up either way; a hyphen inside a line stays', () => {
  assert.equal(quoteText('ura-\nnium  supply'), 'uranium supply');
  assert.equal(quoteText('long-\nterm contracts', true), 'long-term contracts');
  assert.equal(quoteText('in-situ recovery'), 'in-situ recovery');
  assert.equal(
    findQuoteInPages('under long-term contracts linked to spot', [
      'under long-\nterm contracts linked to spot',
    ])?.page,
    1,
  );
  assert.equal(
    findQuoteInPages('the uranium sales volume rose', ['the ura-\nnium sales volume rose'])?.page,
    1,
  );
});

test('documentText tells a PDF from JSON from HTML by content, not by URL', async () => {
  const at = new Date().toISOString();
  const pdf = await documentText({
    url: 'x',
    body: fixtureBytes(PDF),
    contentType: 'application/octet-stream',
    fetchedAt: at,
  });
  assert.equal(pdf.ok && pdf.kind, 'pdf');
  const enc = new TextEncoder();
  const json = await documentText({
    url: 'x',
    body: enc.encode('{"a":"<b>1</b>"}'),
    contentType: '',
    fetchedAt: at,
  });
  assert.equal(json.ok && json.text, '{"a":"<b>1</b>"}', 'JSON is quoted as served');
  const html = await documentText({
    url: 'x',
    body: enc.encode('<p>Hello <b>there</b></p>'),
    contentType: 'text/html',
    fetchedAt: at,
  });
  assert.equal(html.ok && html.kind, 'html');
});

test('add.ts checks a quote against a PDF and prints the page; a quote not in it exits 4', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/pdf' });
    res.end(fixtureBytes(PDF));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/update.pdf`;
  // The SSRF guard refuses 127.0.0.1, so the test reads the bytes itself and hands add.ts the same text.
  const read = async (u: string) => {
    const doc = await documentText({
      url: u,
      body: new Uint8Array(await (await fetch(u)).arrayBuffer()),
      contentType: 'application/pdf',
      fetchedAt: today,
    });
    return doc.ok
      ? { ok: true as const, text: doc.text, pages: doc.pages }
      : { ok: false as const, reason: doc.reason };
  };
  // A gate test, not a claim: the row's endpoints exist; what is checked is the quote.
  const row = (quote: string) => ({
    evidence: 'candidate',
    asOf: '2026',
    source: { url, quote, readOn: today },
    submittedBy: { agent: 'test', model: 'none', runId: 'pdf-gate' },
    from: 'company:nac-kazatomprom-jsc',
    to: 'company:cameco-corp',
    type: 'ships_to',
    grade: 'lead',
  });
  try {
    const dir = await mkdtemp(path.join(tmpdir(), 'pdf-gate-'));
    await writeFile(path.join(dir, 'relations.json'), '[]\n');
    const file = path.join(dir, 'in.json');
    const lines: string[] = [];
    const deps = { read, candidatesDir: dir, log: (l: string) => lines.push(l) };
    await writeFile(
      file,
      JSON.stringify([
        row(
          'The Group sells uranium and uranium products under long-term contracts, short-term contracts',
        ),
      ]),
    );
    assert.equal(await run(['relations', file, '--dry-run'], deps), EXIT.ok);
    assert.ok(
      lines.some((l) => l.startsWith('ok ') && l.endsWith('(page 1)')),
      lines.join('\n'),
    );
    await writeFile(
      file,
      JSON.stringify([row('The Group sells uranium only under spot contracts to Cameco')]),
    );
    assert.equal(await run(['relations', file, '--dry-run'], deps), EXIT.quote);
    assert.equal(await readFile(path.join(dir, 'relations.json'), 'utf8'), '[]\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the allow-list refuses any other host before the network, and HOSTS.md lists every allowed one', async () => {
  assert.throws(() => assertAllowed('https://example.com/x'), HostNotAllowed);
  assert.throws(
    () => assertAllowed('http://www.sec.gov/x'),
    HostNotAllowed,
    'plain http is not the allowed host',
  );
  let called = false;
  const spy: typeof fetch = async () => ((called = true), new Response(''));
  await assert.rejects(
    sourceFetch('https://evil.example/', '*/*', { fetch: spy, cacheDir: null }),
    HostNotAllowed,
  );
  assert.equal(called, false);
  const doc = await readFile(
    path.join(import.meta.dirname, '..', 'lib', 'sources', 'HOSTS.md'),
    'utf8',
  );
  for (const rule of ALLOWED_HOSTS)
    assert.ok(doc.includes(`\`${rule.host}\``), `${rule.host} missing from HOSTS.md`);
  for (const rule of ALLOWED_HOSTS)
    assert.match(rule.userAgent, /cato@orangecat\.ch/, 'every agent string names a contact');
});

test('sourceFetch sends the host’s agent string, waits out a 429, and caches the body', async () => {
  const seen: string[] = [];
  let calls = 0;
  const fake: typeof fetch = async (_url, init) => {
    seen.push(new Headers(init?.headers).get('user-agent') ?? '');
    calls += 1;
    return calls === 1
      ? new Response('slow down', { status: 429 })
      : new Response('{"ok":1}', { headers: { 'content-type': 'application/json' } });
  };
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'src-cache-'));
  const deps = { fetch: fake, cacheDir, sleep: async () => {} };
  const first = await sourceFetch('https://api.gleif.org/api/v1/lei-records/X', '*/*', deps);
  assert.equal(first.fromCache, false);
  assert.match(seen[0], /github\.com\/bitbaum\/substrata/);
  const again = await sourceFetch('https://api.gleif.org/api/v1/lei-records/X', '*/*', deps);
  assert.equal(again.fromCache, true);
  assert.equal(calls, 2, 'one 429, one answer, then the cache');
});

test('no adapter row reaches stated without its quote in the fetched text', async () => {
  const text = '{"partnerCode":156,"cmdCode":"284410","netWgt":11224600.0}';
  const docs = new Map([
    [
      'https://comtradeapi.un.org/x',
      {
        ok: true as const,
        url: 'x',
        kind: 'json' as const,
        text,
        fetchedAt: '2026-10-24T00:00:00.000Z',
      },
    ],
  ]);
  const base: Draft = {
    from: 'country:kz',
    to: 'country:cn',
    type: 'ships_to',
    grade: 'stated',
    asOf: '2024',
    url: 'https://comtradeapi.un.org/x',
    quote: '"cmdCode":"284410","netWgt":11224600.0',
    label: 'kz → cn',
  };
  const ctx = {
    adapter: 'test',
    docs,
    submittedBy: adapterRun('test', 'r'),
    ceiling: 'stated' as const,
  };
  const ok = finalise([base], ctx);
  assert.equal(ok.rows[0]?.grade, 'stated');
  assert.deepEqual(ok.rows[0]?.provenance, {
    adapter: 'test',
    fetchedAt: '2026-10-24T00:00:00.000Z',
    url: base.url,
  });
  const invented = finalise([{ ...base, quote: '"cmdCode":"284410","netWgt":99999999.0' }], ctx);
  assert.equal(invented.rows.length, 0);
  assert.match(invented.skipped[0].reason, /quote is not in the text/);
  const unfetched = finalise([{ ...base, url: 'https://comtradeapi.un.org/never-read' }], ctx);
  assert.equal(unfetched.rows.length, 0, 'a URL the adapter never fetched cannot carry a row');
  const capped = finalise([base], { ...ctx, ceiling: 'lead' });
  assert.equal(capped.rows[0].grade, 'lead', 'an adapter with a lead ceiling cannot write stated');
  const offList = finalise([{ ...base, to: 'country:zz' }], ctx);
  assert.equal(
    offList.rows.length,
    0,
    'an endpoint the site lacks is skipped by the relations schema',
  );
});
