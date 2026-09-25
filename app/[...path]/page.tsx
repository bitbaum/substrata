import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { pageRendersOwnHeader, sitePageAt, sitePages } from '@/config/site-content';
import { SITE } from '@/lib/site';
import { SiteSections } from 'sitekit/react';
import { Shell } from '@/components/portal/Shell';

interface RouteParams {
  params: Promise<{ path?: string[] }>;
}

/**
 * One route for every page. The pages are data (config/site-content.ts), so
 * adding one is a config entry, never a new route file.
 */
export function generateStaticParams(): Array<{ path: string[] }> {
  return sitePages().map((page) => ({ path: [page.path] }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { path } = await params;
  const page = sitePageAt(sitePages(), (path ?? []).join('/'));
  if (!page) return {};
  return {
    title: page.path ? page.title : { absolute: SITE.name },
    description: page.intro,
  };
}

export default async function Page({ params }: RouteParams) {
  const { path } = await params;
  const pages = sitePages();
  const currentPath = (path ?? []).join('/');
  const page = sitePageAt(pages, currentPath);
  if (!page) notFound();

  return (
    <Shell>
      <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        {!pageRendersOwnHeader(page) && (
          <header className="mb-10 border-b border-subtle pb-8">
            <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-5xl">
              {page.title}
            </h1>
            {page.intro && (
              <p className="mt-4 max-w-prose text-lg leading-relaxed text-fg-secondary">
                {page.intro}
              </p>
            )}
          </header>
        )}
        <SiteSections sections={page.sections} />
      </div>
    </Shell>
  );
}
