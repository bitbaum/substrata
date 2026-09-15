/**
 * The join page makes a promise about what it is not. These tests are what
 * keep that promise true as the copy changes, and they are written against
 * the generic model rather than against Substrata's wording so that a sibling
 * project copying `lib/contribute.ts` inherits the checks with it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { JOIN } from '../config/substrata-join';
import { COMMITMENT_LABEL, renderContribute, validateContribute } from '../lib/contribute';
import { allNotes, noteBySlug, noteCount } from '../lib/notes';
import { validateSite } from 'sitekit';
import { siteChrome, sitePages } from '../config/site-content';

test('the join model passes its own checks', () => {
  assert.deepEqual(validateContribute(JOIN), []);
});

test('the join page says it is not employment, before it asks for anything', () => {
  const sections = renderContribute(JOIN);
  const termsIndex = sections.findIndex(
    (s) => s.kind === 'definitions' && s.heading === 'Read this before you write in',
  );
  const rolesIndex = sections.findIndex(
    (s) => s.kind === 'cards' && s.heading === 'Knowledge this project is short of',
  );
  assert.ok(termsIndex > -1, 'no terms section');
  assert.ok(rolesIndex > -1, 'no roles section');
  assert.ok(termsIndex < rolesIndex, 'the terms must come before the ask');

  const terms = JOIN.terms
    .map((t) => `${t.term} ${t.detail}`)
    .join(' ')
    .toLowerCase();
  assert.match(terms, /not a job/);
  assert.match(terms, /no (vacancy|contract|salary)/);
  assert.match(terms, /pays nobody|nobody is paid/);
});

test('no rendered section dumps a raw URL into prose', () => {
  const sections = renderContribute(JOIN);
  const prose = JSON.stringify(sections.filter((s) => s.kind !== 'hero'));
  assert.ok(
    !/https?:[/][/][^"\s]{40,}/.test(prose),
    'a long URL is rendered as text; a route belongs in a link, not a sentence',
  );
  const hero = sections[0];
  assert.equal(hero.kind, 'hero');
  if (hero.kind === 'hero') {
    assert.equal(hero.actions?.length, JOIN.routes.length, 'not every route is a link');
  }
});

test('every route says where it goes and what happens after', () => {
  for (const route of JOIN.routes) {
    assert.match(route.href, /^https?:\/\//, `${route.label}: href`);
    assert.ok(
      /github/i.test(route.href),
      `${route.label}: the only intake is GitHub, so the link should say so`,
    );
    assert.ok(route.whatHappens.length > 40, `${route.label}: too vague about what follows`);
  }
});

test('every role names a real gap with a real destination', () => {
  const paths = new Set([
    '/bottlenecks',
    '/markets',
    '/policy',
    '/science',
    '/notes',
    '/about',
    '/events',
  ]);
  for (const role of JOIN.roles) {
    assert.ok(role.commitment in COMMITMENT_LABEL, `${role.title}: unknown commitment`);
    if (role.example) {
      const base = role.example.split('?')[0];
      assert.ok(
        paths.has(base),
        `${role.title}: example points at ${base}, which is not a section`,
      );
    }
  }
});

test('the join page validates against the shared site schema', () => {
  const result = validateSite({ chrome: siteChrome(), pages: sitePages() });
  if (!result.success) assert.fail(`schema violations:\n${result.errors.join('\n')}`);
  assert.ok(
    sitePages().some((page) => page.path === 'join'),
    'the join page is not in the site',
  );
});

test('every note parses, is dated, and carries the frontmatter the site renders', () => {
  const notes = allNotes();
  assert.equal(notes.length, noteCount());
  assert.ok(notes.length > 0, 'no notes: the section would render empty');
  for (const note of notes) {
    assert.match(note.publishedAt, /^\d{4}-\d{2}-\d{2}$/, `${note.slug}: publishedAt`);
    assert.ok(note.title.length > 10, `${note.slug}: title`);
    assert.ok(note.summary.length > 40, `${note.slug}: summary too thin to list`);
    assert.ok(note.blocks.length > 3, `${note.slug}: body did not parse into blocks`);
    assert.ok(note.readingMinutes >= 1, `${note.slug}: reading time`);
    assert.ok(noteBySlug(note.slug), `${note.slug}: not retrievable by slug`);
  }
  // Newest first, so the listing and the "latest" tile agree.
  for (let i = 1; i < notes.length; i++) {
    assert.ok(notes[i - 1].publishedAt >= notes[i].publishedAt, 'notes are not newest first');
  }
});
