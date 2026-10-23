/**
 * The data Ask could not reach on 2026-10-02, now in its hands: dated figures
 * on every bottleneck record, production tables by country, listed buyers one
 * step downstream, and live job postings. Each test is a question that was
 * answered badly without it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger, type ToolEnv } from '../lib/chat-tools/ledger';
import { resourceIn } from '../lib/chat-tools/resources';
import { keyNumbers } from '../lib/chat-tools/numbers';
import { planLookups } from '../lib/chat-agent/plan';
import { readerContext } from '../lib/chat-context';

const env = (extra: Partial<ToolEnv> = {}): ToolEnv => ({ ledger: emptyLedger(), ...extra });
const json = async (name: string, args: Record<string, unknown>, e = env()) =>
  JSON.parse((await runTool(name, args, e)).result);

test('"how long for a transformer" has a figure, not only a horizon word', async () => {
  const numbers = keyNumbers('large-power-transformer-slots');
  assert.ok(
    numbers.some((n) => /weeks/.test(n.figure ?? '')),
    'a lead time in weeks',
  );
  const record = await json('get_bottleneck', { name: 'large-power-transformer-slots' });
  assert.ok(record.key_numbers.length > 0, 'the record carries its numbers');
  assert.match(record.key_numbers[0].source, /^https?:|: https?:/);
});

test('gallium production: China and its world share, from the USGS table', async () => {
  const out = await json('resource_production', { resource: 'gallium' });
  assert.equal(out.top_producers[0].country, 'China');
  assert.match(out.top_producers[0].world_share, /%$/);
  assert.match(out.source.url, /usgs\.gov/);
});

test('palladium is read from its own series in the platinum-group table', async () => {
  assert.equal(resourceIn('what about palladium supply')?.resource, 'pgms');
  const out = await json('resource_production', { resource: 'palladium', country: 'Russia' });
  assert.match(out.measure, /palladium/i);
  assert.equal(out.top_producers[0].country, 'Russia');
});

test('a country alone lists what it produces, with ranks', async () => {
  const out = await json('resource_production', { country: 'Russia' });
  assert.ok(out.produces.length > 3);
  assert.ok(out.produces.every((p: { rank: number | null }) => p.rank === null || p.rank >= 1));
});

test('EUV exposure names the listed buyers one step downstream, with exchanges', async () => {
  const out = await json('listed_exposure', { bottleneck: 'euv-lithography-scanners' });
  const names = out.listed_makers_downstream.map((d: { company: string }) => d.company);
  assert.ok(names.includes('TSMC'), names.join(', '));
  assert.match(JSON.stringify(out.holders), /Euronext Amsterdam/);
});

test('open roles come from the job board, filtered by country', async () => {
  let asked: unknown;
  const out = await json(
    'open_roles',
    { country: 'Germany', family: 'power-engineering' },
    env({
      jobs: async (filter, limit) => {
        asked = { filter, limit };
        return {
          total: 1,
          jobs: [
            {
              id: 'j1',
              companySlug: 'siemens-energy',
              company: 'Siemens Energy',
              title: 'Transformer design engineer',
              location: 'Nuremberg, Germany',
              countries: ['DE'],
              remote: false,
              family: 'power-engineering',
              seniority: 'mid',
              bottlenecks: ['Large power transformer slots'],
              skills: [],
              postedAt: '2026-09-30T00:00:00.000Z',
              firstSeen: '2026-09-30T00:00:00.000Z',
              url: 'https://jobs.example/j1',
            },
          ],
        };
      },
    }),
  );
  assert.deepEqual((asked as { filter: { country: string } }).filter.country, 'DE');
  assert.equal(out.roles[0].apply, 'https://jobs.example/j1');
  assert.match(out.board, /^\/careers\?/);
});

test('the planner sends job, resource and country questions to the right tables', () => {
  const plan = (q: string) =>
    planLookups(q, readerContext({}), { leads: async () => [] }).calls.map((c) => c.name);
  assert.ok(
    plan('I am an electrical engineer in Germany, where are the jobs?').includes('open_roles'),
  );
  assert.ok(plan('Who produces gallium besides China?').includes('resource_production'));
  assert.ok(plan('Does Russia matter for any of these?').includes('resource_production'));
  assert.ok(
    !plan('What is new on gallium export controls?').includes('resource_production') ||
      plan('What is new on gallium export controls?').includes('recent_leads'),
  );
});

test('quantities arrive as the table prints them, to be copied: "6,000 kg (estimated)", never "6 kt"', async () => {
  const { quantityDisplay } = await import('../lib/chat-tools/resources');
  assert.equal(quantityDisplay('900,000', 'kg', true), '900,000 kg (estimated)');
  assert.equal(quantityDisplay('270,000', 't'), '270,000 t');
  assert.equal(quantityDisplay('withheld (W)', 'kg'), 'withheld (W)');
  // The question that produced "Russia … 6 kt" on 2026-10-23 is planned onto the table.
  const question = 'Who produces gallium, and how concentrated is it?';
  assert.ok(
    planLookups(question, readerContext({}), { leads: async () => [] }).calls.some(
      (c) => c.name === 'resource_production',
    ),
  );
  const out = await json('resource_production', { resource: 'gallium' });
  const russia = out.top_producers.find((p: { country: string }) => p.country === 'Russia');
  assert.equal(out.unit, 'kg');
  assert.equal(russia.display, '6,000 kg (estimated)');
  // No second spelling of the quantity for a model to recombine.
  assert.doesNotMatch(JSON.stringify(out), /\(= |\bkt\b|thousand t/);
  const country = await json('resource_production', { country: 'Russia' });
  assert.ok(country.produces.every((p: { display?: string }) => !p.display || / /.test(p.display)));
});

test('job words pick a role family, and an empty filter is loosened, never a bare zero', async () => {
  const { familyIn } = await import('../lib/chat-tools/jobs');
  assert.equal(familyIn('I am an electrical engineer in Germany'), 'power-engineering');
  assert.equal(familyIn('power engineering jobs in the US'), 'power-engineering');
  const seen: unknown[] = [];
  const out = await json(
    'open_roles',
    { bottleneck: 'large-power-transformer-slots', family: 'power-engineering', country: 'US' },
    env({
      jobs: async (filter) => {
        seen.push({ ...filter });
        return filter.bottleneck ? { jobs: [], total: 0 } : { jobs: [], total: 11 };
      },
    }),
  );
  assert.equal(out.total_open, 11);
  assert.match(out.relaxed, /bottleneck/);
  assert.equal(seen.length, 2, 'one retry, without the bottleneck');
});

test('a change is stated as up or down in words, never as a bare sign', () => {
  const rows = keyNumbers('large-power-transformer-slots');
  const changed = rows.find((r) => r.change);
  assert.ok(changed, 'some series has a previous point');
  assert.match(changed!.change!, /^(up|down) \d/);
});
