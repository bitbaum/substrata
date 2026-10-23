/**
 * /chat layout contract: the page is the fleet's whole-screen chat
 * (chatkit ChatScreen, as on Loki and Solon). ChatScreen owns the heights —
 * the visual viewport under a phone keyboard, the measured header and
 * composer insets — so the page computes none, and on a phone the site's
 * own bars step aside so the conversation has the whole display.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { viewport } from '../app/chat/page';

const ROOT = new URL('..', import.meta.url).pathname;
const css = () => readFileSync(join(ROOT, 'app/styles/ask.css'), 'utf8');
const chat = () => readFileSync(join(ROOT, 'components/portal/ResearchChat.tsx'), 'utf8');

test('/chat exports viewport with interactiveWidget: resizes-content', () => {
  assert.equal(
    viewport?.interactiveWidget,
    'resizes-content',
    '/chat must tell mobile browsers to resize content when the virtual keyboard appears',
  );
});

test('/chat renders through ChatScreen filling the visual viewport', () => {
  const code = chat();
  assert.match(
    code,
    /<ChatScreen\s[\s\S]*?fill="viewport"/,
    '/chat must use ChatScreen fill="viewport"',
  );
  assert.match(
    code,
    /header=\{[\s\S]*?className="ck-glass"/,
    'the floating header needs a ck-glass way back',
  );
  assert.match(
    code,
    /share=\{\{ title: 'Ask Substrata' \}\}/,
    'Copy · Listen · Share under answers',
  );
  // The dock keeps its own column; it lives inside a fixed panel.
  assert.match(code, /className="companion is-compact"/, 'the dock keeps the compact column');
});

test('ask.css computes no chat height of its own', () => {
  const s = css();
  assert.doesNotMatch(
    s,
    /\.companion(?:\.is-compact)?\s*\{[^}]*height:\s*calc\(/,
    'ChatScreen owns the height',
  );
  assert.doesNotMatch(s, /\.companion\s+\.ck-composer-wrap/, 'no sticky composer on /chat');
  assert.doesNotMatch(s, /\.companion-page\s+\.companion/, 'the old column rule is gone');
});

test('ask.css gives the conversation the whole phone display and keeps the window still', () => {
  const s = css();
  assert.match(
    s,
    /\.shell\.is-chat \.shell-column \{[\s\S]*?overflow:\s*hidden/,
    'the shell column never scrolls on /chat; the thread is the scroller',
  );
  assert.match(
    s,
    /@media \(max-width: 767\.98px\) \{[\s\S]*?\.shell\.is-chat \.shell-topbar,\s*\.shell\.is-chat \.shell-tabbar \{\s*display:\s*none/,
    'below 768px the top bar and tab bar step aside',
  );
  assert.match(
    s,
    /@media \(min-width: 768px\) \{[\s\S]*?\.companion-page > \.ck-screen-viewport \{\s*height:\s*calc\(var\(--ck-viewport-height, 100dvh\) - var\(--spacing-topbar\)\)/,
    'from 768px the screen takes the height under the top bar',
  );
  const chatPage = readFileSync(join(ROOT, 'app/chat/page.tsx'), 'utf8');
  assert.match(chatPage, /<Shell\s+footer=\{false\}>/, '/chat must suppress footer in Shell');
});

test('ask.css pads the empty state with the measured insets, like the thread', () => {
  const s = css();
  assert.match(
    s,
    /\.companion \.ck-screen-body > \.ask-empty \{[\s\S]*?--ck-top-inset[\s\S]*?--ck-bottom-inset[\s\S]*?overflow-y:\s*auto/,
    'the empty state scrolls under the floating header and composer',
  );
});

test('the panel is chatkit’s screen filling the sheet: its thread is the scroller', () => {
  const s = css();
  assert.match(
    s,
    /\.ask-sheet-body > \.ck-screen \{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0/,
    'the screen takes the sheet’s height, so chatkit’s thread scrolls inside it',
  );
  assert.doesNotMatch(s, /\.companion\.is-compact \.ck-thread/, 'no hand-made scroller');
});
