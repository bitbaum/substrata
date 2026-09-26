import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleBody } from 'bip-kit/react';

import { allNotes, noteBySlug } from '@/lib/notes';
import { noteHref } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { PageDiscussion } from '@/components/portal/PageDiscussion';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return allNotes().map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const note = noteBySlug(slug);
  if (!note) return {};
  return {
    title: note.title,
    description: note.summary,
    openGraph: { type: 'article', title: note.title, description: note.summary },
  };
}

/**
 * One note. bip-kit turns the markdown into typed blocks and renders them
 * with no raw HTML anywhere, which is why a note can be a plain file in the
 * repository without becoming an injection surface.
 */
export default async function NotePage({ params }: RouteParams) {
  const { slug } = await params;
  const note = noteBySlug(slug);
  if (!note) notFound();

  const others = allNotes().filter((n) => n.slug !== note.slug);

  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/notes" className="hover:text-fg-primary">
            Notes
          </Link>
        </nav>

        <article>
          <header className="mb-8 border-b border-subtle pb-8">
            <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              {note.publishedAt} · {note.readingMinutes} min read
              {note.tags.length > 0 && ` · ${note.tags.join(' · ')}`}
            </p>
            <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
              {note.title}
            </h1>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-fg-secondary">
              {note.summary}
            </p>
          </header>

          <div className="bp-article max-w-prose">
            <ArticleBody blocks={note.blocks} />
          </div>
        </article>

        <PageDiscussion path={`/notes/${note.slug}`} />

        <footer className="mt-12 border-t border-subtle pt-6">
          <p className="text-sm text-fg-tertiary">
            Something here wrong?{' '}
            <a
              href={correctionUrl(note.title)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Say so on GitHub
            </a>
            , or{' '}
            <Link href="/join" className="text-accent underline-offset-4 hover:underline">
              contribute what you know
            </Link>
            .
          </p>
          {others.length > 0 && (
            <ul className="mt-6 space-y-2">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={noteHref(other.slug)}
                    className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                  >
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </footer>
      </Page>
    </Shell>
  );
}
