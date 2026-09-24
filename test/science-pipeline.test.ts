/**
 * The science pipeline's rules: what counts as relevant, which stage an item
 * is evidence for, how each feed is read, and how an institution becomes a
 * company with a ticker. Fixtures are trimmed copies of real responses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NOT_SEARCHED_WHY, SCIENCE_QUERIES, stageForReadiness } from '../config/substrata-pipeline';
import { SCIENCE } from '../config/substrata-science';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { MIN_RELEVANCE, placeItem, relevance, titleKey, type ScienceItem } from '../lib/science';
import { invertedToText, parseArxiv, parseOpenAlex } from '../lib/science-sources';
import { parseNsf, parseOpenAire, parseUsaSpending } from '../lib/science-grants';
import { funnelFor, judgementsFor, matchDirectory } from '../lib/science-pipeline';
import { cellStatus } from '../components/science/StageBar';
import { scienceItems } from '../lib/desk-science';
import { applyFilter, itemKey, type FeedFilter } from '../lib/desk-filter';
import type { StoredItem } from '../lib/science-read';

const EUV = SCIENCE_QUERIES['EUV lithography scanners'];

function item(over: Partial<ScienceItem> = {}): ScienceItem {
  return {
    id: 'openalex:W1',
    source: 'openalex',
    kind: 'paper',
    title: '',
    abstract: '',
    venue: null,
    year: 2026,
    publishedOn: '2026-09-20',
    url: 'https://doi.org/10.1/x',
    doi: '10.1/x',
    pdfUrl: null,
    citations: 0,
    institutions: [],
    funder: null,
    programme: null,
    amount: null,
    currency: null,
    ...over,
  };
}

test('every searched bottleneck exists, and every bottleneck is searched or says why not', () => {
  const names = new Set(BOTTLENECKS.map((b) => b.name));
  for (const name of [...Object.keys(SCIENCE_QUERIES), ...Object.keys(NOT_SEARCHED_WHY)])
    assert.ok(names.has(name), `${name} is not a bottleneck`);
  for (const b of BOTTLENECKS)
    assert.ok(b.name in SCIENCE_QUERIES || b.name in NOT_SEARCHED_WHY, `${b.name}: no query`);
});

test('an astrophysics preprint about extreme ultraviolet light is not lithography', () => {
  const solar = item({
    title: 'Non-local thermal transport in flare-driven chromospheric evaporation',
    abstract: 'Observed in extreme ultraviolet emission lines from the solar corona.',
  });
  assert.ok(relevance(solar, EUV).score < MIN_RELEVANCE);
  const litho = item({ title: 'High-NA in-line projector for EUV lithography' });
  assert.ok(relevance(litho, EUV).score >= MIN_RELEVANCE);
});

test('a plural names the thing; an excluded field drops it', () => {
  const rebco = SCIENCE_QUERIES['REBCO superconducting tape, 12 mm'];
  const plural = item({ title: 'Delamination strength of coated conductors under current' });
  assert.deepEqual(relevance(plural, rebco).matched, ['coated conductor']);
  const hbm = SCIENCE_QUERIES['High-bandwidth memory stacking yield'];
  const weld = item({ title: 'Friction stir rivet welding: a hybrid bonding approach' });
  assert.equal(relevance(weld, hbm).score, 0);
});

test('stages: grants by programme, papers by wording, never past pilot', () => {
  const grant = (title: string, programme: string | null = null, source = 'nsf') =>
    placeItem(item({ kind: 'grant', source: source as ScienceItem['source'], title, programme }))
      .stage;
  assert.equal(grant('STTR Phase II: Miniature precision stage for hybrid bonding'), 'pilot');
  assert.equal(grant('SBIR Phase I: Neon recovery for excimer lasers'), 'applied');
  assert.equal(grant('Collaborative research: magnet physics'), 'fundamental');
  assert.equal(grant('Rebco cables for accelerator magnets', null, 'doe'), 'applied');
  assert.equal(grant('Resist platform', 'HORIZON-IA'), 'pilot');
  const paper = (abstract: string, company = false) =>
    placeItem(
      item({
        title: 't',
        abstract,
        institutions: company
          ? [{ name: 'ASML (Netherlands)', type: 'company', country: 'NL' }]
          : [],
      }),
    ).stage;
  assert.equal(paper('We fabricate a device and report its yield.'), 'applied');
  assert.equal(paper('A theory of secondary electron blur.'), 'fundamental');
  assert.equal(paper('Status of the pilot line for CNT pellicles.', true), 'pilot');
  assert.equal(paper('Status of the pilot line for CNT pellicles.'), 'fundamental');
});

test('readiness maps onto stages by the stated bands', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 7, 8, 9].map(stageForReadiness), [
    'fundamental',
    'fundamental',
    'applied',
    'applied',
    'pilot',
    'pilot',
    'early',
    'scale',
  ]);
});

test('OpenAlex: abstract rebuilt, DOI link, institutions kept, datasets dropped', () => {
  assert.equal(invertedToText({ lithography: [2], EUV: [1], High: [0] }), 'High EUV lithography');
  const parsed = parseOpenAlex({
    results: [
      {
        id: 'https://openalex.org/W7',
        doi: 'https://doi.org/10.1117/12.1',
        title: 'Pellicle <i>lifetime</i>',
        type: 'article',
        publication_date: '2026-09-01',
        publication_year: 2026,
        cited_by_count: 4,
        primary_location: { source: { display_name: 'Proc. SPIE' } },
        best_oa_location: { pdf_url: 'https://x/y.pdf' },
        authorships: [
          {
            institutions: [
              { display_name: 'ASML (Netherlands)', type: 'company', country_code: 'NL' },
            ],
          },
          {
            institutions: [
              { display_name: 'ASML (Netherlands)', type: 'company', country_code: 'NL' },
            ],
          },
        ],
        abstract_inverted_index: { EUV: [0], pellicles: [1] },
      },
      { id: 'https://openalex.org/W8', title: 'Dataset for x', type: 'dataset' },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'Pellicle lifetime');
  assert.equal(parsed[0].url, 'https://doi.org/10.1117/12.1');
  assert.equal(parsed[0].citations, 4);
  assert.equal(parsed[0].institutions.length, 1);
  assert.equal(parsed[0].abstract, 'EUV pellicles');
});

test('arXiv: id, PDF link and date from the Atom entry', () => {
  const [p] = parseArxiv(`<feed><entry>
    <id>http://arxiv.org/abs/2609.01234v2</id><published>2026-09-10T00:00:00Z</published>
    <title>Tin droplet &amp; plasma</title><summary>  Laser-produced plasma.  </summary>
    <arxiv:affiliation>TU Delft</arxiv:affiliation></entry></feed>`);
  assert.equal(p.id, 'arxiv:2609.01234');
  assert.equal(p.title, 'Tin droplet & plasma');
  assert.equal(p.pdfUrl, 'https://arxiv.org/pdf/2609.01234');
  assert.equal(p.publishedOn, '2026-09-10');
  assert.deepEqual(
    p.institutions.map((i) => i.name),
    ['TU Delft'],
  );
});

test('grants: NSF dates, OpenAIRE skips NSF and links CORDIS, DOE marks ARPA-E', () => {
  const [nsf] = parseNsf({
    response: {
      award: [
        {
          id: '2450526',
          title: 'T',
          date: '04/01/2025',
          fundsObligatedAmt: '1184000',
          awardeeName: 'U',
        },
      ],
    },
  });
  assert.equal(nsf.publishedOn, '2025-04-01');
  assert.equal(nsf.amount, 1184000);
  const aire = parseOpenAire({
    results: [
      { id: 'a', title: 'x', fundings: [{ shortName: 'NSF' }] },
      {
        id: 'b',
        code: '101',
        title: 'y',
        startDate: '2025-01-01',
        fundings: [
          {
            shortName: 'EC',
            name: 'European Commission',
            fundingStream: { id: 'EC::HE::HORIZON-RIA' },
          },
        ],
        granted: { fundedAmount: 5, currency: 'EUR' },
      },
    ],
  });
  assert.deepEqual(
    aire.map((a) => a.url),
    ['https://cordis.europa.eu/project/id/101'],
  );
  assert.equal(aire[0].programme, 'EC::HE::HORIZON-RIA');
  const [doe] = parseUsaSpending({
    results: [
      {
        'Award ID': 'DEAR0001815',
        'Recipient Name': 'AMPEERS LLC',
        'Start Date': '2025-02-18',
        'Award Amount': 206500,
        Description: 'FLAT REBCO CABLES',
        generated_internal_id: 'ASST_1',
      },
    ],
  });
  assert.equal(doe.title, 'Flat rebco cables');
  assert.equal(doe.programme, 'ARPA-E');
  assert.equal(doe.url, 'https://www.usaspending.gov/award/ASST_1');
});

test('a preprint and its journal version share one key', () => {
  assert.equal(titleKey('Tin droplet: plasma.'), titleKey('Tin Droplet — Plasma'));
});

test('institutions join the directory strictly, a parent shown as the parent', () => {
  assert.equal(matchDirectory('ASML (Netherlands)')?.name, 'ASML');
  assert.equal(matchDirectory('Taiwan Semiconductor Manufacturing Company (Taiwan)')?.name, 'TSMC');
  assert.equal(matchDirectory('Intel (United States)')?.name, 'Intel');
  assert.equal(matchDirectory('Quartz Mountain Resources'), null);
  assert.equal(matchDirectory('IBM (United States)'), null);
});

test('a judgement with no citation is claimed, never established', () => {
  for (const s of SCIENCE) {
    for (const r of s.relieves) {
      const cell = funnelFor(r.bottleneck, []).find(
        (c) => c.stage === stageForReadiness(s.readiness),
      )!;
      assert.ok(judgementsFor(r.bottleneck).some((j) => j.name === s.name));
      assert.equal(
        cellStatus(cell),
        cell.judgements.some((j) => j.source) ? 'established' : 'claimed',
      );
    }
  }
});

test('science rows on the desk: one per work, a mark key the desk accepts, a switch that hides them', () => {
  const base = {
    ...item({ id: 'openaire:nsf___::c9', title: 'Same work' }),
    bottleneck: 'A',
    score: 3,
    matched: [],
    stage: 'applied' as const,
    stageWhy: '',
    alsoUrls: [],
    review: 'unreviewed',
    firstSeen: '',
  } satisfies StoredItem;
  const rows = scienceItems([base, { ...base, bottleneck: 'B' }]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].bottlenecks, ['A', 'B']);
  assert.match(itemKey(rows[0]), /^(event|lead|filing|science):[\w.-]{1,120}$/);
  const filter: FeedFilter = {
    view: 'all',
    days: null,
    showVerified: true,
    showLeads: true,
    showFilings: true,
    effect: null,
    bottlenecks: [],
    q: '',
    mutedHosts: [],
    mutedWords: [],
    readUntil: null,
  };
  const none = { read: new Set<string>(), saved: new Set<string>(), hidden: new Set<string>() };
  assert.equal(applyFilter(rows, filter, none).length, 1);
  assert.equal(applyFilter(rows, { ...filter, showScience: false }, none).length, 0);
});
