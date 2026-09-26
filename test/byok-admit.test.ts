/**
 * A reader's key is kept only after its vendor accepted it, and only with a
 * model the vendor listed for it. Before this rule the panel enabled "Use
 * this key" with no check and the server sealed whatever shape-valid key it
 * was sent — a dead key saved, to fail later on a question.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { admitKey, type KeyCheck } from '../lib/byok-admit';
import { vetKey, type Probe } from '../lib/byok-check';

const works: KeyCheck = {
  ok: true,
  message: 'Your OpenRouter key works — 2 models available.',
  models: ['anthropic/claude-opus-5.5', 'openai/gpt-5.6'],
  suggested: 'anthropic/claude-opus-5.5',
};
const refused: KeyCheck = {
  ok: false,
  message: 'OpenRouter didn\'t accept this key. OpenRouter says: "User not found."',
  models: [],
  suggested: null,
};

test('an unchecked key is not admitted', () => {
  assert.equal(admitKey(null, 'openai/gpt-5.6').ok, false);
  assert.equal(admitKey(undefined, 'openai/gpt-5.6').ok, false);
});

test('a refused key is not admitted, and the reason is the vendor’s own words', () => {
  const result = admitKey(refused, 'openai/gpt-5.6');
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, refused.message);
});

test('a model the key cannot use is not admitted', () => {
  const result = admitKey(works, 'openai/gpt-4o');
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : '', /can't use openai\/gpt-4o/);
});

test('a listed model on a working key is admitted, trimmed', () => {
  assert.deepEqual(admitKey(works, ' openai/gpt-5.6 '), { ok: true, model: 'openai/gpt-5.6' });
});

test('no list from the vendor: the typed id is accepted, but never an empty or multi-line one', () => {
  const noList = { ...works, models: [], suggested: null };
  assert.deepEqual(admitKey(noList, 'my-model'), { ok: true, model: 'my-model' });
  assert.equal(admitKey(noList, '  ').ok, false);
  assert.equal(admitKey(noList, 'a\r\nX-Evil: 1').ok, false);
});

test('the server asks the vendor before it keeps anything, and follows its answer', async () => {
  const asked: string[] = [];
  const probe =
    (answer: KeyCheck): Probe =>
    async (vendor, apiKey) => {
      asked.push(`${vendor}:${apiKey}`);
      return { ...answer, status: answer.ok ? 200 : 401 };
    };
  const dead = await vetKey('openrouter', 'sk-or-dead', 'openai/gpt-5.6', probe(refused));
  assert.equal(dead.ok, false);
  assert.equal(dead.status, 401);
  const unlisted = await vetKey('openrouter', 'sk-or-live', 'openai/gpt-4o', probe(works));
  assert.equal(unlisted.ok, false);
  const good = await vetKey('openrouter', 'sk-or-live', 'openai/gpt-5.6', probe(works));
  assert.equal(good.ok, true);
  assert.deepEqual(asked, [
    'openrouter:sk-or-dead',
    'openrouter:sk-or-live',
    'openrouter:sk-or-live',
  ]);
});

test('the save and change-model routes vet the key before they write it', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/api/ai-key/route.ts', import.meta.url), 'utf8');
  const body = (name: string) => src.slice(src.indexOf(`export async function ${name}(`));
  for (const [method, write] of [
    ['PUT', 'saveStoredKey('],
    ['PATCH', 'setStoredModel('],
  ] as const) {
    const code = body(method);
    const vet = code.indexOf('await vetKey(');
    const guard = code.indexOf('if (!vetted.ok) return');
    assert.ok(vet > 0 && guard > vet, `${method} must vet the key and stop on a refusal`);
    assert.ok(code.indexOf(write) > guard, `${method} must write only after the key was vetted`);
  }
});
