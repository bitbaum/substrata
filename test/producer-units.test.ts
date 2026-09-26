/**
 * A capacity without its unit is a wrong number, not a short one. USGS prints a
 * table default ("thousand metric tons") and overrides it per commodity in an
 * unheaded column; the extractor once dropped that column, so China's largest
 * gallium plant read "capacity 150" under a table unit that made it 150,000 t —
 * for a metal whose world output is about 900 t.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { facilitiesFor } from '../lib/resources/producers';
import data from '../research/usgs-producers.json';

const rows = (
  data as { countries: { facilities: { capacity: string; unit?: string }[] }[] }
).countries.flatMap((c) => c.facilities);

test('every USGS facility row names the unit of its capacity', () => {
  const missing = rows.filter((f) => !f.unit);
  assert.equal(missing.length, 0, `${missing.length} of ${rows.length} rows have no unit`);
});

test('no unit is cut off where the workbook wrapped it ("metric" / "tons")', () => {
  const cut = rows.filter((f) =>
    /\b(metric|cubic|thousand|million|billion|troy)$/i.test(f.unit ?? ''),
  );
  assert.deepEqual(
    cut.map((f) => f.unit),
    [],
  );
});

test("a commodity's own unit wins over the table default", () => {
  const gallium = facilitiesFor('cn', 'gallium');
  assert.ok(gallium && gallium.rows.length > 0, 'China gallium rows present');
  for (const f of gallium.rows) assert.equal(f.unit, 'metric tons', f.companies);
});

test('rows without an override use the table default', () => {
  // Most rows carry no override, so the default must be the most common unit.
  const counts = new Map<string, number>();
  for (const f of rows) counts.set(f.unit ?? '', (counts.get(f.unit ?? '') ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  assert.match(top, /metric tons$/);
});
