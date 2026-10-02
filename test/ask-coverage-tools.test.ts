/**
 * Every section of the site has a tool behind Ask. Round five (2026-10-02):
 * on /science, /policy and /markets Ask said the corpus did not hold what the
 * page it stood on showed — technologies with readiness, rules with backers,
 * SEC filings — and it could not find a price series or a reserves table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runTool, toolDefinitions } from '../lib/chat-tools/registry';
import { emptyLedger, type ToolEnv } from '../lib/chat-tools/ledger';
import { planLookups } from '../lib/chat-agent/plan';
import { readerContext } from '../lib/chat-context';

const env = (extra: Partial<ToolEnv> = {}): ToolEnv => ({ ledger: emptyLedger(), ...extra });
const json = async (name: string, args: Record<string, unknown>, e = env()) =>
  JSON.parse((await runTool(name, args, e)).result);
const plan = (q: string, path?: string) =>
  planLookups(q, readerContext({ path }), { leads: async () => [] }).calls.map((c) => c.name);

test('science: technologies come most-ready first, with what they would relieve', async () => {
  const out = await json('relief_technologies', {});
  const first = out.technologies[0];
  assert.match(first.readiness, /^9\/9/);
  assert.ok(first.would_relieve.length > 0);
  const goes = await json('relief_technologies', {
    bottleneck: 'grain-oriented-electrical-steel-goes',
  });
  assert.ok(
    goes.technologies.every((t: { would_relieve: { bottleneck: string }[] }) =>
      t.would_relieve.some((r) => /GOES/.test(r.bottleneck)),
    ),
  );
});

test('science: the research pipeline is read through the injected store', async () => {
  let asked = '';
  const out = await json(
    'research_pipeline',
    { bottleneck: 'rebco-superconducting-tape-12-mm' },
    env({
      science: async (b) => {
        asked = b;
        return [
          {
            title: 'REBCO critical current',
            kind: 'paper',
            stage: 'basic',
            publishedOn: '2026-10-01',
            url: 'https://doi.org/x',
          } as never,
        ];
      },
    }),
  );
  assert.match(asked, /REBCO/);
  assert.match(out.items[0].link, /^\[REBCO critical current\]\(https:\/\/doi\.org\/x\)$/);
});

test('policy: rules carry effect, status and who asked for them', async () => {
  const out = await json('policy_rules', { effect: 'tightens' });
  assert.ok(out.total > 0);
  for (const r of out.rules) {
    assert.match(r.effect, /slows building/);
    assert.ok(r.asked_for_by);
    assert.match(r.link, /^\[.+\]\(https?:\/\//);
  }
  const eu = await json('policy_rules', { jurisdiction: 'EU' });
  assert.ok(
    eu.rules.length > 0 &&
      eu.rules.every((r: { jurisdiction: string }) => /EU|Europe/i.test(r.jurisdiction)),
  );
});

test('filings: read through the injected store, linked, never described beyond their kind', async () => {
  const out = await json(
    'recent_filings',
    {},
    env({
      filings: async () => [
        {
          accession: 'a',
          cik: 723125,
          company: 'MICRON',
          form: '8-K',
          filedOn: '2026-09-29',
          acceptedAt: '2026-09-29T20:00:00Z',
          items: ['2.02', '9.01'],
          description: '',
          url: 'https://www.sec.gov/x',
        },
      ],
    }),
  );
  assert.deepEqual(out.filings[0].items, ['Results of operations']);
  assert.match(out.filings[0].link, /^\[8-K 2026-09-29\]\(https:\/\/www\.sec\.gov\/x\)$/);
  assert.match(out.status, /not the text/);
});

test('numbers: a price series is found by what it measures; reserves are a table of their own', async () => {
  const tin = await json('find_numbers', { query: 'tin price' });
  assert.ok(
    tin.series.some((s: { metric: string }) => /tin/i.test(s.metric) && /price/i.test(s.metric)),
  );
  const lithium = await json('resource_production', { resource: 'lithium', measure: 'reserves' });
  assert.match(lithium.measure, /reserve/i);
  assert.equal(lithium.top_producers[0].country, 'Chile');
});

test('the planner reaches each section by its words and by the page it is asked on', () => {
  assert.ok(
    plan('Which technology is closest to relieving a bottleneck?').includes('relief_technologies'),
  );
  assert.ok(
    plan('What is closest to production here?', '/science').includes('relief_technologies'),
  );
  assert.ok(
    plan('Which rules slow fab building, and who lobbied for them?').includes('policy_rules'),
  );
  assert.ok(plan('Anything new?', '/policy').includes('policy_rules'));
  assert.ok(plan('What have recent SEC filings said?').includes('recent_filings'));
  assert.ok(plan('What is the price trend for tin?').includes('find_numbers'));
});

test('every new tool is offered when its backend is present', () => {
  const names = toolDefinitions(env({ science: async () => [], filings: async () => [] })).map(
    (d) => d.function.name,
  );
  for (const n of [
    'relief_technologies',
    'research_pipeline',
    'policy_rules',
    'recent_filings',
    'find_numbers',
  ])
    assert.ok(names.includes(n), n);
});

test('a page found again with a new tracking parameter is the same page', async () => {
  const { canonicalUrl } = await import('../lib/sweep');
  const a = canonicalUrl('https://lab.example/blog/helium?srsltid=AU7gw4XA2Y&utm_source=x#top');
  const b = canonicalUrl('https://lab.example/blog/helium?srsltid=AU7gw4WPY3');
  assert.equal(a, 'https://lab.example/blog/helium');
  assert.equal(a, b);
  assert.equal(canonicalUrl('https://x.example/p?id=7&utm_medium=y'), 'https://x.example/p?id=7');
});

test("Substrata's own writing is one listing, reached by its words or from /notes", async () => {
  const out = await json('site_writing', {});
  assert.ok(out.notes.length > 0 && out.guides.length > 0);
  assert.match(out.notes[0].link, /^\[.+\]\(\/notes\/[a-z0-9-]+\)$/);
  assert.ok(
    plan('What has Substrata itself written or published about its methods?').includes(
      'site_writing',
    ),
  );
  assert.ok(plan('Summarise this', '/notes/what-this-map-does-not-know').includes('site_writing'));
  assert.ok(!plan('Can you explain refining methods for gallium?').includes('site_writing'));
});
