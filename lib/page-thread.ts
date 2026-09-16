import { randomUUID } from 'node:crypto';
import {
  canWrite,
  mergeMessages,
  visibleMessages,
  type Message,
  type Participant,
  type Thread,
} from 'threadkit';
import { database } from './db';

const ASSISTANT = 'substrata-factcheck';

export function pageThread(path: string, authors: string[]): Thread {
  const now = new Date(0);
  const ids = [...new Set([...authors, ASSISTANT, 'public'])];
  const participants: Participant[] = ids.map((actorId) => ({
    actorId,
    kind: actorId === ASSISTANT ? 'ai' : 'human',
    joinedAt: now,
    visibleFrom: 'thread-start',
    canWrite: actorId !== 'public',
  }));
  return { id: path, createdAt: now, participants };
}

export async function loadMessages(path: string): Promise<Message[]> {
  const result = await database().query<{
    id: string;
    path: string;
    author_id: string;
    body: string;
    created_at: Date;
  }>(
    'SELECT id, path, author_id, body, created_at FROM research_page_messages WHERE path=$1 ORDER BY created_at',
    [path],
  );
  return result.rows.map((row) => ({
    id: row.id,
    threadId: row.path,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function addMessage(
  path: string,
  authorId: string,
  body: string,
  kind: 'human' | 'ai',
) {
  const thread = pageThread(path, [authorId]);
  if (kind === 'human' && !canWrite(thread, authorId)) {
    throw new Error('Cannot write');
  }
  const message: Message = {
    id: randomUUID(),
    threadId: path,
    authorId,
    body,
    createdAt: new Date(),
  };
  const existing = await loadMessages(path);
  const merged = mergeMessages(existing, [message]);
  const saved = merged.find((m) => m.id === message.id) ?? message;
  await database().query(
    'INSERT INTO research_page_messages(id,path,author_id,author_kind,body) VALUES($1,$2,$3,$4,$5)',
    [saved.id, path, authorId, kind, body],
  );
  return saved;
}

export function publicMessages(path: string, messages: Message[]): Message[] {
  const thread = pageThread(
    path,
    messages.map((m) => m.authorId),
  );
  return visibleMessages(thread, 'public', messages);
}
