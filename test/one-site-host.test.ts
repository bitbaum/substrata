/**
 * The site's address lives in ONE place (lib/site.ts). Moving to substrata.ch
 * found it typed into five other files — user agents, a diagram caption, the
 * BYOK referer — each of which would have kept naming the old host.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIRS = ['app', 'lib', 'components', 'config'];
const HOSTS = /substrata\.(orangecat\.)?ch\b/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx|mjs)$/.test(e) ? [full] : [];
  });
}

test('only lib/site.ts names the site host', () => {
  const all = DIRS.flatMap((d) => files(join(ROOT, d)));
  assert.ok(all.length > 100, `scanned ${all.length} files`);
  const offenders = all
    .map((f) => relative(ROOT, f))
    .filter((f) => f !== join('lib', 'site.ts'))
    .filter((f) => HOSTS.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(offenders, []);
});
