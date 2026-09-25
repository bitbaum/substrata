/**
 * A heading with nothing under it is noise. Russia's panel once printed
 * "Not recorded" 25 times — two empty headings per resource. Empty blocks are
 * now omitted and the absence is stated once per resource.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ResourceContext } from '../components/portal/resources/ResourceContext';
import { countryResources } from '../lib/resources/country';

test('no empty headings, and absence stated at most once per resource', () => {
  const resources = countryResources('ru').measured.map((r) => r.resource);
  assert.ok(resources.length > 3, 'Russia has several resources with figures');
  for (const resource of resources) {
    const html = renderToStaticMarkup(
      React.createElement(ResourceContext, { iso2: 'ru', resource }),
    );
    assert.ok(!/Not recorded/.test(html), `${resource}: no "Not recorded" rows`);
    assert.ok(
      (html.match(/Not in the sources read/g) ?? []).length <= 1,
      `${resource}: one absence line`,
    );
    // Every heading is followed by content, not straight by another heading or the end.
    assert.ok(
      !/<\/h4>\s*(<h4|<p class="resource-empty"|<\/div>)/.test(html),
      `${resource}: empty heading`,
    );
  }
});
