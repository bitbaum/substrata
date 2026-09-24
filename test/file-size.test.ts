/**
 * No god files: a size ceiling per kind of file, as a ratchet.
 *
 * A file past its ceiling is doing more than one job — the desk page reached
 * 700 lines holding its header, filters, feed rows, sidebar and URL parsing
 * before anyone noticed. The files already over the line are listed with the
 * size they had when the rule arrived. They may shrink, never grow, and once
 * one drops under its ceiling its entry must be deleted, so the list only
 * ever gets shorter.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = ['app', 'lib', 'components', 'config'];

/** Code does one job per file. Data files (config/) and stylesheets are allowed more. */
function ceilingFor(path: string): number {
  if (path.endsWith('.css')) return 600;
  if (path.startsWith('config/')) return 600;
  return 300;
}

/** Over the ceiling when this test was written (2026-09-24). Shrink them; never add one. */
const GRANDFATHERED: Record<string, number> = {
  'app/globals.css': 2053,
  'config/substrata-participants.ts': 1173,
  'config/substrata-coverage.ts': 847,
  'config/substrata-countries.ts': 626,
  'components/portal/ResearchChat.tsx': 618,
  'lib/profile/modules/bottleneck.tsx': 409,
  'lib/chat.ts': 382,
  'lib/participants.ts': 332,
  'app/policy/page.tsx': 320,
  'app/page.tsx': 314,
  'lib/bottlenecks.ts': 303,
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

function lineCount(path: string): number {
  return readFileSync(path, 'utf8').split('\n').length - 1;
}

test('no source file grows past its ceiling, and grandfathered ones only shrink', () => {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const abs of DIRS.flatMap((d) => walk(join(ROOT, d)))) {
    const path = relative(ROOT, abs);
    const lines = lineCount(abs);
    const ceiling = ceilingFor(path);
    const allowed = GRANDFATHERED[path];
    if (allowed !== undefined) {
      seen.add(path);
      if (lines > allowed)
        problems.push(`${path}: ${lines} lines, grew past its recorded ${allowed} — split it`);
      else if (lines <= ceiling)
        problems.push(
          `${path}: now ${lines} lines, under ${ceiling} — delete its GRANDFATHERED entry`,
        );
    } else if (lines > ceiling) {
      problems.push(`${path}: ${lines} lines, over the ${ceiling}-line ceiling — split it by job`);
    }
  }
  for (const path of Object.keys(GRANDFATHERED)) {
    if (!seen.has(path)) problems.push(`${path}: gone — delete its GRANDFATHERED entry`);
  }
  assert.deepEqual(problems, []);
});
