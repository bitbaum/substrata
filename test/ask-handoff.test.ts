/**
 * The home box → /chat handoff (lib/chat/handoff.ts): a message handed over
 * once — words and attachments — never twice, and the shared draft. Storage
 * that refuses is said, never thrown.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadDraft, saveDraft, savePending, sendHref, takePending } from '../lib/chat/handoff';
import { ATTACHMENT_ONLY_TEXT } from '../lib/chat/image';

function memory(limit = Infinity) {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limit) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
}

test('a message handed to /chat is read once, attachments and all', () => {
  const store = memory();
  const id = savePending(
    {
      text: ATTACHMENT_ONLY_TEXT,
      attachments: [{ kind: 'image', name: 'post.png', mimeType: 'image/png', dataBase64: 'AAAA' }],
    },
    store,
    'abcdef12-3456',
  );
  assert.equal(id, 'abcdef12-3456');
  assert.equal(sendHref(id!), '/chat?send=abcdef12-3456');
  const got = takePending(id, store);
  assert.equal(got?.text, ATTACHMENT_ONLY_TEXT);
  assert.equal(got?.attachments[0].name, 'post.png');
  assert.equal(takePending(id, store), null, 'never sent twice');
  assert.equal(takePending('../x', store), null, 'only an id we minted');
});

test('a store that refuses says so; nothing malformed comes back', () => {
  assert.equal(savePending({ text: 'x', attachments: [] }, memory(1)), null);
  assert.equal(savePending({ text: 'x', attachments: [] }, null), null);
  const store = memory();
  store.setItem('substrata-ask-send:abcdef12', JSON.stringify({ text: 1, attachments: [] }));
  assert.equal(takePending('abcdef12', store), null);
  store.setItem(
    'substrata-ask-send:abcdef13',
    JSON.stringify({ text: 'hi', attachments: [{ kind: 'image', name: 'x' }] }),
  );
  assert.deepEqual(
    takePending('abcdef13', store)?.attachments,
    [],
    'a malformed attachment is dropped',
  );
});

test('the shared draft: kept, cleared, and an empty draft when storage is blocked', () => {
  const store = memory();
  saveDraft('half a question', store);
  assert.equal(loadDraft(store), 'half a question');
  saveDraft('', store);
  assert.equal(loadDraft(store), '');
  assert.equal(loadDraft(null), '');
});
