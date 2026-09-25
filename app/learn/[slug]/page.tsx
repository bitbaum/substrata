import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleBody } from 'bip-kit/react';

import { allLearn, learnBySlug } from '@/lib/notes';
import { learnHref } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { PageDiscussion } from '@/components/portal/PageDiscussion';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return allLearn().map((piece) => ({ slug: piece.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const piece = learnBySlug(slug);
  return piece ? { title: piece.title, description: piece.summary } : {};
}

export default async function LearnArticle({ params }: RouteParams) {
  const { slug } = await params;
  const piece = learnBySlug(slug);
  if (!piece) notFound();

  const others = allLearn().filter((p) => p.slug !== piece.slug);

  return (
    <Shell>
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/learn" className="hover:text-fg-primary">
            Learn
          </Link>
        </nav>

        <article>
          <header className="mb-8 border-b border-subtle pb-8">
            <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              {piece.readingMinutes} min read · no prior knowledge needed
            </p>
            <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
              {piece.title}
            </h1>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-fg-secondary">
              {piece.summary}
            </p>
          </header>

          <div className="bp-article max-w-prose">
            <ArticleBody blocks={piece.blocks} />
          </div>
        </article>

        <PageDiscussion path={`/learn/${piece.slug}`} />

        <footer className="mt-12 border-t border-subtle pt-6">
          <p className="text-sm text-fg-tertiary">
            Unclear, or wrong?{' '}
            <a
              href={correctionUrl(piece.title)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Say so on GitHub
            </a>
            . An explainer that does not explain is a bug.
          </p>
          {others.length > 0 && (
            <ul className="mt-6 space-y-2">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={learnHref(other.slug)}
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
