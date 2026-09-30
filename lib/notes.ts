/**
 * Notes: written pieces, from markdown files in `content/notes/`.
 *
 * bip-kit owns the hard half — markdown to typed blocks, with no raw HTML
 * anywhere, which is the security model rather than a style choice — and,
 * since 0.5, the folder reader too (`readCollection` from `bip-kit/node`:
 * frontmatter, normalization, sort, reading time). This module adds what is
 * Substrata's own: every field below is required, and a missing one fails
 * the build instead of shipping a half-labelled note.
 *
 * A note is a file. Publishing one is adding a markdown file and committing
 * it, which is the same way every other fact on this site arrives.
 *
 * Frontmatter, all required except `tags`:
 *   title, summary, publishedAt (YYYY-MM-DD), author, tags
 *
 * Created: 2026-09-15
 * Last modified: 2026-09-30 — reads through bip-kit's collection reader.
 */

import path from 'node:path';
import type { ContentBlock } from 'bip-kit';
import { readCollection, readEntry, type CollectionEntry } from 'bip-kit/node';

const NOTES_DIR = path.join(process.cwd(), 'content', 'notes');

/**
 * The Learn section holds the same kind of file in a different folder, so the
 * reader below takes a directory rather than closing over one. Everything else
 * — the frontmatter contract, the parse, the sort — is shared.
 */
export interface Collection {
  dir: string;
  label: string;
}

export const NOTES: Collection = { dir: NOTES_DIR, label: 'notes' };
export const LEARN: Collection = {
  dir: path.join(process.cwd(), 'content', 'learn'),
  label: 'learn',
};

export interface NoteMeta {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  author: string;
  tags: string[];
  readingMinutes: number;
}

export interface Note extends NoteMeta {
  blocks: ContentBlock[];
}

/** A field the frontmatter must carry, or the file is a bug rather than a draft. */
function required(
  collection: Collection,
  meta: Record<string, unknown>,
  key: string,
  slug: string,
): string {
  const value = meta[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`content/${collection.label}/${slug}.md: frontmatter is missing "${key}"`);
  }
  return value.trim();
}

function toNote(collection: Collection, entry: CollectionEntry): Note {
  const field = (key: string) => required(collection, entry.meta, key, entry.slug);
  // bip-kit has already refused a publishedAt that is not YYYY-MM-DD.
  field('publishedAt');
  return {
    slug: entry.slug,
    title: field('title'),
    summary: field('summary'),
    author: field('author'),
    publishedAt: entry.date,
    tags: entry.tags,
    readingMinutes: entry.readingMinutes,
    blocks: entry.blocks,
  };
}

/** Every file in a collection, newest first. Throws on a malformed one rather than hiding it. */
export function allIn(collection: Collection): Note[] {
  return readCollection(collection.dir).map((entry) => toNote(collection, entry));
}

export function bySlugIn(collection: Collection, slug: string): Note | undefined {
  const entry = readEntry(collection.dir, slug);
  return entry && toNote(collection, entry);
}

export function countIn(collection: Collection): number {
  return readCollection(collection.dir).length;
}

export const allNotes = (): Note[] => allIn(NOTES);
export const noteBySlug = (slug: string): Note | undefined => bySlugIn(NOTES, slug);
export const noteCount = (): number => countIn(NOTES);

export const allLearn = (): Note[] => allIn(LEARN);
export const learnBySlug = (slug: string): Note | undefined => bySlugIn(LEARN, slug);
export const learnCount = (): number => countIn(LEARN);

/** Tags in use, with how many notes carry each. */
export function noteTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const note of allNotes()) {
    for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
