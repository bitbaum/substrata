/**
 * Every internal link has to point at something that exists.
 *
 * Until this file, nothing checked that. There were 29 hand-built URLs across
 * the pages and the only route test covered the navigation config, so a typo
 * in `/bottlnecks/${slug}` would have shipped and 404'd quietly. This change
 * adds several hundred more links, which is exactly the wrong moment to keep
 * trusting that they are fine.
 *
 * The approach: collect every href the site can generate from data, and check
 * each against the routes the app actually serves plus the set of slugs each
 * dynamic route generates. It cannot catch a typo hard-coded inside JSX — for
 * that the fix was routing them through `lib/links.ts` so there is nothing to
 * mistype — but it does catch the far more likely failure, which is data
 * naming an entity that does not exist.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CALLS } from '../config/substrata-calls';
import { CAPITAL_PROVIDERS, FUNDING_ASSESSMENTS } from '../config/substrata-capital';
import { EVENTS } from '../config/substrata-events';
import { GLOSSARY, glossaryAnchor } from '../config/substrata-glossary';
import {
  INSTRUMENTS,
  POLICY_PAGES,
  RECOMMENDATIONS,
  hasPolicyPage,
} from '../config/substrata-policy';
import { SCIENCE } from '../config/substrata-science';
import { navGroups, navPaths } from '../config/site-nav';
import { sitePages } from '../config/site-content';
import { BOTTLENECKS } from '../lib/bottlenecks';
import {
  ROUTES,
  bottleneckHref,
  capitalHref,
  glossaryHref,
  isInternal,
  marketHref,
  pathOf,
  policyHref,
  scienceHref,
} from '../lib/links';
import { allLearn, allNotes } from '../lib/notes';
import { MARKET_PARTICIPANTS } from '../lib/participants';

/** What each dynamic route can actually serve, from the same source the pages use. */
const GENERATED: Record<string, Set<string>> = {
  '/bottlenecks': new Set(BOTTLENECKS.map((b) => b.slug)),
  '/markets': new Set(MARKET_PARTICIPANTS.map((p) => p.slug)),
  '/policy': new Set(POLICY_PAGES),
  '/science': new Set(SCIENCE.map((s) => s.id)),
  '/capital': new Set(CAPITAL_PROVIDERS.map((p) => p.id)),
  '/notes': new Set(allNotes().map((n) => n.slug)),
  '/learn': new Set(allLearn().map((l) => l.slug)),
};

const STATIC_ROUTES = new Set<string>(ROUTES.filter((r) => !r.includes(':')));

/** Anchors a link may target, by page. */
const ANCHORS: Record<string, Set<string>> = {
  '/learn': new Set(GLOSSARY.map((g) => glossaryAnchor(g.term))),
};

function resolves(href: string): string | null {
  if (!isInternal(href)) return null;
  const path = pathOf(href);
  const hash = href.includes('#') ? href.split('#')[1] : null;

  if (hash) {
    const anchors = ANCHORS[path];
    if (anchors && !anchors.has(hash)) return `anchor #${hash} does not exist on ${path}`;
  }

  if (STATIC_ROUTES.has(path)) return null;

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 2) {
    const base = `/${segments[0]}`;
    const generated = GENERATED[base];
    if (!generated) return `no route serves ${path}`;
    if (!generated.has(segments[1])) return `${base} does not generate "${segments[1]}"`;
    return null;
  }
  return `no route serves ${path}`;
}

