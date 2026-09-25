/**
 * Numbers a reader can check.
 *
 * `<Figure method="…">` sends a reader to /data#method-…, which renders the
 * entry from `lib/methods.ts` and links its code. A method whose code path has
 * been moved or deleted would send them to a 404 on GitHub — an explanation
 * that explains nothing — so every path is checked against the tree.
 */
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

import { METHODS, methodAnchor, methodHref, type MethodId } from '../lib/methods';
import { bareNumbersIn, countByFile, scanBareNumbers } from './bare-numbers';

const ROOT = process.cwd();

test('every method states a rule, an explanation, and code that exists', () => {
  for (const [id, method] of Object.entries(METHODS)) {
    assert.ok(method.title.length > 3, `${id}: no title`);
    assert.ok(method.formula.length > 20, `${id}: formula too short to explain anything`);
    assert.ok(method.explanation.length > 40, `${id}: explanation too short`);
    assert.ok(method.code.length > 0, `${id}: no code to check it against`);
    for (const path of method.code) {
      assert.ok(existsSync(join(ROOT, path)), `${id}: code path ${path} does not exist`);
    }
  }
});

test('a method link lands on the anchor the method page renders', () => {
  for (const id of Object.keys(METHODS) as MethodId[]) {
    assert.equal(methodHref(id), `/data#${methodAnchor(id)}`);
    assert.match(methodAnchor(id), /^[a-z0-9-]+$/, `${id}: anchor is not URL-safe`);
  }
});

/**
 * The ratchet on numbers typed into page copy.
 *
 * Every entry below is a known bare number, counted per file on 2026-09-24
 * after the sweep that introduced <Figure>. Most are the definitions of a
 * scale ("Levels 1 to 4"), which are fine to state. The count may fall, never
 * rise: a new number in copy is either computed from the corpus (write it as
 * an expression), sourced (`<Figure source=…>`), or a labelled estimate
 * (`<Figure estimate=…>`). If one genuinely is none of those — a definition,
 * a quoted label — raise its file's count here, in the same PR, so a reviewer
 * sees the decision. `pnpm tsx test/bare-numbers.ts` lists every hit.
 */
const BARE_NUMBER_BASELINE: Record<string, number> = {
  'app/account/page.tsx': 2,
  'app/data/page.tsx': 1,
  'app/science/page.tsx': 4,
  'components/portal/chat/ByokPanel.tsx': 1,
  // Two scale definitions ("the 1–9 scale", "each 0–3"), from the company-profile work.
  'lib/profile/modules/company-context.tsx': 1,
  'lib/profile/modules/company.tsx': 1,
  'lib/profile/modules/loop.tsx': 1,
  'lib/profile/modules/quantities.tsx': 1,
  'lib/profile/modules/role.tsx': 1,
};

test('no page gains a number a reader cannot trace', () => {
  const hits = scanBareNumbers();
  const counts = countByFile(hits);
  const failures = Object.entries(counts)
    .filter(([file, n]) => n > (BARE_NUMBER_BASELINE[file] ?? 0))
    .map(
      ([file, n]) =>
        `${file}: ${n} bare numbers, baseline ${BARE_NUMBER_BASELINE[file] ?? 0}\n` +
        hits
          .filter((h) => h.file === file)
          .map((h) => `      ${h.line}: ${h.text}`)
          .join('\n'),
    );
  assert.deepEqual(
    failures,
    [],
    `Numbers typed into copy — compute them, wrap them in <Figure>, or raise the baseline with a reason:\n  ${failures.join('\n  ')}`,
  );
});

test('the scanner sees a typed number and excuses an explained one', () => {
  const found = bareNumbersIn(
    'probe.tsx',
    `export const A = () => (
      <div>
        <p>Over 90% of wafers come from Japan.</p>
        <p><Figure method="share">90%</Figure> of wafers</p>
        <p className="mt-2 px-4">{count} rows</p>
      </div>
    );`,
  );
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0].text, /Over 90%/);
});

/**
 * A figure's explanation is its description, not its text. The atlas once
 * listed eighteen computed counts and each carried the method's sentence
 * inline — eighteen copies in every copy-paste and screen-reader pass.
 */
test('a figure describes itself by reference, and the page defines each method once', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Figure, FigureDefinitions, methodDefinitionId } =
    await import('../components/portal/Figure');
  const formula = METHODS['stage-counts'].formula;
  const html = renderToStaticMarkup(
    createElement(
      'p',
      null,
      createElement(Figure, { method: 'stage-counts', children: '3' }),
      createElement(Figure, { method: 'stage-counts', children: '4' }),
    ),
  );
  // Nothing outside the closed popover repeats the rule as text.
  // (The tooltip attribute is not text; the popover is closed until asked.)
  const outsidePopover = html
    .replace(
      /<span[^>]*popover="auto"[\s\S]*?Check this number with Ask<\/button><\/span><\/span>/g,
      '',
    )
    .replace(/ title="[^"]*"/g, '');
  assert.ok(!outsidePopover.includes(formula), `explanation emitted inline:\n${outsidePopover}`);
  const refs = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(refs, [methodDefinitionId('stage-counts'), methodDefinitionId('stage-counts')]);

  const defs = renderToStaticMarkup(createElement(FigureDefinitions));
  assert.match(defs, /^<div hidden="">/);
  const ids = [...defs.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'a definition id appears twice');
  assert.ok(ids.includes(methodDefinitionId('stage-counts')));
  assert.equal(defs.split(formula).length - 1, 1, 'the rule is defined exactly once');

  // A sourced figure has no shared rule, so its own description is hidden, not inline.
  const sourced = renderToStaticMarkup(
    createElement(Figure, { source: 'https://example.org/x', children: '9' }),
  );
  assert.match(sourced, /<span id="[^"]+-sr" hidden="">Source: example.org<\/span>/);
});
