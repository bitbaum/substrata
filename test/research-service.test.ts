import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { atlasData, evidenceTotals } from '../lib/atlas';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { researchDocuments, searchResearch } from '../lib/research-index';
import { bottlenecksCsv, csvCell, researchExport } from '../lib/research-export';
import { boundedJson, sameOrigin } from '../lib/request-guards';
import { chainDiagram } from '../lib/chain-diagram';
import { chatContext } from '../lib/chat';
import { hasAuthenticatedSubject } from '../lib/identity';

test('atlas counts partition actual bottlenecks and never turn missing coverage into data', () => {
  const stages = atlasData();
  assert.equal(
    stages.reduce((n, s) => n + s.total, 0),
    BOTTLENECKS.length,
  );
  assert.ok(stages.some((s) => s.total === 0));
  for (const s of atlasData('ai'))
    for (const row of s.rows) assert.ok(row.technologies.includes('ai'));
  const totals = evidenceTotals();
  assert.equal(totals.sourced + totals.candidate + totals.unverified, totals.producerRows);
});
test('search finds companies and text and applies every query term', () => {
  const documents = researchDocuments();
  assert.ok(searchResearch(documents, 'ASML').some((d) => d.kind === 'company'));
  assert.equal(searchResearch(documents, 'ASML xxyyzz-unmatched').length, 0);
  assert.equal(new Set(documents.map((d) => d.id)).size, documents.length);
});
test('questions retrieve relevant records across science, companies and talent', () => {
  assert.ok(
    chatContext('Which companies make silicon wafers?').some((d) => /wafer/i.test(d.title)),
  );
  assert.ok(
    chatContext('What expertise does this research need?').some((d) => d.kind === 'talent'),
  );
  assert.deepEqual(chatContext('xyzzyunmatched'), []);
});
test('an authenticated OIDC subject is usable without an optional profile email', () => {
  assert.equal(hasAuthenticatedSubject({ sub: 'actor-123' }), true);
  assert.equal(hasAuthenticatedSubject({ sub: '' }), false);
  assert.equal(hasAuthenticatedSubject(null), false);
});
test('exported chain figures explain relationships and refuse arbitrary slugs', () => {
  const bottleneck = BOTTLENECKS.find((b) => b.producers.length > 0)!;
  const svg = chainDiagram(bottleneck.slug)!;
  assert.ok(svg.includes(`${bottleneck.producers.length} producer rows`));
  assert.ok(svg.includes('analyst classification'));
  assert.ok(svg.includes('No customer contracts'));
  assert.equal(chainDiagram('<script>'), null);
  assert.ok(!svg.includes('<script'));
});
test('export digest identifies content independently of generation time', () => {
  const a = researchExport(),
    b = researchExport();
  assert.equal(a.sha256, b.sha256);
  assert.equal(a.sha256, createHash('sha256').update(JSON.stringify(a.data)).digest('hex'));
  assert.ok(a.data.assessments.every((a) => a.judgedOn && a.rationale));
  assert.ok(bottlenecksCsv().includes('analyst_score_out_of_12'));
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
});
test('public write endpoints reject foreign origins and oversized streaming bodies', async () => {
  assert.equal(
    sameOrigin(
      new Request('https://substrata.orangecat.ch/api/chat', {
        headers: { origin: 'https://evil.example' },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(
      new Request('https://substrata.orangecat.ch/api/chat', {
        headers: { origin: 'https://substrata.orangecat.ch' },
      }),
    ),
    true,
  );
  await assert.rejects(
    () =>
      boundedJson(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(20001) })),
    /too large/,
  );
});
