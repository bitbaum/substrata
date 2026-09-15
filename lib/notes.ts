/**
 * Notes: written pieces, from markdown files in `content/notes/`.
 *
 * bip-kit owns the hard half — markdown to typed blocks, with no raw HTML
 * anywhere, which is the security model rather than a style choice. It
 * deliberately ships no filesystem layer, so this module is the listing half:
 * find the files, read the frontmatter, sort, and hand blocks to the renderer.
 *
 * A note is a file. Publishing one is adding a markdown file and committing
 * it, which is the same way every other fact on this site arrives.
 *
 * Frontmatter, all required except `tags`:
 *   title, summary, publishedAt (YYYY-MM-DD), author, tags
 *
 * Created: 2026-09-15
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseContentBlocks, parseFrontmatter, readingTime, type ContentBlock } from 'bip-kit';

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

function fileFor(collection: Collection, slug: string): string {
  return path.join(collection.dir, `${slug}.md`);
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

function read(collection: Collection, slug: string): Note {
  const raw = readFileSync(fileFor(collection, slug), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const blocks = parseContentBlocks(body);
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map(String)
    : typeof meta.tags === 'string'
      ? meta.tags.split(',').map((t) => t.trim())
      : [];

  const publishedAt = required(collection, meta as Record<string, unknown>, 'publishedAt', slug);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    throw new Error(`content/${collection.label}/${slug}.md: publishedAt must be YYYY-MM-DD`);
  }

  return {
    slug,
    title: required(collection, meta as Record<string, unknown>, 'title', slug),
    summary: required(collection, meta as Record<string, unknown>, 'summary', slug),
    author: required(collection, meta as Record<string, unknown>, 'author', slug),
    publishedAt,
    tags,
    readingMinutes: readingTime(blocks).minutes,
    blocks,
  };
}

function slugs(collection: Collection): string[] {
  if (!existsSync(collection.dir)) return [];
  return readdirSync(collection.dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''));
}

/** Every file in a collection, newest first. Throws on a malformed one rather than hiding it. */
export function allIn(collection: Collection): Note[] {
  return slugs(collection)
    .map((slug) => read(collection, slug))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
}

export function bySlugIn(collection: Collection, slug: string): Note | undefined {
  return slugs(collection).includes(slug) ? read(collection, slug) : undefined;
}

export function countIn(collection: Collection): number {
  return slugs(collection).length;
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