/** Every link the data can produce, with where it came from so a failure is findable. */
function everyLink(): { from: string; href: string }[] {
  const links: { from: string; href: string }[] = [];
  const add = (from: string, href: string) => links.push({ from, href });

  for (const b of BOTTLENECKS) add(`bottleneck ${b.name}`, bottleneckHref(b.name));
  for (const p of MARKET_PARTICIPANTS) add(`market ${p.name}`, marketHref(p.name));
  for (const s of SCIENCE) {
    add(`science ${s.id}`, scienceHref(s.id));
    for (const r of s.relieves) add(`science ${s.id} relieves`, bottleneckHref(r.bottleneck));
  }
  for (const i of INSTRUMENTS) {
    add(`policy ${i.id}`, policyHref(i.jurisdiction));
    for (const name of i.bottlenecks) add(`policy ${i.id} bears on`, bottleneckHref(name));
  }
  for (const r of RECOMMENDATIONS) {
    add(`recommendation ${r.id}`, policyHref(r.jurisdiction));
    for (const name of r.bottlenecks) add(`recommendation ${r.id}`, bottleneckHref(name));
  }
  for (const e of EVENTS) {
    for (const name of e.bottlenecks) add(`event ${e.id} bottleneck`, bottleneckHref(name));
    // The participants link added in this change — the reason this test exists.
    for (const name of e.participants) add(`event ${e.id} participant`, marketHref(name));
  }
  for (const c of CALLS) {
    for (const name of c.bottlenecks) add(`call ${c.id}`, bottleneckHref(name));
  }
  for (const p of CAPITAL_PROVIDERS) {
    add(`capital ${p.id}`, capitalHref(p.id));
    // Only linked when the jurisdiction has a page — the same `hasPolicyPage`
    // call the page makes, so the two cannot drift apart.
    if (hasPolicyPage(p.jurisdiction))
      add(`capital ${p.id} jurisdiction`, policyHref(p.jurisdiction));
    for (const name of p.canMove) add(`capital ${p.id} could move`, bottleneckHref(name));
  }
  for (const a of FUNDING_ASSESSMENTS) add(`funding ${a.bottleneck}`, bottleneckHref(a.bottleneck));
  for (const g of GLOSSARY) {
    add(`glossary ${g.term}`, glossaryHref(g.term));
    for (const other of g.seeAlso ?? []) add(`glossary ${g.term} see also`, glossaryHref(other));
  }
  return links;
}

test('every link the data can generate resolves to a page that exists', () => {
  const failures: string[] = [];
  for (const { from, href } of everyLink()) {
    const problem = resolves(href);
    if (problem) failures.push(`${from}: ${href} — ${problem}`);
  }
  assert.deepEqual(failures, [], `Broken internal links:\n  ${failures.join('\n  ')}`);
});

test('every navigation destination resolves, including the new sections', () => {
  const groups = navGroups({
    bottlenecks: 1,
    organisations: 1,
    rules: 1,
    solutions: 1,
    events: 1,
    notes: 1,
    calls: 1,
    capital: 1,
    learn: 1,
    bindingNow: 1,
  });
  const documents = new Set(sitePages().map((p) => `/${p.path}`));
  for (const href of navPaths(groups)) {
    if (documents.has(href)) continue;
    const problem = resolves(href);
    assert.equal(problem, null, `navigation: ${href} — ${problem}`);
  }
});

test('a glossary cross-reference never points at a term that does not exist', () => {
  const terms = new Set(GLOSSARY.map((g) => g.term));
  for (const entry of GLOSSARY) {
    for (const other of entry.seeAlso ?? []) {
      assert.ok(terms.has(other), `glossary "${entry.term}" refers to missing term "${other}"`);
    }
  }
  const anchors = GLOSSARY.map((g) => glossaryAnchor(g.term));
  assert.equal(new Set(anchors).size, anchors.length, 'two glossary terms share an anchor');
});

test('the link module agrees with itself about slugs', () => {
  // Passing a name or an already-slugged value must give the same answer, which
  // is the fork that used to decide correctness per call site.
  for (const b of BOTTLENECKS) {
    assert.equal(bottleneckHref(b.name), bottleneckHref(b.slug), b.name);
  }
  for (const p of MARKET_PARTICIPANTS.slice(0, 40)) {
    assert.equal(marketHref(p.name), marketHref(p.slug), p.name);
  }
});
