import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const require = createRequire(import.meta.url);

test('Substrata uses the installed shared composition contract without importing a brand palette', () => {
  // Exercise the installed artifact: both a frozen Git release and an npm
  // release must expose the same geometry and accessible controls.
  const composition = readFileSync(
    require.resolve('@bitbaum/design-tokens/composition.css'),
    'utf8',
  );
  for (const role of ['.bb-frame', '.bb-control', '.bb-button', ':focus-visible']) {
    assert.ok(composition.includes(role), 'shared composition is missing ' + role);
  }
  const rules = composition.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(
    !/(^|})\s*(?:html|body|:root)\s*[{,]/m.test(rules),
    'shared composition must not take over the app palette',
  );
  const layout = source('app/layout.tsx');
  assert.ok(layout.includes('@bitbaum/design-tokens/composition.css'));
  assert.ok(!layout.includes('@bitbaum/design-tokens/tokens.css'));
  assert.ok(
    layout.indexOf("'./globals.css'") < layout.indexOf("'@bitbaum/design-tokens/composition.css'"),
    'composition must load after the Tailwind reset',
  );
});

test('Substrata preserves monochrome roles while importing shared geometry', () => {
  const css = source('app/globals.css');
  const required = [
    '--bb-action-bg: var(--color-fg-primary);',
    '--bb-action-fg: var(--color-surface-page);',
    '--bb-control-bg: var(--color-surface-raised);',
    '--bb-line: var(--color-border-strong);',
    '--bb-focus: var(--color-accent);',
  ];
  for (const role of required) assert.ok(css.includes(role), 'missing ' + role);
  assert.ok(css.includes('--primitive-black: #000000'));
  assert.ok(css.includes('--font-heading:'));
});

test('Home rows and doors keep one anatomy each, in the stylesheet that owns them', () => {
  const doors = source('app/_home/Doors.tsx');
  const homeCss = source('app/styles/home.css');
  const rolesCss = source('app/styles/roles.css');
  assert.ok(doors.includes('home-door-who') && doors.includes('home-door-hint'));
  assert.ok(doors.includes('home-door-go'));
  // The chooser's old classes left roles.css with the component that used them.
  assert.ok(!rolesCss.includes('.door-row'));
  assert.ok(!homeCss.includes('.home-hero-status'));
});
