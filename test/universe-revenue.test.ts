/** Annual revenue as a size row: dollars only, quoted exactly, never converted. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { revenueOf, revenueRow } from '../lib/sources/edgar-revenue';
import { admit } from '../lib/universe/admit';

const fact = (unit: string, val: number) =>
  JSON.stringify({
    cik: 1234,
    entityName: 'Foreign Filer plc',
    facts: {
      'us-gaap': {
        Revenues: {
          units: {
            [unit]: [
              {
                start: '2025-01-01',
                end: '2025-12-31',
                val,
                accn: '0000001234-26-000007',
                fy: 2025,
                fp: 'FY',
                form: '20-F',
                filed: '2026-03-01',
              },
            ],
          },
        },
      },
    },
  });

test('a dollar revenue becomes a row whose quote is the served fact, byte for byte', () => {
  const text = fact('USD', 410_000_000);
  const read = revenueOf(text, '2026-10-27T00:00:00Z')!;
  assert.equal(read.usd, 410_000_000);
  assert.ok(text.includes(read.quote), 'the quote is in the fetched text');
  const row = revenueRow('foreign-filer', read, '2026-10-27');
  assert.equal(row.establishes.size?.basis, 'revenue');
  assert.equal(row.asOf, '2025-12-31');
});

test('a revenue in another currency is left alone: no rate is invented', () => {
  assert.equal(revenueOf(fact('EUR', 900_000_000), 'x'), null);
});

test('revenue over the floor clears materiality for a filer with no float', () => {
  const read = revenueOf(fact('USD', 410_000_000), '2026-10-27T00:00:00Z')!;
  const d = admit(
    {
      slug: 'foreign-filer',
      name: 'Foreign Filer plc',
      rows: [
        revenueRow('foreign-filer', read, '2026-10-27'),
        {
          company: 'foreign-filer',
          name: 'Foreign Filer plc',
          family: 'registry',
          evidence: 'candidate',
          asOf: '2026-10-27',
          source: {
            url: 'https://example.com/x',
            quote: 'a registry row to quote',
            readOn: '2026-10-27',
          },
          submittedBy: { agent: 'test', model: 'unrecorded', runId: 't' },
          establishes: {
            theme: 'compute',
            themeBasis: 'sic',
            ids: { ticker: 'FF', exchange: 'US' },
          },
        },
      ],
    },
    { today: '2026-10-27' },
  );
  assert.equal(d.admitted, true);
  assert.ok(d.tests.materiality.evidence.some((a) => a.basis === 'revenue'));
});
