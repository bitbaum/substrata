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

test('ask.css anchors composer to bottom and makes empty state scrollable', () => {
  const css = readFileSync(join(ROOT, 'app/styles/ask.css'), 'utf8');

  // .companion .ask-empty must have flex: 1 and overflow-y: auto so empty starters do not push composer off-screen
  assert.match(
    css,
    /\.companion\s+\.ask-empty[\s\S]*?overflow-y:\s*auto/,
    '.companion .ask-empty must be scrollable',
  );
  assert.match(
    css,
    /\.companion\s+\.ask-empty\s*\{[\s\S]*?padding-bottom:\s*1\.5rem/,
    '.companion .ask-empty must provide bottom padding',
  );

  // Composer must be sticky anchored to bottom of companion
  assert.match(
    css,
    /\.companion\s+\.ck-composer-wrap\s*\{[\s\S]*?position:\s*sticky/,
    '.companion .ck-composer-wrap must be sticky',
  );
  assert.match(
    css,
    /\.companion\s+\.ck-composer-wrap\s*\{[\s\S]*?bottom:\s*0/,
    '.companion .ck-composer-wrap must stick to bottom',
  );
});

test('/chat locks shell height to prevent window scrolling and suppresses site footer', () => {
  const css = readFileSync(join(ROOT, 'app/styles/ask.css'), 'utf8');
  const chatPage = readFileSync(join(ROOT, 'app/chat/page.tsx'), 'utf8');

  // Shell on /chat must lock overflow to hidden and clamp height to viewport
  assert.match(
    css,
    /\.shell\.is-chat[\s\S]*?overflow:\s*hidden/,
    '.shell.is-chat must lock overflow to prevent window scrolling',
  );
  assert.match(
    css,
    /\.shell\.is-chat[\s\S]*?height:\s*min\(var\(--ck-viewport-height,\s*100dvh\),\s*100dvh\)/,
    '.shell.is-chat must clamp height to visual viewport',
  );

  // /chat passes footer={false} to Shell
  assert.match(chatPage, /<Shell\s+footer=\{false\}>/, '/chat must suppress footer in Shell');
});
