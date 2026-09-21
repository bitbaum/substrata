/**
 * Bring-your-own-key: the parts worth testing without a network.
 *
 * `completeByok` makes real HTTP calls to three fixed vendors and is
 * exercised by hand against each one; what belongs in a fast, offline suite
 * is the gate in front of it — the boundary between "a reader's request" and
 * "a header this server is about to send with someone's real key attached".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BYOK_PROVIDERS, ByokError, byokModelLabel, isValidByokConfig } from '../lib/byok';

test('accepts a config for each of the three named vendors', () => {
  for (const provider of BYOK_PROVIDERS) {
    assert.equal(
      isValidByokConfig({ provider, apiKey: 'sk-abcdefgh12345', model: 'some-model' }),
      true,
      provider,
    );
  }
});

test('rejects a vendor not on the fixed list — no free-form base URL', () => {
  // The whole point of a closed list: this server makes the outbound call on
  // the reader's behalf, and an arbitrary base URL there is SSRF wearing a
  // feature request.
  assert.equal(
    isValidByokConfig({ provider: 'my-own-server', apiKey: 'sk-abcdefgh12345', model: 'x' }),
    false,
  );
});

test('rejects a key or model carrying a newline — header injection', () => {
  assert.equal(
    isValidByokConfig({ provider: 'openai', apiKey: 'sk-abc\r\nX-Evil: 1', model: 'gpt-5' }),
    false,
  );
  assert.equal(
    isValidByokConfig({ provider: 'openai', apiKey: 'sk-abcdefgh12345', model: 'a\nb' }),
    false,
  );
});

test('rejects a key that is implausibly short or absurdly long', () => {
  assert.equal(isValidByokConfig({ provider: 'openai', apiKey: 'x', model: 'gpt-5' }), false);
  assert.equal(
    isValidByokConfig({ provider: 'openai', apiKey: 'x'.repeat(500), model: 'gpt-5' }),
    false,
  );
});

test('rejects a missing field, and anything that is not an object', () => {
  assert.equal(isValidByokConfig(null), false);
  assert.equal(isValidByokConfig('sk-abcdefgh12345'), false);
  assert.equal(isValidByokConfig({ provider: 'openai', apiKey: 'sk-abcdefgh12345' }), false);
  assert.equal(isValidByokConfig({ apiKey: 'sk-abcdefgh12345', model: 'gpt-5' }), false);
});

test('the label names the vendor and the model, never the key', () => {
  const label = byokModelLabel({
    provider: 'anthropic',
    apiKey: 'super-secret-value',
    model: 'claude-opus-5',
  });
  assert.equal(label, 'Anthropic · claude-opus-5');
  assert.ok(!label.includes('super-secret-value'));
});

test('ByokError carries the provider so a caller can react per-vendor', () => {
  const err = new ByokError('anthropic', 'Anthropic rejected that key.');
  assert.equal(err.provider, 'anthropic');
  assert.equal(err.name, 'ByokError');
  assert.equal(err.message, 'Anthropic rejected that key.');
});
