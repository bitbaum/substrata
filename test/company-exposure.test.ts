/**
 * What constrains a company, what it constrains, and what it holds
 * (lib/company-exposure). The model's promises, held as tests: no edge without
 * a source or a chain, no zero where the truth is "not recorded", and the
 * sentence a page leads with never reads "holds 0 of N".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Dependency } from '../config/substrata-dependencies';
import type { Bottleneck } from '../lib/bottlenecks';
import {
  companyExposure,
  corpus,
  headline,
  type CompanyExposure,
  type ExposureData,
} from '../lib/company-exposure';
import { MARKET_PARTICIPANTS } from '../lib/participants';

const FAB = 'Fab capacity';
const TOOL = 'Scanner';

function bottleneck(name: string, binding: number, makers: string[]): Bottleneck {
  return {
    name,
    slug: name.toLowerCase(),
    binding,
    horizon: 'now',
    judgedOn: '2026-01-01',
    score: { concentration: 3, substitution: 2, leadTime: 3, inelasticity: 3 },
    producers: makers.map((m) => ({
      name: m,
      jurisdictions: [],
      role: `${m} makes it`,
      supplier: false,
      verification: 'sourced',
      source: null,
    })),
  } as unknown as Bottleneck;
}

function dep(
  partial: Partial<Dependency> & Pick<Dependency, 'from' | 'fromKind' | 'on'>,
): Dependency {
  return {
    kind: 'needs',
    source: 'https://example.org/filing',
    quote: 'We rely on Alpha Fab for wafers.',
    primary: true,
    readOn: '2026-10-27',
    ...partial,
  };
}

function world(extra: Partial<ExposureData> = {}): ExposureData {
  return {
    dependencies: [
      dep({ from: 'Chipco', fromKind: 'company', on: FAB }),
      dep({ from: FAB, fromKind: 'bottleneck', on: TOOL, quote: 'Fabs need scanners.' }),
      dep({
        from: 'Otherco',
        fromKind: 'company',
        on: FAB,
        quote: 'We buy wafers from foundries.',
      }),
    ],
    bottlenecks: [bottleneck(FAB, 11, ['Alpha Fab', 'Beta Fab']), bottleneck(TOOL, 12, ['Scanco'])],
    substitutes: [],
    held: (slug) =>
      slug === 'alpha-fab'
        ? [{ bottleneck: FAB, step: 'Runs the capacity', supplier: false }]
        : slug === 'scanco'
          ? [{ bottleneck: TOOL, step: 'Makes it', supplier: false }]
          : [],
    supplyEdges: () => [],
    slugOf: (name) => name.toLowerCase().replace(/\s+/g, '-'),
    ...extra,
  };
}

const subject = (slug: string, name: string) => ({ slug, name });

test('a company that holds nothing is exposed, and says so instead of "holds 0"', () => {
  const x = companyExposure(subject('chipco', 'Chipco'), world());
  assert.equal(x.counts.holds, 0);
  assert.equal(x.counts.exposedTo, 1);
  const { text } = headline(x);
  assert.match(text, /^Exposed to 1 of the 2 bottlenecks/);
  assert.doesNotMatch(text, /holds 0|holds none/i);
});

test('the holder named in the company’s own sentence is stated; the others are derived', () => {
  const [d] = companyExposure(subject('chipco', 'Chipco'), world()).constrainedBy;
  const alpha = d!.makers.find((m) => m.name === 'Alpha Fab')!;
  const beta = d!.makers.find((m) => m.name === 'Beta Fab')!;
  assert.equal(alpha.grade, 'stated');
  assert.equal(alpha.sources.length, 1);
  assert.equal(beta.grade, 'derived');
  assert.ok(beta.chain.length > 0, 'a derived party names the rows it follows from');
});

test('what a holder constrains: stated when the sentence names it, derived otherwise; never past one step as a count', () => {
  const x = companyExposure(subject('alpha-fab', 'Alpha Fab'), world());
  const waiting = x.constrains[0]!.waiting;
  assert.equal(waiting.find((w) => w.name === 'Chipco')!.grade, 'stated');
  assert.equal(waiting.find((w) => w.name === 'Otherco')!.grade, 'derived');
  const tool = companyExposure(subject('scanco', 'Scanco'), world());
  assert.deepEqual(
    tool.constrains[0]!.feeds.map((f) => f.name),
    [FAB],
  );
  assert.deepEqual(tool.constrains[0]!.reached.map((r) => r.name).sort(), ['Chipco', 'Otherco']);
  assert.equal(tool.counts.constrainsOrganisations, 0, 'one step further is a lead, not a count');
});

test('what the things it makes need as inputs is derived and says through what', () => {
  const x = companyExposure(subject('alpha-fab', 'Alpha Fab'), world());
  const inputs = x.constrainedBy.find((d) => d.chokepoint.name === TOOL)!;
  assert.equal(inputs.grade, 'derived');
  assert.equal(inputs.via, FAB);
});

test('rows come hardest-binding first', () => {
  const x = companyExposure(subject('alpha-fab', 'Alpha Fab'), world());
  const bindings = x.constrainedBy.map((d) => d.chokepoint.binding);
  assert.deepEqual(
    bindings,
    [...bindings].sort((a, b) => b - a),
  );
});

test('a company with nothing recorded shows the gap as a task on each side, not a zero', () => {
  const x = companyExposure(subject('nobody', 'Nobody Ltd'), world());
  assert.deepEqual(
    x.unknown.map((u) => `${u.side}:${u.box}`),
    ['constrained-by:suppliers', 'constrains:customers'],
  );
  const h = headline(x);
  assert.equal(h.kind, 'unrecorded');
  assert.match(h.text, /gap in the sources read, not a finding/);
});

test('a sole recorded maker with no written alternative is an open question on alternatives', () => {
  const x = companyExposure(
    subject('toolbuyer', 'Toolbuyer'),
    world({
      dependencies: [
        dep({ from: 'Toolbuyer', fromKind: 'company', on: TOOL, quote: 'We buy scanners.' }),
      ],
    }),
  );
  assert.equal(x.constrainedBy[0]!.soleRecorded, true);
  assert.ok(x.unknown.some((u) => u.side === 'alternatives'));
});

// ---- The real corpus -------------------------------------------------------

const SLUGS = [
  'nvidia',
  'amd',
  'tsmc',
  'asml',
  'sk-hynix',
  'micron',
  'broadcom',
  'intel-foundry',
  'samsung-memory',
  'oklo',
];
const nameOf = (slug: string) => MARKET_PARTICIPANTS.find((p) => p.slug === slug)?.name ?? slug;
const real = (slug: string): CompanyExposure =>
  companyExposure({ slug, name: nameOf(slug) }, corpus());

test('no company in the directory ever gets a headline that reads "holds 0"', () => {
  for (const p of MARKET_PARTICIPANTS) {
    const { text } = headline(real(p.slug));
    assert.doesNotMatch(text, /holds 0|holds none/i, p.name);
  }
});

test('every edge on the real corpus has a source with a quote, or a chain of rows', () => {
  for (const slug of SLUGS) {
    const x = real(slug);
    const parties = [
      ...x.constrainedBy.flatMap((d) => d.makers),
      ...x.constrains.flatMap((c) => [...c.waiting, ...c.reached]),
      ...x.named,
    ];
    for (const p of parties) {
      for (const s of p.sources) {
        assert.match(s.url, /^https?:\/\//, `${slug} → ${p.name}`);
        assert.ok(
          s.quote.length > 0 && s.readOn,
          `${slug} → ${p.name}: a source carries its quote and date`,
        );
      }
      if (p.grade === 'stated' || p.grade === 'corroborated')
        assert.ok(p.sources.length > 0, `${slug} → ${p.name}: stated means a source`);
      else
        assert.ok(
          p.sources.length > 0 || p.chain.length > 0,
          `${slug} → ${p.name}: derived names its rows`,
        );
    }
    for (const d of x.constrainedBy)
      assert.ok(d.evidence.length > 0, `${slug}: ${d.chokepoint.name} has evidence`);
  }
});

test('NVIDIA: exposed to foundry, memory and packaging, hardest first, with the foundries its filing names', () => {
  const x = real('nvidia');
  assert.equal(x.counts.holds, 0);
  assert.deepEqual(x.constrainedBy.map((d) => d.chokepoint.name).sort(), [
    'Advanced packaging capacity',
    'High-bandwidth memory stacking yield',
    'Leading-edge foundry capacity',
  ]);
  const foundry = x.constrainedBy.find(
    (d) => d.chokepoint.name === 'Leading-edge foundry capacity',
  )!;
  assert.equal(foundry.makers.find((m) => m.name === 'TSMC')!.grade, 'stated');
  assert.equal(foundry.makers.find((m) => m.name === 'Intel Foundry')!.grade, 'derived');
  assert.match(headline(x).text, /^Exposed to 3 of the 33/);
});

test('TSMC is waited on by the companies whose filings name it', () => {
  const x = real('tsmc');
  const names = x.constrains.flatMap((c) =>
    c.waiting.filter((w) => w.grade === 'stated').map((w) => w.name),
  );
  for (const expected of ['NVIDIA', 'AMD', 'Broadcom'])
    assert.ok(names.includes(expected), expected);
  assert.ok(x.constrainedBy.some((d) => d.chokepoint.name === 'EUV lithography scanners'));
});

test('ASML constrains the foundries one step on, as a lead and not a count', () => {
  const x = real('asml');
  assert.ok(x.constrains[0]!.reached.some((r) => r.name === 'NVIDIA'));
  assert.equal(x.counts.constrainsOrganisations, 0);
});

test('Oklo, with no evidence read, says exactly what is unknown', () => {
  const x = real('oklo');
  assert.equal(headline(x).kind, 'unrecorded');
  assert.deepEqual(
    x.unknown.map((u) => u.side),
    ['constrained-by', 'constrains'],
  );
});
