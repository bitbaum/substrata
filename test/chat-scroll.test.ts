/**
 * /chat layout contract: the response thread scrolls within the visible screen,
 * and on mobile devices with virtual keyboards, content remains above the
 * keyboard and tab bar.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { viewport } from '../app/chat/page';

const ROOT = new URL('..', import.meta.url).pathname;

test('/chat exports viewport with interactiveWidget: resizes-content', () => {
  assert.equal(
    viewport?.interactiveWidget,
    'resizes-content',
    '/chat must tell mobile browsers to resize content when the virtual keyboard appears',
  );
});

test('ask.css makes the response container scrollable with touch momentum and bottom padding', () => {
  const css = readFileSync(join(ROOT, 'app/styles/ask.css'), 'utf8');

  // Both thread wrap and inner thread must have min-height: 0 and overflow-y: auto
  assert.match(
    css,
    /\.companion\s+\.ck-thread-wrap[\s\S]*?overflow-y:\s*auto/,
    '.companion .ck-thread-wrap must be scrollable',
  );
  assert.match(
    css,
    /\.companion\s+\.ck-thread[\s\S]*?overflow-y:\s*auto/,
    '.companion .ck-thread must be scrollable',
  );
  assert.match(
    css,
    /\.companion\s+\.ck-thread[\s\S]*?-webkit-overflow-scrolling:\s*touch/,
    '.companion .ck-thread must enable smooth touch scrolling on iOS',
  );
  assert.match(
    css,
    /\.companion\s+\.ck-thread\s*\{[\s\S]*?padding-bottom:\s*1\.5rem/,
    '.companion .ck-thread must provide sufficient bottom padding so content clears the composer',
  );
});

test('ask.css adjusts viewport height and bottom padding on /chat against keyboard overlap', () => {
  const css = readFileSync(join(ROOT, 'app/styles/ask.css'), 'utf8');

  // .companion-page .companion height must subtract --shell-offset-bottom
  assert.match(
    css,
    /\.companion-page\s+\.companion\s*\{[\s\S]*?var\(--shell-offset-bottom\)/,
    '.companion-page .companion must subtract --shell-offset-bottom from viewport height',
  );

  // .companion-page .companion must provide bottom padding
  assert.match(
    css,
    /\.companion-page\s+\.companion\s*\{[\s\S]*?padding:\s*1rem\s+0\s+1\.5rem/,
    '.companion-page .companion must have sufficient bottom padding',
  );
});
