/**
 * Contract tests for the Ask surfaces. The chat app is chatkit's `ChatApp`
 * (0.18): the header (Chats · title · New chat · …), the chat list, temporary
 * chat, titles, the queue, Stop and the reopen on reload are the fleet's, the
 * same as Heidi's and Loki's. Substrata gives it a transport, its evidence in
 * the slots, and the composer configuration the home box shares: "+" for a
 * screenshot, microphone, send (owner, 2026-10-27: "how I can open the chat
 * that will look exactly like all the other chats").
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('Ask is chatkit’s ChatApp, not an assembly of its pieces', () => {
  const code = read('components/portal/ResearchChat.tsx');
  assert.equal(code.match(/<ChatApp\b/g)?.length, 1, 'one ChatApp, in both frames');
  for (const piece of ['ChatScreen', 'ChatThread', 'Composer', 'ChatStarters'])
    assert.ok(!new RegExp(`<${piece}\\b`).test(code), `no hand-built <${piece}>`);
  assert.match(code, /localConversationStore\(\{ key: 'substrata-ask' \}\)/, 'chats on the device');
  assert.match(code, /rememberKey=\{OPEN_CHAT_KEY\}/, 'a reload and Expand reopen the open chat');
  assert.match(code, /renderers: chartRenderers/, 'charts are chartkit’s');
  assert.match(code, /<AnswerFooter turn=\{turn\} \/>/, 'the evidence under each answer');
  assert.match(code, /share: \{ title: 'Ask Substrata' \}/, 'Copy · Listen · Share');
});

test('one composer configuration: the home box, the panel and /chat', () => {
  const box = read('components/portal/chat/askComposer.ts');
  assert.doesNotMatch(box, /attach: false/, 'screenshots attach (owner, 2026-10-27)');
  assert.match(box, /maxFiles: MAX_IMAGES/);
  assert.match(box, /maxImageEdge: MAX_IMAGE_EDGE/, 'a screenshot shrinks in the browser first');
  assert.match(box, /maxImageBytes: MAX_IMAGE_BYTES/);
  assert.match(box, /attachmentOnlyText: ATTACHMENT_ONLY_TEXT/, 'a picture alone can be sent');
  assert.match(read('components/portal/ResearchChat.tsx'), /\.\.\.askComposerProps\(\)/);
  assert.match(read('app/_home/AskBox.tsx'), /\.\.\.\(askComposerProps\(\)/);
  assert.doesNotMatch(read('app/styles/ask.css'), /\.ask-composer-label/);
});

test('the panel is chatkit’s ChatApp in a sheet with one title row', () => {
  const chat = read('components/portal/ResearchChat.tsx');
  assert.match(
    chat,
    /fill=\{compact \? 'parent' : 'viewport'\}[\s\S]*?<AskPanel/,
    'compact = ChatApp filling AskPanel',
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
  assert.match(chat, /Use your own AI key/);
});

test('Expand opens /chat on the same chat; messages from elsewhere start a new one', () => {
  const chat = read('components/portal/ResearchChat.tsx');
  assert.match(chat, /router\.push\('\/chat'\)/, 'Expand is only a bigger frame');
  assert.match(chat, /initialMessage=\{arrival\}/, 'the home box’s message, attachments and all');
  assert.match(chat, /send\(text, \[\], \{ newChat: true \}\)/, '"Check this" is a new chat');
  assert.doesNotMatch(
    chat,
    /\.ck-send|\.ck-composer/,
    'nothing types into the composer from outside',
  );
  assert.match(
    chat,
    /railQuery=\{compact \? 'not all' : undefined\}/,
    'the panel’s chat list is a drawer',
  );
});

test('"N records read" is the thought row above the answer, not a line under it', () => {
  assert.match(read('components/portal/chat/askTransport.ts'), /thinking: thinkingFor\(evidence\)/);
  assert.doesNotMatch(read('components/portal/chat/AnswerFooter.tsx'), /records? read/);
});
