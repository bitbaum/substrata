import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { GLOSSARY, glossaryAlphabetical, glossaryAnchor } from '@/config/substrata-glossary';
import { allLearn } from '@/lib/notes';
import { glossaryHref, learnHref } from '@/lib/links';
import { Heading, Page, SectionHeader, Shell } from '@/components/portal/Shell';

export const metadata: Metadata = {
  title: 'Learn',
  description:
    'What the terms mean and how to read this site, for people who do not work in these industries.',
};

export default function LearnPage() {
  const explainers = allLearn();
  const terms = glossaryAlphabetical();
  const start = explainers.find((e) => e.tags.includes('start-here'));
  const rest = explainers.filter((e) => e !== start);

  return (
    <Shell currentPath="learn">
      <Page>
        <SectionHeader
          title="Learn"
          lede="This subject has a lot of jargon and most of it is avoidable. Here is what the words mean, how to read the tables, and the few ideas that make the rest of the site make sense."
          stats={[
            { label: 'Explainers', value: explainers.length, note: 'a few minutes each' },
            { label: 'Terms defined', value: GLOSSARY.length, note: 'every one used on this site' },
            {
              label: 'Prior knowledge needed',
              value: 'None',
              note: 'that is the whole point of this section',
            },
          ]}
        />

        {start && (
          <section className="mb-14">
            <Heading index="01" title="Start here" />
            <Link
              href={learnHref(start.slug)}
              className="block rounded-lg border border-strong bg-surface-raised p-5 transition-colors hover:border-accent"
            >
              <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {start.readingMinutes} min read
              </p>
              <p className="mt-2 font-heading text-xl font-semibold text-fg-primary">
                {start.title}
              </p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-secondary">
                {start.summary}
              </p>
            </Link>
          </section>
        )}

        <section className="mb-14">
          <Heading index="02" title="The ideas worth having" aside={`${rest.length} explainers`} />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {rest.map((piece) => (
              <li key={piece.slug} className="py-5">
                <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  {piece.readingMinutes} min read
                  {piece.tags.length > 0 && ` · ${piece.tags.join(' · ')}`}
                </p>
                <h3 className="mt-1 font-heading text-xl font-semibold text-fg-primary">
                  <Link href={learnHref(piece.slug)} className="underline-offset-4 hover:underline">
                    {piece.title}
                  </Link>
                </h3>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {piece.summary}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <Heading
            index="03"
            title="Every term, defined"
            aside={`${terms.length}, alphabetical — anything on the site links here`}
          />
          <dl className="divide-y divide-subtle border-y border-subtle">
            {terms.map((entry) => (
              <div key={entry.term} id={glossaryAnchor(entry.term)} className="scroll-mt-24 py-4">
                <dt className="font-medium text-fg-primary">{entry.term}</dt>
                <dd className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {entry.detail}
                </dd>
                {entry.seeAlso && entry.seeAlso.length > 0 && (
                  <dd className="mt-1.5 flex flex-wrap gap-x-3 text-xs">
                    <span className="font-mono uppercase tracking-caps text-fg-muted">
                      See also
                    </span>
                    {entry.seeAlso.map((other) => (
                      <Link
                        key={other}
                        href={glossaryHref(other)}
                        className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                      >
                        {other}
                      </Link>
                    ))}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      </Page>
    </Shell>
  );
}
