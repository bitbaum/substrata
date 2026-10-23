/**
 * The data-entry contract (docs/architecture/2026-10-23-knowledge-system.md §3):
 * every candidate row in config/candidates/ passes its facet's schema, says
 * `candidate`, carries a source URL and an as-of date no later than today, and
 * names only things the corpus has. And the gate a data agent runs —
 * scripts/research/add.ts — refuses a quote the page does not carry, appends a
 * good row sorted, and refuses the same row twice. The source page is a local
 * HTTP server: this test never touches the network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

import { extractReadableText } from '@bitbaum/ai-kit/web';

import { FACETS, type CandidateCommon } from '../lib/entry/candidate';
import { FACET_SPECS } from '../lib/entry/schemas';
import { COVERAGE } from '../config/substrata-coverage';
import { verificationFor, VERIFICATION_LABEL } from '../config/substrata-evidence';
import { EXIT, run, type PageRead } from '../scripts/research/add';

const today = new Date().toISOString().slice(0, 10);

async function sidecar(facet: string): Promise<CandidateCommon[]> {
  const file = path.join(import.meta.dirname, '..', 'config', 'candidates', `${facet}.json`);
  return JSON.parse(await readFile(file, 'utf8')) as CandidateCommon[];
}

test('every facet has a sidecar, and every row in it passes the gate the script runs', async () => {
  for (const facet of FACETS) {
    const rows = await sidecar(facet);
    assert.ok(Array.isArray(rows), `${facet}: the sidecar is not an array`);
    const keys = new Set<string>();
    for (const row of rows) {
      const key = FACET_SPECS[facet].key(row);
      const result = FACET_SPECS[facet].schema.safeParse(row);
      assert.ok(result.success, `${facet} ${key}: ${result.error?.issues.map((i) => i.message)}`);
      assert.equal(row.evidence, 'candidate', `${facet} ${key}: only "candidate" is written here`);
      assert.match(row.source.url, /^https?:\/\//, `${facet} ${key}: no source URL`);
      assert.ok(row.asOf, `${facet} ${key}: no asOf`);
      assert.ok(row.asOf <= today, `${facet} ${key}: asOf ${row.asOf} is in the future`);
      assert.ok(!keys.has(key), `${facet} ${key}: listed twice`);
      keys.add(key);
    }
    const sorted = [...rows].sort((a, b) =>
      FACET_SPECS[facet].key(a).localeCompare(FACET_SPECS[facet].key(b)),
    );
    assert.deepEqual(rows, sorted, `${facet}: the sidecar is not sorted by key`);
  }
});

test('a candidate producer reads "Candidate source", never "Sourced"', () => {
  assert.equal(
    VERIFICATION_LABEL[verificationFor('https://x.example', 'candidate')],
    'Candidate source',
  );
  for (const p of COVERAGE.flatMap((c) => c.producers))
    if (p.evidence === 'candidate')
      assert.equal(verificationFor(p.source, p.evidence), 'candidate');
});

const QUOTE = 'Niger produced an estimated 2,000 kilograms of refined gallium in the year';

const row = (overrides: Record<string, unknown> = {}) => ({
  evidence: 'candidate',
  asOf: '2024',
  source: { url: 'PLACEHOLDER', quote: QUOTE, readOn: today },
  submittedBy: { agent: 'test', model: 'fixture', runId: 'run-1' },
  material: 'gallium-refined',
  stage: 'refine',
  place: 'ne',
  production: { value: 2000, unit: 'kg', year: 2024, basis: 'estimated' },
  ...overrides,
});

test('the schema refuses a row without asOf, with a sourced claim, or naming a bottleneck that does not exist', () => {
  const { schema } = FACET_SPECS.endowments;
  const noAsOf: Record<string, unknown> = row();
  delete noAsOf.asOf;
  assert.equal(schema.safeParse(noAsOf).success, false, 'a row without asOf passed');
  assert.equal(schema.safeParse(row({ evidence: 'sourced' })).success, false);
  assert.equal(schema.safeParse(row({ material: 'unobtainium' })).success, false);
  assert.equal(schema.safeParse(row({ place: 'zz' })).success, false);
  assert.equal(
    schema.safeParse(row({ source: { url: 'x', quote: 'short', readOn: today } })).success,
    false,
  );
});

async function withPage(html: string, body: (url: string) => Promise<void>) {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await body(`http://127.0.0.1:${port}/gallium`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/** A plain fetch: ai-kit's SSRF guard rightly refuses 127.0.0.1, and that is all it would add here. */
async function localRead(url: string): Promise<PageRead> {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, reason: String(res.status) };
  return { ok: true, text: extractReadableText(await res.text(), 2_000_000).text };
}

async function fixture(rows: unknown[]): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'candidates-'));
  await writeFile(path.join(dir, 'endowments.json'), '[]\n');
  const file = path.join(dir, 'input.json');
  await writeFile(file, JSON.stringify(rows));
  return { dir, file };
}

test('add.ts --dry-run exits 4 when the quote is not on the page', async () => {
  await withPage(
    '<html><body><p>Gallium is a by-product of bauxite.</p></body></html>',
    async (url) => {
      const { dir, file } = await fixture([row({ source: { url, quote: QUOTE, readOn: today } })]);
      const code = await run(['endowments', file, '--dry-run'], {
        read: localRead,
        candidatesDir: dir,
        log: () => {},
      });
      assert.equal(code, EXIT.quote);
      assert.equal(await readFile(path.join(dir, 'endowments.json'), 'utf8'), '[]\n');
    },
  );
});

test('add.ts appends a good row sorted; the same row again exits 5', async () => {
  const page = `<html><body><p>Table 1. ${QUOTE.replace('refined', '<b>refined</b>')} 2024.</p></body></html>`;
  await withPage(page, async (url) => {
    const source = { url, quote: QUOTE, readOn: today };
    const later = row({ source, place: 'na' });
    const earlier = row({ source, place: 'kz' });
    const { dir, file } = await fixture([later, earlier]);
    const deps = { read: localRead, candidatesDir: dir, log: () => {} };

    assert.equal(await run(['endowments', file, '--dry-run'], deps), EXIT.ok);
    assert.equal(
      await readFile(path.join(dir, 'endowments.json'), 'utf8'),
      '[]\n',
      'dry run wrote',
    );

    assert.equal(await run(['endowments', file], deps), EXIT.ok);
    const written = JSON.parse(await readFile(path.join(dir, 'endowments.json'), 'utf8'));
    assert.deepEqual(
      written.map((r: { place: string }) => r.place),
      ['kz', 'na'],
      'rows are sorted by key',
    );

    const before = await readFile(path.join(dir, 'endowments.json'), 'utf8');
    assert.equal(await run(['endowments', file], deps), EXIT.duplicate);
    assert.equal(
      await readFile(path.join(dir, 'endowments.json'), 'utf8'),
      before,
      'not idempotent',
    );
  });
});

test('add.ts exits 2 on a schema failure and 3 on an unreachable page', async () => {
  const { dir, file } = await fixture([row({ asOf: undefined })]);
  assert.equal(await run(['endowments', file], { candidatesDir: dir, log: () => {} }), EXIT.schema);
  const good = await fixture([
    row({ source: { url: 'http://127.0.0.1:9/', quote: QUOTE, readOn: today } }),
  ]);
  const code = await run(['endowments', good.file], {
    read: async () => ({ ok: false, reason: 'refused' }),
    candidatesDir: good.dir,
    log: () => {},
  });
  assert.equal(code, EXIT.unreachable);
});
