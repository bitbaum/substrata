/**
 * The assistant spends money, so the model id is an untrusted input.
 *
 * ai-kit resolves a model it does not find in the chain by PREPENDING it, which
 * means an unrecognised id is tried first against our key. The chain is free
 * only because every id in it is free; a paid id sent to the same OpenRouter
 * key is a bill. The route used to accept any string under 120 characters.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { availableModels, isOfferedModel } from '../lib/chat/models';

test('a model the deployment does not offer is refused', () => {
  for (const id of [
    'anthropic/claude-opus-4',
    'openai/gpt-5',
    'zzz/nonexistent-model-audit-probe',
    '',
    'AUTO',
  ]) {
    assert.equal(isOfferedModel(id), false, `should not offer "${id}"`);
  }
});

test('Auto is always offered, so the picker cannot lock itself out', () => {
  assert.equal(isOfferedModel('auto'), true);
});

test('with a provider keyed, its own models pass and a paid one still does not', () => {
  // Without a key the chain is empty and every id is refused, which would pass
  // even if the guard were `return false`. Key a provider so the check is real.
  const had = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-key-not-a-real-credential';
  try {
    const offered = availableModels().filter((m) => m.id !== 'auto');
    assert.ok(offered.length > 0, 'keying a provider should populate the chain');
    for (const model of offered) {
      assert.equal(isOfferedModel(model.id), true, `keyed but refused: ${model.id}`);
    }
    assert.equal(isOfferedModel('anthropic/claude-opus-4'), false, 'paid id must stay refused');
  } finally {
    if (had === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = had;
  }
});

test('everything the picker lists is accepted, and nothing else is', () => {
  // The two must agree: what `GET /api/chat` advertises is exactly what POST
  // will honour. Drift between them is how an allowlist quietly stops working.
  const offered = availableModels();
  assert.ok(offered.length >= 1, 'Auto is always present');
  for (const model of offered) {
    assert.equal(isOfferedModel(model.id), true, `advertised but refused: ${model.id}`);
  }
  assert.equal(
    offered.some((m) => m.id === 'anthropic/claude-opus-4'),
    false,
    'a paid model must never be advertised by the free chain',
  );
});
