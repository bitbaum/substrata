/**
 * The country panel's resource facts, and the regression that started it:
 * "Similar geologies" listed Timor-Leste as Russia's peer because both have
 * natural gas. Peers now come from production rankings, so a country appears
 * only if it ranks on the resource.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countryResources } from '../lib/resources/country';
import { peersFor } from '../lib/resources/peers';
import { countryHeadline } from '../lib/resources/headline';
import { restrictionsFor } from '../lib/resources/restrictions';
import { sanctionsOn, euRegimesFor } from '../lib/resources/sanctions';
import { usgsStatements } from '../lib/resources/statements';
import { rankingCsv, resourceRanking } from '../lib/resources/ranking';
import { countryDossier } from '../lib/geo';

test("Russia's peers come from production rankings, not a shared resource name", () => {
  const groups = peersFor('ru', { resources: 50 });
  assert.ok(groups.length > 0);
  for (const g of groups) {
    assert.ok(g.rank <= 10, `${g.resource}: Russia must rank to have peers`);
    const ranks = g.peers.map((p) => p.rank);
    assert.deepEqual(
      ranks,
      [...ranks].sort((a, b) => a - b),
      `${g.resource}: peers in rank order`,
    );
    assert.ok(!g.peers.some((p) => p.iso2 === 'tl'), `${g.resource}: Timor-Leste does not rank`);
  }
  const nickel = groups.find((g) => g.resource === 'nickel');
  assert.ok(nickel, 'Russia ranks on nickel');
  assert.deepEqual(
    nickel.peers.slice(0, 2).map((p) => p.iso2),
    ['id', 'ph'],
    'nickel peers lead with Indonesia and the Philippines (USGS 2025)',
  );
});

test('a country that ranks nowhere near the top has no peers, and the dossier no "similar" list', () => {
  assert.deepEqual(peersFor('tl'), []);
  assert.ok(!('similar' in (countryDossier('ru') ?? {})));
});

test('resources are ordered by the largest share on any production series', () => {
  const ru = countryResources('ru').measured;
  assert.equal(ru[0].resource, 'pgms', 'palladium: Russia is the largest miner');
  const shares = ru.map((r) => r.significance ?? -1);
  assert.deepEqual(
    shares,
    [...shares].sort((a, b) => b - a),
  );
  assert.equal(
    countryResources('in').measured.find((r) => r.resource === 'bauxite')?.production[0].series,
    'mine-bauxite',
  );
  assert.match(countryHeadline('ru') ?? '', /palladium/);
});

test('restrictions, sanctions and statements are sourced rows or nothing', () => {
  const idNickel = restrictionsFor('id', 'nickel');
  assert.ok(idNickel.length > 0 && idNickel.every((m) => m.lines.length > 0));
  assert.ok(sanctionsOn('ru', 'gold').some((h) => h.by === 'EU' && /gold/i.test(h.text)));
  assert.ok(
    sanctionsOn('ru', 'nickel').some(
      (h) => h.by === 'US' && h.url.startsWith('https://home.treasury.gov/'),
    ),
  );
  assert.deepEqual(sanctionsOn('ch', 'gold'), []);
  assert.deepEqual(euRegimesFor('ch'), []);
  const gallium = usgsStatements('cn', 'gallium');
  assert.ok(gallium.length > 0 && gallium.every((s) => s.text.includes('China')));
});

test('the resource ranking lists China first on gallium and exports CSV with its source', () => {
  const ranking = resourceRanking('gallium');
  assert.ok(ranking);
  assert.equal(ranking.rows[0].iso2, 'cn');
  const csv = rankingCsv(ranking);
  assert.match(csv.split('\n')[0], /^# Source: USGS/);
  assert.match(csv, /\ncn,China,900000,/);
});
