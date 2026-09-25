/**
 * No background job spends the site's free AI. Ever.
 *
 * George, 2026-09-25: "background jobs should not exist if there is a free
 * tier only." The hourly drafter had been spending the free models shared by
 * every app on the box. It now runs only on readers' own keys, and this test
 * is the ratchet that keeps it there: it walks the import graph from every
 * scheduled route (`app/api/cron/**`) and every background module, and fails
 * if anything reachable
 *
 *   - imports the free chain (`freeChain`, `usableChain`, `freeLinks`, …),
 *   - imports the free Ask turn or its ledger (`lib/chat-agent/*`, `lib/ai-budget`),
 *   - calls a model any way but `lib/byok-ask.ts`, which builds its chain
 *     from a reader's key and always passes it (ai-kit's `complete()` falls
 *     back to the free chain when given none).
 *
 * The walker is tested on a synthetic graph first, so a walker that finds
 * nothing cannot pass for a clean tree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
/** Modules that run with no reader waiting, beyond the cron routes themselves. */
const BACKGROUND = ['lib/auto-updates.ts', 'lib/event-draft-run.ts'];
const FREE_NAMES = /\b(freeChain|usableChain|freeLinks|freeCooldown|backgroundMay)\b/;
const FREE_MODULES = /^(lib\/chat-agent\/|lib\/ai-budget\.ts$|app\/api\/(chat|factcheck)\/)/;
const MODEL_CALLS = /\b(complete|completeStream)\b/;
const THE_ONE_CALLER = 'lib/byok-ask.ts';

type Source = (path: string) => string | null;

/** Every import in a file: `from '…'`, `import '…'`, `import('…')`, with its named bindings. */
function importsOf(code: string): { spec: string; names: string }[] {
  const out: { spec: string; names: string }[] = [];
  const re =
    /(?:import|export)\s*(?:type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
  for (const m of code.matchAll(re)) out.push({ spec: m[2] ?? m[3] ?? m[4], names: m[1] ?? '*' });
  return out;
}

function resolveSpec(from: string, spec: string, read: Source): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = relative(ROOT, resolve(ROOT, dirname(from), spec));
  else return null; // a package
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (/\.(ts|tsx)$/.test(candidate) && read(candidate) !== null) return candidate;
  }
  return null;
}

/** Every problem reachable from `entries`, as "path: why". Pure over `read`, so it can be tested. */
function violations(entries: string[], read: Source): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const code = read(path);
    if (code === null) continue;
    if (FREE_MODULES.test(path)) problems.push(`${path}: the free Ask turn or its ledger`);
    for (const { spec, names } of importsOf(code)) {
      if (FREE_NAMES.test(names)) problems.push(`${path}: imports ${names.trim()} from ${spec}`);
      if (spec.startsWith('@bitbaum/ai-kit') && MODEL_CALLS.test(names) && path !== THE_ONE_CALLER)
        problems.push(`${path}: calls a model directly (only ${THE_ONE_CALLER} may)`);
      const next = resolveSpec(path, spec, read);
      if (next) queue.push(next);
    }
  }
  return problems;
}

const fromDisk: Source = (path) => {
  const abs = join(ROOT, path);
  return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null;
};

function cronRoutes(dir = 'app/api/cron'): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(ROOT, path)).isDirectory()) return cronRoutes(path);
    return /route\.tsx?$/.test(name) ? [path] : [];
  });
}

test('the walker fires on each way free AI could come back (it can fail)', () => {
  const tree: Record<string, string> = {
    'app/api/cron/x/route.ts': "import { run } from '@/lib/job';",
    'lib/job.ts': "import { helper } from './helper';\nexport const run = 1;",
    'lib/helper.ts': "import { freeChain, complete } from '@bitbaum/ai-kit';",
    'app/api/cron/y/route.ts': "import { loop } from '../../../../lib/chat-agent/loop';",
    'lib/chat-agent/loop.ts': 'export const loop = 1;',
    'app/api/cron/z/route.ts': "const m = import('@/lib/budget-free');",
    'lib/budget-free.ts': "import {\n  usableChain,\n} from '@bitbaum/ai-kit';",
  };
  const found = violations(
    Object.keys(tree).filter((p) => p.includes('cron')),
    (p) => (p in tree ? tree[p] : null),
  );
  assert.ok(found.some((f) => f.startsWith('lib/helper.ts: imports') && f.includes('freeChain')));
  assert.ok(found.some((f) => f.startsWith('lib/helper.ts: calls a model directly')));
  assert.ok(found.some((f) => f.startsWith('lib/chat-agent/loop.ts')));
  assert.ok(found.some((f) => f.startsWith('lib/budget-free.ts') && f.includes('usableChain')));
});

test('no scheduled route or background module can reach the free models', () => {
  const entries = [...cronRoutes(), ...BACKGROUND];
  assert.ok(entries.length >= 5, 'the cron routes were not found — the walk proves nothing');
  assert.deepEqual(violations(entries, fromDisk), []);
});

test('the one model caller passes a chain built from the reader key', () => {
  const code = fromDisk(THE_ONE_CALLER) ?? '';
  assert.doesNotMatch(code, FREE_NAMES);
  assert.match(code, /byokChain\(config/);
  assert.match(code, /complete\(\{\s*chain,\s*env,/);
});

test('the drafter no longer has a scheduled free-chain route', () => {
  assert.equal(existsSync(join(ROOT, 'app/api/cron/drafts')), false);
});
