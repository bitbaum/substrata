/**
 * Bring-your-own-key: substrata's half. The vendor list, validation and call
 * shape are `@bitbaum/ai-kit/byok` (tested there); what is tested here is the
 * boundary between a request and a key this server is about to use.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BYOK_VENDOR_IDS, ByokError, byokErrorMessage, byokFromBody, byokLabel } from '../lib/byok';
import { vaultEnabled } from '../lib/byok-vault';

const key = ['sk', 'test', 'placeholder'].join('-');

test('every vendor on the shared list is accepted from a request', () => {
  for (const vendor of BYOK_VENDOR_IDS)
    assert.deepEqual(byokFromBody({ vendor, apiKey: key, model: 'm' }), {
      vendor,
      apiKey: key,
      model: 'm',
    });
});

test('a key a browser saved before the shared list (provider, not vendor) still works', () => {
  const parsed = byokFromBody({ provider: 'anthropic', apiKey: key, model: 'claude-opus-5' });
  assert.ok(parsed && parsed !== 'invalid');
  assert.equal(parsed.vendor, 'anthropic');
});

test('no key is not an error; a malformed one is refused — no host, no header smuggling', () => {
  assert.equal(byokFromBody(undefined), undefined);
  assert.equal(byokFromBody(null), undefined);
  assert.equal(
    byokFromBody({ vendor: 'https://evil.example', apiKey: key, model: 'x' }),
    'invalid',
  );
  assert.equal(
    byokFromBody({ vendor: 'openai', apiKey: 'sk-abc\r\nX-Evil: 1', model: 'x' }),
    'invalid',
  );
  assert.equal(byokFromBody({ vendor: 'openai', apiKey: 'x', model: 'x' }), 'invalid');
  assert.equal(byokFromBody('sk-abcdefgh12345'), 'invalid');
});

test('vendor failures read as something a reader can act on, and never carry the key', () => {
  const c = { vendor: 'anthropic' as const, model: 'claude-opus-5' };
  assert.equal(
    byokErrorMessage(c, 'anthropic/claude-opus-5: 401 invalid x-api-key'),
    'Anthropic rejected that key.',
  );
  assert.match(
    byokErrorMessage(c, 'anthropic/claude-opus-5: 404 model not found'),
    /does not recognise/,
  );
  assert.match(byokErrorMessage(c, 'anthropic/claude-opus-5: 429 capacity'), /rate-limiting/);
  assert.equal(
    byokLabel({ vendor: 'google', model: 'models/gemini-flash-latest' }),
    'Google Gemini · models/gemini-flash-latest',
  );
  const err = new ByokError('openai', 'x');
  assert.equal(err.vendor, 'openai');
  assert.equal(err.name, 'ByokError');
});

test('without a sealing secret the vault reports itself off rather than pretending to save', () => {
  const saved = process.env.SUBSTRATA_BYOK_SECRET;
  delete process.env.SUBSTRATA_BYOK_SECRET;
  assert.equal(vaultEnabled(), false);
  process.env.SUBSTRATA_BYOK_SECRET = 'short';
  assert.equal(vaultEnabled(), false);
  if (saved === undefined) delete process.env.SUBSTRATA_BYOK_SECRET;
  else process.env.SUBSTRATA_BYOK_SECRET = saved;
});
