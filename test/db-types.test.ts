/**
 * A `query<T>` generic is an assertion, not a validation.
 *
 * `db.query<{ finished_at: string }>(...)` tells TypeScript what the driver
 * returns; it does not make the driver return it. node-postgres parses
 * `timestamptz` into a JS `Date`, so declaring such a column `string` compiles,
 * passes every test, builds — and then throws `.slice is not a function` the
 * first time a row actually exists.
 *
 * That "first time a row exists" is why this needs a lint rather than a test of
 * behaviour: no build has a database, so the fallback path is the only one any
 * gate ever took. Both live instances shipped green. One of them would have
 * killed the scheduled sweep on its second run, because run one read an empty
 * table and run two would have called `.localeCompare` on a Date.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SKIP = new Set(['node_modules', '.next', '.git', '.claude', 'dist']);

/** Column names that are timestamps in this schema, by convention. */
const TIMESTAMP_COLUMN = /(_at|_time|_swept)$/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('a timestamp column is never asserted to be a string', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(ROOT)) {
    // This file documents the mistake in prose, so it contains the shape it
    // hunts. Scanning itself would make the lint permanently red.
    if (file.endsWith('db-types.test.ts')) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/query<\{(.*?)\}>/gs)) {
      const body = match[1];
      const line = source.slice(0, match.index).split('\n').length;
      for (const field of body.matchAll(/(\w+)\s*:\s*([^;,\n]+)/g)) {
        const [, name, type] = field;
        if (!TIMESTAMP_COLUMN.test(name)) continue;
        if (type.includes('Date')) continue;
        if (!type.includes('string')) continue;
        offenders.push(`${path.relative(ROOT, file)}:${line} — ${name}: ${type.trim()}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These columns are Dates at runtime; declaring them string compiles and then throws:\n  ${offenders.join('\n  ')}`,
  );
});
