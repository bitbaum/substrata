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

function fileFor(slug: string): string {
  return path.join(NOTES_DIR, `${slug}.md`);
}

/** A field the frontmatter must carry, or the note is a bug rather than a draft. */
function required(meta: Record<string, unknown>, key: string, slug: string): string {
  const value = meta[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`content/notes/${slug}.md: frontmatter is missing "${key}"`);
  }
  return value.trim();
}

function read(slug: string): Note {
  const raw = readFileSync(fileFor(slug), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const blocks = parseContentBlocks(body);
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map(String)
    : typeof meta.tags === 'string'
      ? meta.tags.split(',').map((t) => t.trim())
      : [];

  const publishedAt = required(meta as Record<string, unknown>, 'publishedAt', slug);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    throw new Error(`content/notes/${slug}.md: publishedAt must be YYYY-MM-DD`);
  }

  return {
    slug,
    title: required(meta as Record<string, unknown>, 'title', slug),
    summary: required(meta as Record<string, unknown>, 'summary', slug),
    author: required(meta as Record<string, unknown>, 'author', slug),
    publishedAt,
    tags,
    readingMinutes: readingTime(blocks).minutes,
    blocks,
  };
}

function slugs(): string[] {
  if (!existsSync(NOTES_DIR)) return [];
  return readdirSync(NOTES_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''));
}

/** Every note, newest first. Throws on a malformed file rather than hiding it. */
export function allNotes(): Note[] {
  return slugs()
    .map(read)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
}

export function noteBySlug(slug: string): Note | undefined {
  return slugs().includes(slug) ? read(slug) : undefined;
}

export function noteCount(): number {
  return slugs().length;
}

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
