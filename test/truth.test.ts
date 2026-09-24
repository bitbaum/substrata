/**
 * The truth gate.
 *
 * On 2026-09-15 an audit found the site claiming things that were not true of
 * a project made by one person and a set of agents: that it declined business
 * every week, that notes went out on a schedule, that analysts and a desk and
 * a compliance function existed, that two phases of work ran at once. Each of
 * those was written in good faith as the voice of a research house, and each
 * was false.
 *
 * Fixing them once is not enough, because that voice is easy to write by
 * accident. This test walks every string the site can render and fails the
 * build if any of those phrases come back. It is deliberately blunt: a phrase
 * on this list is banned outright, and a legitimate future use (a quotation,
 * say) has to be added as an exception here, in public, with a reason.
 *
 * Add to this list whenever a false claim is found. Never remove a line
 * without one.
 */

import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

import {
  METHOD,
  WHAT_EXISTS_NOT,
  WHAT_IT_IS,
  WHO_MAKES_IT,
  JUDGED_BY,
} from '../config/substrata-about';
import { GLOSSARY } from '../config/substrata-glossary';
import { JOIN } from '../config/substrata-join';
import { CALLS } from '../config/substrata-calls';
import { CAPITAL_KINDS, CAPITAL_PROVIDERS, FUNDING_ASSESSMENTS } from '../config/substrata-capital';
import { INVESTMENT_THESIS } from '../config/substrata-acting';
import { ASSESSMENTS } from '../config/substrata-assessment';
import { COVERAGE, CHOKEPOINTS } from '../config/substrata-coverage';
import { EVENTS } from '../config/substrata-events';
import { INSTRUMENTS, RECOMMENDATIONS } from '../config/substrata-policy';
import { RESEARCH_PROGRAMMES } from '../config/substrata-programmes';
import { SCIENCE } from '../config/substrata-science';
import { STAGES } from '../config/substrata-stages';
import { CLASSIFICATION } from '../config/substrata-taxonomy';
import { siteChrome, sitePages } from '../config/site-content';
import * as labels from '../lib/labels';

/**
 * Phrases that describe a firm this project is not. The comment on each says
 * what it claimed and why it was false.
 */
