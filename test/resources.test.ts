/**
 * The USGS world tables, as the map and the country panel read them.
 *
 * The parser (scripts/research/usgs-mcs.py) already refuses to write a file
 * whose rows do not add up to the world total. These tests pin what the
 * TypeScript layer promises the map: a country USGS does not list is absent
 * (not zero), a withheld figure is not a number, and a share of a "more than"
 * total is not computed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chapters, countryRows, numeric, seriesOf, worldRow } from '../lib/resources/usgs';
import { choropleth, choroplethOptions } from '../lib/resources/choropleth';
import { RESOURCE_KINDS } from '../config/substrata-resources';

test('every USGS chapter maps to a Substrata resource and adds up to its world total', () => {
  const ids = new Set(RESOURCE_KINDS.map((r) => r.id as string));
  for (const chapter of chapters()) {
    assert.ok(ids.has(chapter.resource), `${chapter.slug}: unknown resource ${chapter.resource}`);
    assert.ok(/^https:\/\/(pubs\.usgs\.gov|www\.eia\.gov)\//.test(chapter.url), chapter.slug);
    const world = worldRow(chapter);
    assert.ok(world, `${chapter.slug}: no world row`);
    for (const series of seriesOf(chapter)) {
      if (series.measure !== 'production') continue;
      for (const key of Object.values(series.keys)) {
        const total = numeric(world.cells[key], series.unit, series.unit);
        if (!total || world.cells[key].moreThan) continue;
        if (chapter.rows.some((r) => r.cells[key]?.withheld)) continue;
        const sum = chapter.rows
          .filter((r) => r.kind !== 'world')
          .reduce((s, r) => s + (numeric(r.cells[key], series.unit, series.unit) ?? 0), 0);
        assert.ok(
          Math.abs(sum - total) / total < 0.06,
          `${chapter.slug} ${key}: ${sum} vs ${total}`,
        );
      }
    }
    for (const row of countryRows(chapter)) assert.match(row.iso2 ?? '', /^[a-z]{2}$/, row.name);
  }
});

test('nickel: Indonesia leads, shares are value ÷ world total, unlisted countries are absent', () => {
  const map = choropleth('nickel');
  assert.ok(map);
  assert.equal(map.year, 2025);
  assert.equal(map.unit, 't');
  const id = map.values.id;
  assert.equal(id.rank, 1);
  assert.equal(id.value, 2_600_000);
  assert.ok(Math.abs((id.share ?? 0) - 2_600_000 / 3_900_000) < 1e-9);
  assert.equal(map.values.ph.rank, 2);
  assert.equal(map.values.ru.rank, 3);
  assert.equal(map.values.tl, undefined, 'Timor-Leste is not in the USGS nickel table');
  assert.ok(map.source.url.endsWith('mcs2026-nickel.pdf'));
  assert.ok(map.hhi !== null && map.hhi > 0.4, 'nickel is concentrated in Indonesia');
});

test('withheld is not a number, and a "more than" world total yields no share', () => {
  const lithium = choropleth('lithium');
  assert.equal(lithium?.values.us.status, 'withheld');
  assert.equal(lithium?.values.us.value, null);
  assert.equal(lithium?.values.us.rank, null);
  const reserves = choropleth('nickel', { measure: 'reserves' });
  assert.equal(reserves?.world.moreThan, true);
  assert.equal(reserves?.values.id.share, null);
  assert.equal(reserves?.values.id.rank, 1);
});

test('bauxite ranks the mine, not the alumina refinery; unknown resources return null', () => {
  const bauxite = choropleth('bauxite');
  assert.equal(bauxite?.series, 'mine-bauxite');
  assert.equal(bauxite?.values.gn.rank, 1);
  assert.equal(choropleth('neon'), null);
  assert.equal(choropleth('natural-gas')?.values.ru.rank, 2, 'EIA dry gas: Russia second to the US');
  assert.ok(choroplethOptions().some((o) => o.resource === 'gallium'));
});
