/**
 * Who owns a company: every row checkable, no percentage invented, and the
 * page, the tile and the assistant all reading the same join.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OWNERSHIP, ownershipOf } from '../config/substrata-ownership';
import { MARKET_PARTICIPANTS } from '../lib/participants';
import { LISTINGS } from '../lib/listings';
import { ownershipView } from '../lib/ownership';
import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger, type ToolEnv } from '../lib/chat-tools/ledger';

const SLUGS = new Set(MARKET_PARTICIPANTS.map((p) => p.slug));
const env = (): ToolEnv => ({ ledger: emptyLedger() });
const json = async (name: string, args: Record<string, unknown>) =>
  JSON.parse((await runTool(name, args, env())).result);

test('every ownership row names a company in the directory, once', () => {
  const seen = new Set<string>();
  for (const row of OWNERSHIP) {
    assert.ok(SLUGS.has(row.company), `${row.company}: not in the directory`);
    assert.ok(!seen.has(row.company), `${row.company}: listed twice`);
    seen.add(row.company);
  }
  assert.ok(OWNERSHIP.length >= 25, `only ${OWNERSHIP.length} companies have ownership rows`);
});

test('every holder has a document behind it and an as-of date', () => {
  for (const row of OWNERSHIP) {
    for (const h of row.holders) {
      assert.match(h.source, /^https:\/\//, `${row.company} / ${h.name}: source is not a URL`);
      assert.match(
        h.asOf,
        /^\d{4}(-\d{2}(-\d{2})?)?$/,
        `${row.company} / ${h.name}: as-of "${h.asOf}" is not a date`,
      );
      if (h.share !== null) {
        assert.ok(h.share > 0 && h.share <= 100, `${row.company} / ${h.name}: share ${h.share}`);
        // A figure from a market-data aggregator is a lead, never a share.
        assert.doesNotMatch(
          h.source,
          /simplywall|marketscreener|investing\.com|tipranks|yahoo/,
          `${row.company} / ${h.name}: a sourced share must come from a document, not an aggregator`,
        );
      }
    }
  }
});

test('named shares of one company never sum past 100', () => {
  for (const row of OWNERSHIP) {
    const sum = row.holders.reduce((n, h) => n + (h.share ?? 0), 0);
    assert.ok(sum <= 100, `${row.company}: named shares sum to ${sum}`);
  }
});

test('a subsidiary names its parent and a private firm says who owns it', () => {
  for (const row of OWNERSHIP) {
    if (row.status === 'subsidiary') assert.ok(row.parent, `${row.company}: subsidiary of whom?`);
    if (row.status === 'private' || row.status === 'state-owned')
      assert.ok(row.ownedBy, `${row.company}: private, but owned by whom?`);
  }
});

test('the ownership status agrees with the listing record', () => {
  for (const row of OWNERSHIP) {
    const listing = LISTINGS.listings[row.company];
    if (!listing) continue;
    if (listing.status === 'parent')
      assert.equal(row.status, 'subsidiary', `${row.company}: listing says it trades via a parent`);
    if (listing.status === 'listed')
      assert.notEqual(row.status, 'private', `${row.company}: listing says it is listed`);
  }
});

test('the view derives the remainder only when every named holder is sourced', () => {
  const asml = ownershipView('asml');
  assert.equal(asml.status, 'listed');
  assert.equal(asml.leads.length, 0);
  assert.ok(asml.rest !== null && asml.rest > 50, 'ASML is mostly public float');
  const sk = ownershipView('sk-hynix');
  assert.ok(sk.leads.length > 0);
  assert.equal(sk.rest, null, 'a lead makes the remainder unknowable');
  // A company with no rows falls back to the listing record.
  const kuka = ownershipView('kuka');
  assert.equal(kuka.recorded, false);
  assert.equal(kuka.status, 'subsidiary');
  assert.equal(kuka.parent, 'Midea Group');
  assert.equal(ownershipOf('kuka'), undefined);
});

test('the private and subsidiary lines say who, in words', () => {
  assert.match(ownershipView('sibelco').line, /^Private — owned by/);
  assert.match(ownershipView('trumpf').line, /^Private — owned by the Leibinger family/);
  assert.equal(ownershipView('hitachi-energy').line, 'Subsidiary of Hitachi');
  assert.equal(ownershipView('nvidia').line, 'Listed');
});

test('Ask can answer "who owns X" for a listed, a private and an unknown company', async () => {
  const asml = await json('ownership', { company: 'ASML' });
  assert.equal(asml.status, 'Listed');
  assert.ok(asml.holders.some((h: { name: string }) => /BlackRock/.test(h.name)));
  assert.match(asml.holders[0].share, /%$/);
  assert.match(asml.holders[0].source, /^https:\/\/www\.sec\.gov\//);
  assert.ok('other_holders_and_public_float' in asml);
  assert.match(asml.page, /^\/markets\/asml#ownership$/);

  const sibelco = await json('ownership', { company: 'Sibelco' });
  assert.match(sibelco.status, /^Private — owned by/);
  assert.equal(sibelco.holders[0].share, 'no figure on record');
  assert.match(sibelco.listing, /Private|No listing/);

  const hitachi = await json('ownership', { company: 'Hitachi Energy' });
  assert.equal(hitachi.parent, 'Hitachi');
  assert.match(hitachi.listing, /NOT listed itself/);

  const unknown = await json('ownership', { company: 'Acme Widgets' });
  assert.match(unknown.error, /No company called/);
});
