/**
 * Contract tests for /chat page improvements:
 * 1. Clear call-to-action after the headline ("Ask a question now").
 * 2. Input field (text box) labeled and clearly styled before the voice input button.
 * 3. Model selector collapsed behind a toggle with a concise explanation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

test('/chat empty state includes a clear call-to-action after the headline', () => {
  const code = readFileSync(join(ROOT, 'components/portal/ResearchChat.tsx'), 'utf8');

  // Must have CTA button after the headline
  assert.match(
    code,
    /ask-cta[\s\S]*?Ask a question now/,
    'ResearchChat empty state must render a call-to-action button after the headline',
  );

  // CTA button must focus the input
  assert.match(code, /onClick=\{focusInput\}/, 'CTA button must trigger focusInput');
});

test('Composer displays input field before voice button with clear label and inputRef', () => {
  const code = readFileSync(join(ROOT, 'components/portal/ResearchChat.tsx'), 'utf8');

  // Composer must receive inputRef
  assert.match(
    code,
    /inputRef=\{inputRef\}/,
    'Composer must receive inputRef for direct focus control',
  );

  // Composer must receive header label
  assert.match(
    code,
    /header=\{[\s\S]*?ask-composer-label[\s\S]*?Ask a question/,
    'Composer must render a clear input header label',
  );

  const css = readFileSync(join(ROOT, 'app/styles/ask.css'), 'utf8');

  // Input field must have distinct text box appearance
  assert.match(
    css,
    /\.companion\.is-compact\s+\.ck-input\s*\{[\s\S]*?border:\s*1px solid/,
    'ck-input must have a visible border defining it as a text box',
  );
  assert.match(css, /\.ask-composer-label\s*\{/, 'ask.css must style .ask-composer-label');
});

test('AskTools hides the model list behind a toggle with a concise explanation', () => {
  const code = readFileSync(join(ROOT, 'components/portal/chat/AskTools.tsx'), 'utf8');

  // Must use DetailsMenu for the toggle
  assert.match(
    code,
    /DetailsMenu[\s\S]*?ask-model-menu/,
    'AskTools must wrap the model selection in DetailsMenu',
  );

  // Must show a concise explanation
  assert.match(
    code,
    /ask-model-desc[\s\S]*?Answers route across free shared models automatically/,
    'AskTools must include a concise explanation of automatic model routing',
  );

  // Must display current model summary
  assert.match(
    code,
    /ask-model-summary[\s\S]*?Model: \{currentLabel\}/,
    'AskTools summary must display current model name',
  );

  const css = readFileSync(join(ROOT, 'app/styles/ask.css'), 'utf8');

  assert.match(css, /\.ask-model-menu\s*\{/, 'ask.css must style .ask-model-menu');
  assert.match(
    css,
    /\.ask-model-panel\s*\{[\s\S]*?position:\s*absolute/,
    'ask.css must style .ask-model-panel as a popover',
  );
});
