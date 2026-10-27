/** The Ask reads the registry: a private lab is answerable, a gap is a gap. */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FRONTIER_TOOLS } from '@/lib/chat-tools/frontier';
import { CHAT_TOOLS } from '@/lib/chat-tools/registry';
import { emptyLedger } from '@/lib/chat-tools/ledger';

interface R {
  [k: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const tool = (name: string) => FRONTIER_TOOLS.find((t) => t.name === name)!;
const env = () => ({ ledger: emptyLedger() }) as never;

test('the registry tools are offered to the model', () => {
  for (const t of FRONTIER_TOOLS) assert.ok(CHAT_TOOLS.includes(t), t.name);
});

test('a private company in the registry is answered, with its grade and its gaps', async () => {
  const r = (await tool('registered_company').run({ company: 'Figure AI' }, env())) as R;
  assert.equal(r.company, 'Figure AI');
  assert.equal(r.kind, 'Private company');
  assert.match(r.what_it_is.source, /^https:\/\//);
  assert.ok(r.not_known_yet.includes('Funding, valuation, headcount'), 'no figure is invented');
});

test('an unknown company is said to be unregistered, not described', async () => {
  const r = (await tool('registered_company').run(
    { company: 'Zzyzx Imaginary Robotics' },
    env(),
  )) as R;
  assert.equal(r.status, 'not registered');
  assert.equal(r.what_it_is, undefined);
});

test('companies_in_area lists members with their sub-areas rolled up', async () => {
  const r = (await tool('companies_in_area').run({ area: 'robotics' }, env())) as R;
  assert.ok(r.registered >= 1);
  assert.match(r.why_it_matters, /Substrata's framing/);
  const none = (await tool('companies_in_area').run({ area: 'no such place xyz' }, env())) as R;
  assert.ok(none.error || none.area);
});
