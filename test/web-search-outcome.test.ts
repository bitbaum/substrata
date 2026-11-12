/**
 * How a web search went reaches the reader. Seen on production 2026-11-12:
 * every question showed "Searching the web for …" and then an answer with no
 * web page and no word about it. A search that brings nothing back is said
 * under the answer, and "could not be reached" is never told as "nothing".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extrasOf } from '../lib/chat/answer-chart';
import { emptyLedger, noteWebSearch, type ToolEnv } from '../lib/chat-tools/ledger';
import { runTool } from '../lib/chat-tools/registry';
import type { WebLookup } from '../lib/chat-web';
import { webSearchLine } from '../components/portal/chat/webSearchLine';

const envWith = (lookup: WebLookup): ToolEnv => ({
  ledger: emptyLedger(),
  web: async () => lookup,
});

test('the search tool records how each search went, and the best one is kept', async () => {
  const env = envWith({ status: 'could_not_look' });
  await runTool('web_search', { query: 'helium supply November 2026' }, env);
  assert.equal(env.ledger.webSearch, 'could_not_look');
  env.web = async () => ({ status: 'nothing' });
  await runTool('web_search', { query: 'helium supply' }, env);
  assert.equal(env.ledger.webSearch, 'nothing');
  env.web = async () => ({
    status: 'found',
    findings: [{ title: 'A page', url: 'https://example.org/a', excerpt: 'Helium.' }],
  });
  await runTool('web_search', { query: 'helium' }, env);
  assert.equal(env.ledger.webSearch, 'found');
  // A later failure does not undo a search that found pages.
  noteWebSearch(env.ledger, 'could_not_look');
  assert.equal(env.ledger.webSearch, 'found');
});

test('the outcome rides on the answer only when the web was searched', () => {
  assert.deepEqual(extrasOf(emptyLedger()), {});
  const ledger = emptyLedger();
  noteWebSearch(ledger, 'nothing');
  assert.deepEqual(extrasOf(ledger), { webSearch: 'nothing' });
});

test('the reader is told an outage as an outage, an empty search as empty, and nothing otherwise', () => {
  assert.match(webSearchLine('could_not_look') ?? '', /could not be reached/);
  assert.match(webSearchLine('nothing') ?? '', /returned nothing readable/);
  assert.notEqual(webSearchLine('could_not_look'), webSearchLine('nothing'));
  assert.equal(webSearchLine('found'), null);
  assert.equal(webSearchLine(undefined), null);
});
