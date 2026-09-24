/**
 * Readers first: on this box's keys (Groq + OpenRouter), an hourly drafter
 * that runs all day can never leave Ask below the floor kept for readers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classBudget } from '@bitbaum/ai-kit';

import { CLASS_POLICY, dayCapacity } from '../lib/ai-budget';

const env = { GROQ_API_KEY: 'x', OPENROUTER_API_KEY: 'x' } as unknown as NodeJS.ProcessEnv;
const LEAD = 12_000;

test('a day of hourly drafting (5 leads/run) stops at its cap; readers keep three quarters', () => {
  const capacity = dayCapacity(env);
  assert.ok(capacity > 0);
  const spent = { interactive: 0, background: 0 };
  let drafted = 0;
  for (let hour = 0; hour < 24; hour++)
    for (let lead = 0; lead < 5; lead++) {
      const d = classBudget({
        dayCapacityTokens: capacity,
        spent,
        cls: 'background',
        costTokens: LEAD,
        policy: CLASS_POLICY,
      });
      if (!d.allowed) break;
      spent.background += LEAD;
      drafted++;
    }
  assert.ok(spent.background <= capacity * 0.25);
  assert.ok(capacity - spent.background >= capacity * 0.5);
  assert.ok(drafted > 0 && drafted < 120, `drafted ${drafted} of 120 wanted`);
});

test('after a busy reader morning, background is held so the rest of the day stays theirs', () => {
  const capacity = dayCapacity(env);
  const spent = { interactive: capacity * 0.45, background: 0 };
  const d = classBudget({
    dayCapacityTokens: capacity,
    spent,
    cls: 'background',
    costTokens: LEAD,
    policy: CLASS_POLICY,
  });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'reserved');
  const reader = classBudget({
    dayCapacityTokens: capacity,
    spent,
    cls: 'interactive',
    costTokens: 16_000,
    policy: CLASS_POLICY,
  });
  assert.equal(reader.allowed, true);
});
