import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { entitiesOfKind } from '../lib/entities/registry';
import { countryProfile } from '../lib/world/profile';
import { produces } from '../lib/profile/modules/country';

test('a country share stays a share of the world when rendered by the released chart package', () => {
  const entity = entitiesOfKind('country').find((entry) => entry.key === 'ne');
  const data = countryProfile('ne');
  assert.ok(entity && data);
  assert.ok(data.produces.some((row) => row.significant && row.share !== null && row.share > 0));
  assert.ok(data.produces.every((row) => row.share === null || row.share < 1));
  const html = renderToStaticMarkup(React.createElement(produces.Render, { entity, data }));
  const widths = [...html.matchAll(/class="ck-bar-fill" style="width:([\d.]+)%"/g)].map((match) =>
    Number(match[1]),
  );
  assert.ok(widths.length > 0, 'the actual country module renders shared bars');
  assert.ok(
    widths.every((width) => width > 0 && width < 100),
    'a minority share must not look like a monopoly',
  );
  assert.match(html, /<table/);
  assert.match(html, /% of world/);
});
