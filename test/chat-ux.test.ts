/**
 * Contract tests for the Ask surfaces:
 * 1. /chat's empty state has a clear call-to-action after the headline.
 * 2. The page's composer is labelled and focusable from that CTA.
 * 3. The panel over a page is chatkit's ChatScreen in a sheet (phone) or a
 *    right-hand panel (desktop) with one title row — Ask Substrata · Expand ·
 *    Close — and its composer is AskComposer: "+" for a screenshot,
 *    microphone, send, and no model label unless the reader's own key is set
 *    (owner, 2026-10-23: "The chat didn't scroll, no way to expand … this is
 *    terrible"; 2026-10-27: "there was no way for me to attach the screenshots").
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('/chat empty state includes a clear call-to-action after the headline', () => {
  const code = read('components/portal/ResearchChat.tsx');
  assert.match(
    code,
    /ask-cta[\s\S]*?Ask a question now/,
    'ResearchChat empty state must render a call-to-action button after the headline',
  );
  assert.match(code, /onClick=\{focusInput\}/, 'CTA button must trigger focusInput');
});

test('one composer everywhere: AskComposer on the home page, the panel and /chat', () => {
  const code = read('components/portal/ResearchChat.tsx');
  assert.equal(code.match(/<AskComposer\b/g)?.length, 1, 'built once, placed in both frames');
  assert.match(code, /inputRef=\{inputRef\}/, 'AskComposer must receive inputRef');
  assert.doesNotMatch(code, /<Composer\b/, 'no second composer configuration');
  assert.match(read('app/_home/AskBox.tsx'), /<AskComposer\b/, 'the home box is the same box');
  const box = read('components/portal/chat/AskComposer.tsx');
  assert.equal(box.match(/<Composer\b/g)?.length, 1);
  assert.doesNotMatch(box, /header=/, 'no kicker over the box');
  assert.doesNotMatch(box, /attach=\{false\}/, 'screenshots attach (owner, 2026-10-27)');
  assert.match(box, /maxFiles: MAX_IMAGES/);
  assert.match(box, /maxImageEdge: MAX_IMAGE_EDGE/, 'a screenshot shrinks in the browser first');
  assert.match(box, /maxImageBytes: MAX_IMAGE_BYTES/);
  assert.match(box, /attachmentOnlyText=\{ATTACHMENT_ONLY_TEXT\}/, 'a picture alone can be sent');
  assert.match(box, /queue=\{Boolean\(onStop\)\}/, 'a message can be queued while a turn runs');
  assert.doesNotMatch(read('app/styles/ask.css'), /\.ask-composer-label/);
});

test('the panel is chatkit’s ChatScreen in a sheet with one title row', () => {
  const chat = read('components/portal/ResearchChat.tsx');
  assert.match(
    chat,
    /<AskPanel[\s\S]*?<ChatScreen[\s\S]*?fill="parent"/,
    'compact = ChatScreen in AskPanel',
  );
  const panel = read('components/portal/AskPanel.tsx');
  assert.match(
    panel,
    /useViewportHeight\(sheetRef, open\)/,
    'the sheet follows the visual viewport',
  );
  assert.match(panel, /ask-sheet-grip/, 'a grip to pull the sheet down');
  assert.match(panel, />\s*Expand\s*</, 'Expand opens /chat');
  assert.match(panel, />\s*Close\s*</);
  const css = read('app/styles/ask.css');
  assert.match(css, /\* 0\.92\)/, 'a phone sheet opens to 92% of the viewport');
  assert.match(
    css,
    /@media \(min-width: 768px\)[\s\S]*?\.ask-sheet \{[\s\S]*?right: 0;/,
    'a right-hand panel from 768px',
  );
  assert.doesNotMatch(css, /ask-dock-panel/, 'the old scrolling box is gone');
});

test('the model chip only with a key; the way to a key is the footnote line', () => {
  const chat = read('components/portal/ResearchChat.tsx');
  const tools = read('components/portal/chat/AskTools.tsx');
  assert.match(tools, /if \(!keys\.active\) return null;/, 'nothing in the slot without a key');
  assert.doesNotMatch(tools, /[>`'"]Model: /, 'no "Model: Auto" label anywhere');
  assert.match(chat, /Use your own AI key/, 'the way to a key is the footnote line');
});

test('Expand hands the whole thread to /chat under its id', () => {
  const chat = read('components/portal/ResearchChat.tsx');
  assert.match(
    chat,
    /saveThread\(\{ id, conversationId: chat\.conversationIdNow\(\), topic, onPath, turns: chat\.turns \}\)/,
  );
  assert.match(chat, /router\.push\(chatHref\(id\)\)/);
  assert.match(chat, /loadThread\(threadId\)/, '/chat picks the thread up');
  assert.match(read('app/chat/page.tsx'), /threadId=\{threadId\}/);
});

test('"N records read" is the thought row above the answer, not a line under it', () => {
  assert.match(read('components/portal/ResearchChat.tsx'), /thinking: thinkingFor\(t\)/);
  assert.doesNotMatch(read('components/portal/chat/AnswerFooter.tsx'), /records? read/);
});
