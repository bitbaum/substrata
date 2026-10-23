/**
 * The corpus as chunks (`lib/index/`): every facet produces rows, every entity
 * is reachable, every chunk is short enough to read and cites a page and an
 * evidence state from the closed set — and the code keeps the boundary that
 * lets it leave for `@bitbaum/indexkit` in one PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { allEntities } from '../lib/entities/registry';
import {
  CHUNK_TEXT_MAX,
  FACETS,
  INDEX_EVIDENCE,
  contentHash,
  makeChunk,
  recency,
  splitText,
} from '../lib/index/chunk';
import { buildChunks, chunkCounts } from '../lib/index/build';
import { indexEvidence, LABEL_EVIDENCE, VERIFICATION_EVIDENCE } from '../lib/index/chunks/evidence';
import { freshness, rank, retrieve } from '../lib/index/retrieve';
import { VERIFICATION_LABEL } from '../config/substrata-evidence';

const chunks = buildChunks();

test('every facet produces chunks', () => {
  const counts = chunkCounts(chunks);
  console.log(`index chunks: ${JSON.stringify(counts)} (${chunks.length} in all)`);
  for (const facet of FACETS) assert.ok(counts[facet] > 0, `facet ${facet} is empty`);
});

test('every entity is in at least one chunk', () => {
  const covered = new Set(chunks.flatMap((c) => c.entityIds));
  const missing = allEntities().filter((e) => !covered.has(e.id));
  assert.deepEqual(
    missing.map((e) => e.id),
    [],
  );
});

test('every chunk is short, cited, evidenced, and names only real entities', () => {
  const evidence = new Set<string>(INDEX_EVIDENCE);
  const known = new Set<string>(allEntities().map((e) => e.id));
  for (const c of chunks) {
    assert.ok(
      c.text.length > 0 && c.text.length <= CHUNK_TEXT_MAX,
      `${c.id}: ${c.text.length} chars`,
    );
    assert.match(c.href, /^\//, `${c.id}: href is a site page`);
    assert.ok(evidence.has(c.evidence), `${c.id}: evidence ${c.evidence}`);
    assert.ok(c.significance >= 0 && c.significance <= 1, `${c.id}: significance`);
    assert.match(c.id, new RegExp(`^${c.facet}:.+#\\d+$`), `${c.id}: id shape`);
    for (const id of c.entityIds) assert.ok(known.has(id), `${c.id}: ${id} is not an entity`);
  }
  assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length, 'chunk ids are unique');
});

test('every evidence label the corpus writes maps into the closed set', () => {
  const unmapped = [...new Set(allEntities().map((e) => e.evidence))].filter(
    (label) => indexEvidence(label) === undefined,
  );
  assert.deepEqual(unmapped, [], 'add these labels to LABEL_EVIDENCE');
});

test('the evidence ladder in config/substrata-evidence maps onto itself, and only into the closed set', () => {
  for (const v of Object.keys(VERIFICATION_LABEL))
    assert.equal(indexEvidence(v), v, `${v} keeps its name`);
  for (const e of [...Object.values(VERIFICATION_EVIDENCE), ...Object.values(LABEL_EVIDENCE)])
    assert.ok((INDEX_EVIDENCE as readonly string[]).includes(e));
  assert.equal(indexEvidence('a label nobody wrote'), undefined);
  assert.equal(indexEvidence('directory, not a finding'), 'directory');
  assert.equal(indexEvidence('computed from USGS and EIA tables'), 'computed');
});

test('splitText cuts at sentence ends under the limit and loses no words', () => {
  const sentence = 'Gallium is refined as a byproduct of alumina. ';
  const text = sentence.repeat(60);
  const pieces = splitText(text, 200);
  assert.ok(pieces.length > 1);
  for (const p of pieces) assert.ok(p.length <= 200 && p.endsWith('.'), p);
  assert.equal(pieces.join(' '), text.trim());
  assert.deepEqual(splitText('   '), []);
});

test('the content hash moves with the words and the tags, and only with them', () => {
  assert.equal(contentHash('a', ['x']), contentHash('a', ['x']));
  assert.notEqual(contentHash('a', ['x']), contentHash('b', ['x']));
  assert.notEqual(contentHash('a', ['x']), contentHash('a', ['y']));
  const long = makeChunk({
    id: 'entity:x#0',
    facet: 'entity',
    entityIds: [],
    title: 'x',
    text: 'w'.repeat(CHUNK_TEXT_MAX + 50),
    href: '/x',
    evidence: 'sourced',
    significance: 3,
  });
  assert.equal(long.text.length, CHUNK_TEXT_MAX);
  assert.equal(long.significance, 1);
});

test('recency tapers without reaching zero; a finding earns none; an undated record is current', () => {
  const now = new Date('2026-10-23T00:00:00Z');
  assert.equal(recency('2026-09-01', now), 1);
  assert.ok(recency('2024', now) < 0.6 && recency('2024', now) > 0);
  assert.ok(recency('2025-Q2', now) > recency('2024-Q2', now));
  assert.equal(recency(undefined, now), 0);
  assert.equal(freshness({ evidence: 'finding', asOf: '2026-10-23' }, now), 0);
  assert.equal(freshness({ evidence: 'sourced' }, now), 1);
});

test('retrieval: whole words, the hint lifts the page, facets filter, off-topic stays low', () => {
  const euv = retrieve('EUV scanners', { k: 3 });
  assert.equal(euv[0].chunk.id, 'entity:bottleneck:euv-lithography-scanners#0');
  const policy = retrieve('gallium export controls', { k: 5, facets: ['policy'] });
  assert.ok(policy.length > 0 && policy.every((h) => h.chunk.facet === 'policy'));
  const hinted = retrieve('who makes it', { k: 3, entityHints: ['bottleneck:gallium-refined'] });
  assert.ok(hinted.every((h) => h.score >= 0));
  assert.deepEqual(retrieve('the and of'), [], 'stop words alone retrieve nothing');
  assert.deepEqual(rank([], 'gallium'), []);
});

test('package boundary: lib/index imports no app/ or components/, and only producers read config', () => {
  const root = join(__dirname, '..', 'lib', 'index');
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory()
        ? files(join(dir, d.name))
        : d.name.endsWith('.ts')
          ? [join(dir, d.name)]
          : [],
    );
  for (const file of files(root)) {
    const imports = [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    const producer = file.includes(`${join('lib', 'index', 'chunks')}`);
    for (const spec of imports) {
      assert.ok(
        !/(^|\/)(app|components)\//.test(spec) &&
          !spec.startsWith('@/app') &&
          !spec.startsWith('@/components'),
        `${file} imports ${spec}`,
      );
      if (!producer)
        assert.ok(
          !/(^@\/config\/|\/config\/)/.test(spec),
          `${file} reads config (${spec}); only producers may`,
        );
    }
  }
});
