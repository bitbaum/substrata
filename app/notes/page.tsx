import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { allNotes, noteTags } from '@/lib/notes';
import { Empty, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { noteHref } from '@/lib/links';

export const metadata: Metadata = {
  title: 'Notes',
  description:
    'Written pieces: what the map implies, where the research is weak, and what a recent change actually changed.',
};

export default function NotesPage() {
  const notes = allNotes();
  const tags = noteTags();

  return (
    <Shell currentPath="notes">
      <Page>
        <SectionHeader
          title="Notes"
          lede="The map states facts. These are the arguments about what they mean, including the ones about where this research is weakest."
          stats={
            notes.length > 0
              ? [
                  { label: 'Published', value: notes.length, note: 'newest first' },
                  {
                    label: 'Latest',
                    value: notes[0].publishedAt,
                    note: notes[0].title,
                  },
                  {
                    label: 'Subjects',
                    value: tags.length,
                    note: tags.map((t) => t.tag).join(' · ') || 'none yet',
                  },
                ]
              : undefined
          }
        />

        {notes.length === 0 ? (
          <Empty what="Nothing written yet." next="Notes are markdown files in the repository." />
        ) : (
          <ol className="divide-y divide-subtle border-y border-subtle">
            {notes.map((note) => (
              <li key={note.slug} className="py-6">
                <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  {note.publishedAt} · {note.readingMinutes} min read
                  {note.tags.length > 0 && ` · ${note.tags.join(' · ')}`}
                </p>
                <h2 className="mt-2 max-w-3xl font-heading text-2xl font-semibold leading-tight tracking-display text-fg-primary">
                  <Link href={noteHref(note.slug)} className="underline-offset-4 hover:underline">
                    {note.title}
                  </Link>
                </h2>
                <p className="mt-2 max-w-prose text-base leading-relaxed text-fg-secondary">
                  {note.summary}
                </p>
                <p className="mt-3">
                  <Link
                    href={noteHref(note.slug)}
                    className="text-sm text-accent underline-offset-4 hover:underline"
                  >
                    Read →
                  </Link>
                </p>
              </li>
            ))}
          </ol>
        )}
      </Page>
    </Shell>
  );
}
