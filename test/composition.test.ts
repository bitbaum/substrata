import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const packageJson = JSON.parse(source('package.json')) as {
  dependencies: Record<string, string>;
};

test('Substrata uses one immutable shared composition source, not the fleet brand palette', () => {
  assert.equal(
    packageJson.dependencies['@bitbaum/design-tokens'],
    'github:bitbaum/design-tokens#8e786a43220d267ccf6b5cd6119a012f1a52dfff',
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
