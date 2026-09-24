/**
 * Numbers a reader can check.
 *
 * `<Figure method="…">` sends a reader to /data#method-…, which renders the
 * entry from `lib/methods.ts` and links its code. A method whose code path has
 * been moved or deleted would send them to a 404 on GitHub — an explanation
 * that explains nothing — so every path is checked against the tree.
 */
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

import { METHODS, methodAnchor, methodHref, type MethodId } from '../lib/methods';

const ROOT = process.cwd();

test('every method states a rule, an explanation, and code that exists', () => {
  for (const [id, method] of Object.entries(METHODS)) {
    assert.ok(method.title.length > 3, `${id}: no title`);
    assert.ok(method.formula.length > 20, `${id}: formula too short to explain anything`);
    assert.ok(method.explanation.length > 40, `${id}: explanation too short`);
    assert.ok(method.code.length > 0, `${id}: no code to check it against`);
    for (const path of method.code) {
      assert.ok(existsSync(join(ROOT, path)), `${id}: code path ${path} does not exist`);
    }
  }
});

test('a method link lands on the anchor the method page renders', () => {
  for (const id of Object.keys(METHODS) as MethodId[]) {
    assert.equal(methodHref(id), `/data#${methodAnchor(id)}`);
    assert.match(methodAnchor(id), /^[a-z0-9-]+$/, `${id}: anchor is not URL-safe`);
  }
});
