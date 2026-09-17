/**
 * Localisation invariants, written before the translations exist.
 *
 * The expensive part of shipping eight languages is not translating; it is
 * discovering that the code assumed one. These tests hold the seams open:
 * strings live in a catalogue, a fallback is measurable rather than silent,
 * and a quotation can never acquire a translation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DIR,
  LOCALE_NAME,
  formatDate,
  isLocale,
} from '../lib/i18n/locales';
import { EN, coverageOf, gapsIn, isTranslated, t, type MessageKey } from '../lib/i18n/messages';
import { english, isReviewed, readProse, type Prose } from '../lib/i18n/text';

test('every locale has a name in its own language and a direction', () => {
  for (const locale of LOCALES) {
    assert.ok(LOCALE_NAME[locale]?.trim(), `${locale} has no endonym`);
    assert.ok(['ltr', 'rtl'].includes(LOCALE_DIR[locale]), `${locale} has no direction`);
  }
  // Arabic is the reason `dir` exists at all; if this flips to ltr the layout
  // silently stops being right for it.
  assert.equal(LOCALE_DIR.ar, 'rtl');
  assert.equal(LOCALE_DIR.en, 'ltr');
  assert.ok(isLocale('ja') && !isLocale('xx'));
});

test('English is complete, and every other locale reports its gaps honestly', () => {
  assert.equal(coverageOf(DEFAULT_LOCALE), 1, 'the source locale must be complete');
  assert.deepEqual(gapsIn(DEFAULT_LOCALE), []);
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    // Untranslated is fine. Untranslated and unmeasurable is not.
    const gaps = gapsIn(locale);
    assert.equal(
      gaps.length + Math.round(coverageOf(locale) * Object.keys(EN).length),
      Object.keys(EN).length,
      `${locale}: coverage and gaps disagree`,
    );
  }
});

test('a missing translation falls back to English and says that it did', () => {
  const key = 'profile.discussion.title' as MessageKey;
  assert.equal(t(key, 'de'), EN[key], 'fallback should still render something');
  assert.equal(isTranslated(key, 'de'), false, 'and must not claim to be German');
  assert.equal(isTranslated(key, 'en'), true);
});

test('module titles come from the catalogue, not from the component', () => {
  // A title written into a module is a string no translator can reach.
  const dir = new URL('../lib/profile/modules/', import.meta.url);
  const offenders: string[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const match of source.matchAll(/^\s{2}title: (?!t\()(.+)$/gm)) {
      offenders.push(`${file}: ${match[1].trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `Untranslatable module titles:\n  ${offenders.join('\n  ')}`);
});

test('research prose can be translated, and reports whether it was', () => {
  const prose: Prose = {
    lang: 'en',
    text: 'The specially grown steel inside a large power transformer.',
    translations: {
      de: {
        text: 'Der besonders gezüchtete Stahl in einem großen Leistungstransformator.',
        provenance: { kind: 'human', by: 'a translator', on: '2026-09-17' },
      },
    },
  };
  const german = readProse(prose, 'de');
  assert.equal(german.translated, true);
  assert.equal(german.lang, 'de');

  const french = readProse(prose, 'fr');
  assert.equal(french.translated, false, 'no French translation exists');
  assert.equal(french.lang, 'en', 'and the reader is told which language they got');
  assert.equal(french.text, prose.text);
});

test('a machine translation is never counted as checked', () => {
  // It may exist as a draft; it may not be presented as the research's own words.
  assert.equal(
    isReviewed({
      text: '…',
      provenance: { kind: 'machine', engine: 'some-engine', on: '2026-09-17', reviewed: false },
    }),
    false,
  );
  assert.equal(
    isReviewed({ text: '…', provenance: { kind: 'human', by: 'someone', on: '2026-09-17' } }),
    true,
  );
});

test('dates are formatted for the reader, not left as ISO strings', () => {
  assert.notEqual(formatDate('2026-09-15', 'de'), '2026-09-15');
  assert.equal(formatDate('not-a-date', 'en'), 'not-a-date', 'bad input degrades to itself');
});

test('english() marks existing corpus prose as English rather than untagged', () => {
  const prose = english('Anything outside its mandate.');
  assert.equal(prose.lang, 'en');
  assert.equal(readProse(prose, 'en').translated, true);
});