const BANNED: { pattern: RegExp; why: string }[] = [
  { pattern: /\bwe decline\b/i, why: 'claimed a stream of business to turn away' },
  { pattern: /every week\b/i, why: 'claimed a weekly operating rhythm' },
  {
    pattern: /notes go out on a schedule/i,
    why: 'claimed a publication calendar that does not exist',
  },
  { pattern: /\bour analysts?\b/i, why: 'claimed staff' },
  { pattern: /\bthe analyst\b/i, why: 'claimed a named role held by somebody' },
  { pattern: /\bour (staff|team|desk|traders?)\b/i, why: 'claimed staff' },
  { pattern: /\bthe desk\b/i, why: 'claimed a trading desk' },
  { pattern: /\bphase [12]\b/i, why: 'claimed parallel funded workstreams' },
  { pattern: /compliance function/i, why: 'claimed a compliance function' },
  { pattern: /\bpersonal-dealing rules for staff\b/i, why: 'presupposed staff' },
  { pattern: /at time of publication/i, why: 'claimed a disclosure practice with no instances' },
  { pattern: /\bhas been commissioned\b/i, why: 'claimed paid client work' },
  { pattern: /\bthis firm\b/i, why: 'claimed a legal entity' },
  { pattern: /\bthe firm's\b/i, why: 'claimed a legal entity' },
  { pattern: /\ban analyst\b/i, why: 'claimed staff: name who judged with JUDGED_BY' },
  {
    // George, 2026-09-15: solo framing reads as isolation and advertises the
    // opposite of the goal, which is more people building here. True without it.
    pattern: /\b(one|single)[ -]person\b|\bone person[’']s\b|\bsolo (builder|founder|project)\b/i,
    why: 'solo framing: say what is open to others instead',
  },
  {
    pattern: /\banalyst (score|judgements?|estimates?)\b/i,
    why: 'claimed staff: say "judged", and name who with JUDGED_BY',
  },
  {
    pattern: /\b\d+ (maker|producer) rows\b/i,
    why: 'a count written into copy goes stale (Join said 92 rows when the data had 90); compute it',
  },
  {
    pattern: /\bfive companies make\b/i,
    why: 'claimed an exhaustive supplier list the wafer row itself says it does not establish',
  },
];

/**
 * Every string that can reach a reader, flattened. Walking objects rather
 * than listing fields means a new field is covered the day it is added.
 */
function stringsIn(value: unknown, path: string, out: { path: string; text: string }[] = []) {
  if (typeof value === 'string') {
    out.push({ path, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => stringsIn(item, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) stringsIn(inner, `${path}.${key}`, out);
  }
  return out;
}

const NOTES_DIR = join(process.cwd(), 'content', 'notes');

const RENDERED = [
  ...stringsIn(sitePages(), 'sitePages()'),
  ...stringsIn(siteChrome(), 'siteChrome()'),
  ...stringsIn([WHAT_IT_IS, WHO_MAKES_IT, METHOD, WHAT_EXISTS_NOT, GLOSSARY], 'about'),
  ...stringsIn(INVESTMENT_THESIS, 'thesis'),
  ...stringsIn(ASSESSMENTS, 'assessments'),
  ...stringsIn(CLASSIFICATION, 'taxonomy'),
  ...stringsIn(COVERAGE, 'coverage'),
  ...stringsIn(CHOKEPOINTS, 'chokepoints'),
  ...stringsIn(EVENTS, 'events'),
  ...stringsIn(INSTRUMENTS, 'policy'),
  ...stringsIn(RECOMMENDATIONS, 'recommendations'),
  ...stringsIn(SCIENCE, 'science'),
  ...stringsIn(STAGES, 'stages'),
  ...stringsIn(RESEARCH_PROGRAMMES, 'programmes'),
  ...stringsIn(labels, 'labels'),
  ...stringsIn(JOIN, 'join'),
  ...stringsIn(CALLS, 'calls'),
  ...stringsIn(CAPITAL_KINDS, 'capitalKinds'),
  ...stringsIn(CAPITAL_PROVIDERS, 'capitalProviders'),
  ...stringsIn(FUNDING_ASSESSMENTS, 'funding'),
  // Rendered beside every judged score and estimate, but a bare constant, so
  // none of the collections above carries it.
  { path: 'JUDGED_BY', text: JUDGED_BY },
];

/**
 * Strings quoted from somebody else are exempt: an event's quote and a
 * policy source's quote are what the source said, and editing those to suit
 * this test would be the dishonest move.
 */
const QUOTED = new Set(
  [...EVENTS.map((e) => e.quote), ...INSTRUMENTS.map((i) => i.quote)].map((q) => q.trim()),
);

test('no rendered string claims a firm that does not exist', () => {
  const failures: string[] = [];
  for (const { path, text } of RENDERED) {
    if (QUOTED.has(text.trim())) continue;
    for (const { pattern, why } of BANNED) {
      if (pattern.test(text)) {
        failures.push(`${path}: /${pattern.source}/ (${why})\n    ${text.slice(0, 160)}`);
      }
    }
  }
  assert.deepEqual(failures, [], `Untrue claims found:\n  ${failures.join('\n  ')}`);
});

test('the about page states the things that are true and easy to forget', () => {
  const about = stringsIn([WHAT_IT_IS, WHO_MAKES_IT, WHAT_EXISTS_NOT], 'about')
    .map((s) => s.text)
    .join(' ')
    .toLowerCase();
  for (const required of [
    'no staff',
    'agents',
    'no legal entity',
    'holds no position',
    'no schedule',
    'not advice',
  ]) {
    assert.ok(about.includes(required), `About page never says "${required}"`);
  }
});

test('anything presented as verified carries a link, and anything else says it does not', () => {
  for (const instrument of INSTRUMENTS) {
    assert.match(instrument.source, /^https?:\/\//, `${instrument.id}: source is not a URL`);
    assert.ok(instrument.quote.length > 20, `${instrument.id}: quote too short to check`);
    for (const proponent of instrument.proponents) {
      assert.match(
        proponent.source,
        /^https?:\/\//,
        `${instrument.id}: proponent ${proponent.name} has no document`,
      );
    }
  }
  // Science readiness is a judgement; every row must either cite or admit it.
  for (const entry of SCIENCE) {
    if (entry.source !== null) assert.match(entry.source, /^https?:\/\//, entry.id);
    assert.ok(
      entry.readinessWhy.length > 30,
      `${entry.id}: no reasoning behind the readiness score`,
    );
  }
});

/**
 * Prose goes stale when the data catches up with it.
 *
 * The About page and one of the notes both said this project had never made a
 * call. Publishing the first seven made both sentences false — not through
 * carelessness in the copy, but because the copy was true when written. That is
 * a recurring class of error and it deserves a gate rather than vigilance.
 *
 * Add a pair here whenever a claim about "none yet" is written down.
 */
test('no page claims an absence the data has already filled', () => {
  const absences: { when: boolean; patterns: RegExp[]; what: string }[] = [
    {
      when: SCIENCE.some((entry) => entry.source !== null),
      what: `${SCIENCE.filter((e) => e.source !== null).length} science entries now cite a source`,
      patterns: [
        /none of them yet carries a citation/i,
        /not yet cited/i,
        /no readiness score is cited/i,
      ],
    },
    {
      when: CALLS.length > 0,
      what: `${CALLS.length} calls exist`,
      patterns: [/no dated,? falsifiable call/i, /has not made any yet/i, /no track record yet/i],
    },
  ];

  const notes = readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ path: `content/notes/${f}`, text: readFileSync(join(NOTES_DIR, f), 'utf8') }));
  const everything = [...RENDERED, ...notes.map((n) => ({ path: n.path, text: n.text }))];

  const failures: string[] = [];
  for (const absence of absences) {
    if (!absence.when) continue;
    for (const { path, text } of everything) {
      for (const pattern of absence.patterns) {
        if (pattern.test(text)) {
          failures.push(
            `${path}: still claims none exist, but ${absence.what} — /${pattern.source}/`,
          );
        }
      }
    }
  }
  assert.deepEqual(failures, [], `Stale claims of absence:\n  ${failures.join('\n  ')}`);
});

/**
 * The loop stages each carry a `coverage` line, and three of them honestly say
 * "not covered yet". That phrase is true of some stages and false of others, so
 * it cannot be banned by pattern — it has to be checked against the data for the
 * stage that claims it. Capital said it for a week after /capital shipped.
 */
test('a stage does not say it is uncovered while its section exists', () => {
  const covered: { stage: string; when: boolean; what: string }[] = [
    {
      stage: 'capital',
      when: CAPITAL_PROVIDERS.length > 0 || FUNDING_ASSESSMENTS.length > 0,
      what: `${CAPITAL_PROVIDERS.length} providers and ${FUNDING_ASSESSMENTS.length} funding assessments`,
    },
  ];

  for (const row of covered) {
    if (!row.when) continue;
    const stage = STAGES.find((s) => s.id === row.stage);
    assert.ok(stage, `no stage "${row.stage}"`);
    assert.doesNotMatch(
      stage.coverage,
      /not covered yet/i,
      `stage "${row.stage}" still says it is uncovered, but the site has ${row.what}`,
    );
  }
});
