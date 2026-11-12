import { test } from 'node:test';
import assert from 'node:assert/strict';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { SITE } from '../lib/site';

test('robots() configures public crawling and points to sitemap.xml', () => {
  const result = robots();
  assert.equal(result.sitemap, `${SITE.url}/sitemap.xml`);
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  assert.ok(rules.length > 0);
  const generalRule = rules.find((r) => r.userAgent === '*');
  assert.ok(generalRule, 'has wildcard userAgent rule');
  assert.equal(generalRule?.allow, '/');
  assert.ok(
    Array.isArray(generalRule?.disallow) && generalRule.disallow.includes('/api/'),
    'disallows /api/',
  );
});

test('sitemap() generates valid sitemap entries covering key sections', () => {
  const entries = sitemap();
  assert.ok(Array.isArray(entries), 'sitemap returns an array');
  assert.ok(entries.length > 50, `sitemap has ${entries.length} entries`);

  const urls = new Set(entries.map((e) => e.url));
  const base = SITE.url.replace(/\/$/, '');

  // Static routes
  assert.ok(urls.has(`${base}/`), 'includes root');
  assert.ok(urls.has(`${base}/bottlenecks`), 'includes /bottlenecks');
  assert.ok(urls.has(`${base}/atlas`), 'includes /atlas');
  assert.ok(urls.has(`${base}/markets`), 'includes /markets');
  assert.ok(urls.has(`${base}/policy`), 'includes /policy');
  assert.ok(urls.has(`${base}/capital`), 'includes /capital');
  assert.ok(urls.has(`${base}/science`), 'includes /science');
  assert.ok(urls.has(`${base}/learn`), 'includes /learn');
  assert.ok(urls.has(`${base}/notes`), 'includes /notes');

  // Verify URL format and dates
  for (const entry of entries) {
    assert.ok(entry.url.startsWith('https://'), `entry url must be https: ${entry.url}`);
    assert.ok(entry.lastModified instanceof Date, `lastModified must be Date: ${entry.url}`);
  }
});
