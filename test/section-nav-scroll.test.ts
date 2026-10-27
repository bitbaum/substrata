import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// scrollIntoView scrolls every ancestor, the page included. On the sticky phone
// strip it threw the page back ~70px each time the marked section changed, so
// a swipe fought the finger. The strip must be moved by its own scrollLeft.
test('SectionNav never calls scrollIntoView', () => {
  const src = readFileSync(new URL('../components/portal/SectionNav.tsx', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /scrollIntoView/);
});
