/**
 * Every Substrata web search walks the configured backends, then ai-kit's
 * keyless ones. Seen on production 2026-11-11/12: SearXNG down, no paid key,
 * and nothing could be looked up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SEARCH_USER_AGENT, searchProviders } from '../lib/web-search';
import { webLookupEnabled } from '../lib/chat-web';

/** A process env without the ambient one leaking in (as test/chat-web.test.ts). */
function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...extra } as NodeJS.ProcessEnv;
}

test('configured backends first, then GDELT news, then Wikipedia', () => {
  assert.deepEqual(
    searchProviders(globalThis.fetch, env({ SEARXNG_URL: 'http://127.0.0.1:9' })).map(
      (p) => p.name,
    ),
    ['searxng', 'gdelt', 'wikipedia'],
  );
  assert.match(SEARCH_USER_AGENT, /substrata\.orangecat\.ch/);
});

test('looking up is still offered only where a backend is configured', () => {
  assert.equal(webLookupEnabled(env()), false);
  assert.equal(webLookupEnabled(env({ SEARXNG_URL: 'http://127.0.0.1:9' })), true);
});
