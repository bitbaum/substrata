/**
 * The front page's bar for an unchecked find, pinned on titles the live sweep
 * actually returned on 2026-10-01 — both the news it must keep and the noise
 * that once reached the front page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dateInUrl, reportsAChange } from '../lib/lead-signal';

const KEEP: [string, string][] = [
  [
    'China Eases U.S. Export Controls on Gallium, Germanium, Ultra-Hard Materials',
    'https://www.cirs-group.com/en/chemicals/us-export-controls-eased',
  ],
  [
    'TSMC and Amkor Technology Announce Long Term Partnership to Accelerate Advanced Packaging',
    'https://ir.amkor.com/news-releases/news-release-details/tsmc-and-amkor',
  ],
  [
    'Thyssenkrupp Electrical Steel stops production in France - EUROMETAL',
    'https://eurometal.net/thyssenkrupp-electrical-steel-stops',
  ],
  [
    "As many as 30 jobs cut as The Quartz Corp closes its Spruce Pine location 'indefinitely'",
    'https://wlos.com/news/local/20-to-30-jobs-lost',
  ],
  [
    'Commission imposes provisional safeguard measures on imports of grain-oriented electrical steel',
    'https://policy.trade.ec.europa.eu/news/commission-imposes',
  ],
  [
    '[News] ASE’s SPIL Reportedly Nears Arizona Expansion as TSMC, Amkor Step Up',
    'https://www.trendforce.com/news/2026/09/15/news-ases-spil',
  ],
];

const DROP: [string, string][] = [
  [
    '2026 U.S. Quartz Tariff & Sintered Stone',
    'https://stonefuntek.com/blogs/knowledge/2026-us-quartz-tariff',
  ],
  [
    'Accessories for HV and EHV Extruded Cables | springerprofessional.de',
    'https://www.springerprofessional.de/en/accessories',
  ],
  [
    'AI-Powered Production Planning for High-Value Diamond & Jewellery Factories',
    'https://ifactoryapp.com/industries/diamond-and-jewellery/ai',
  ],
  [
    'thyssenkrupp Steel auf der Coiltech Italia 2026',
    'https://www.thyssenkrupp-steel.com/de/newsroom',
  ],
  [
    'Should Transformer Component Manufacturers Expand Now? A Strategic Timing Framework',
    'https://berlin.cwiemeevents.com/articles/expand-now',
  ],
  [
    'Leading Edge Semi Shortages + Stock Picks - by Tech Fund',
    'https://www.techinvestments.io/p/x',
  ],
  [
    'Behind Tin’s 2026 Record High - Eloro Resources Ltd.',
    'https://www.facebook.com/elororesourcesltd/posts/1',
  ],
];

test('keeps finds that report a change', () => {
  for (const [title, url] of KEEP) assert.equal(reportsAChange(title, url), true, title);
});

test('drops blogs, books, ads, fair notices, questions, stock picks and social posts', () => {
  for (const [title, url] of DROP) assert.equal(reportsAChange(title, url), false, title);
});

test('reads the date a URL was written on, in both common shapes', () => {
  assert.equal(dateInUrl('https://www.energytrend.com/news/20240920-48434.html'), '2024-09-20');
  assert.equal(dateInUrl('https://www.trendforce.com/news/2026/09/15/news-x'), '2026-09-15');
  assert.equal(dateInUrl('https://ir.amkor.com/news-releases/news-release-details/x'), null);
  // A long numeric id is not a date.
  assert.equal(dateInUrl('https://news.metal.com/newscontent/104139397-chinas'), null);
});
