import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import {
  READINESS_BAND_LABEL,
  READINESS_SCALE,
  SCIENCE,
  readinessBand,
  readinessLabel,
} from '@/config/substrata-science';
import { TECHNOLOGIES, TECHNOLOGY_LABEL } from '@/config/substrata-taxonomy';
import { Heading, Legend, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { ReadinessFigure } from '@/components/portal/Status';
import { bottleneckHref, pipelineHref, scienceHref } from '@/lib/links';

export const metadata: Metadata = {
  title: 'Science',
  description:
    'What would remove each bottleneck: the material, process or machine that could relieve it, and how far off it is.',
};

const BAND_DOT = {
  lab: 'bg-fg-muted',
  proving: 'bg-status-warning',
  production: 'bg-status-positive',
} as const;

export default function SciencePage() {
  const byFront = TECHNOLOGIES.map(
    (front) => [front, SCIENCE.filter((s) => s.front === front.id)] as const,
  ).filter(([, entries]) => entries.length > 0);

  const relieved = new Set(SCIENCE.flatMap((s) => s.relieves.map((r) => r.bottleneck)));
  const reaching = SCIENCE.filter((s) => readinessBand(s.readiness) === 'production').length;

  return (
    <Shell>
      <Page>
        <SectionHeader
          title="Science"
          lede="A map of constraints is half the picture. This is the other half: what could remove each one, how it would work, and how close it is to being usable at scale."
          action={
            <Link href={pipelineHref()} className="text-accent underline-offset-4 hover:underline">
              The pipeline: new papers, grants and who is doing them →
            </Link>
          }
          stats={[
            {
              label: 'Technologies tracked',
              value: <Figure method="science-counts">{SCIENCE.length}</Figure>,
              note: `across ${byFront.length} fronts`,
            },
            {
              label: 'Bottlenecks addressed',
              value: <Figure method="science-counts">{relieved.size}</Figure>,
              note: 'at least one candidate relief each',
            },
            {
              label: 'Reaching production',
              value: <Figure method="readiness">{reaching}</Figure>,
              note: 'judged 8 or 9 of 9',
            },
            {
              label: 'Sourced',
              value: (
                <Figure method="science-counts">
                  {SCIENCE.filter((s) => s.source !== null).length}
                </Figure>
              ),
              note: `of ${SCIENCE.length}, each citing the claim behind its score`,
            },
          ]}
        />

        <div className="mb-8 rounded-lg border border-strong bg-surface-raised px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-fg-secondary">
            <span className="font-medium text-fg-primary">Read this first.</span> The readiness
            numbers are judgements written by hand, each now citing a source that bears on it — a
            company announcement, a filing, an agency report or a paper. Reading those sources moved
            three of the twelve scores, one of them because the entry turned out to describe the
            wrong half of the problem. The reasoning sits next to every number so you can disagree
            with it.
          </p>
        </div>

        {byFront.map(([front, entries], frontIndex) => (
          <section key={front.id} className="mb-12">
            <Heading
              index={String(frontIndex + 1).padStart(2, '0')}
              title={front.name}
              aside={front.detail}
            />
            <ul className="divide-y divide-subtle border-y border-subtle">
              {entries.map((entry) => {
                const band = readinessBand(entry.readiness);
                return (
                  <li key={entry.id} className="py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <Link
                        href={scienceHref(entry.id)}
                        className="font-medium text-fg-primary underline-offset-4 hover:underline"
                      >
                        {entry.name}
                      </Link>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-fg-secondary">
                        <span
                          aria-hidden
                          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${BAND_DOT[band]}`}
                        />
                        {READINESS_BAND_LABEL[band]}
                        <span className="font-mono text-xs text-fg-muted">
                          <ReadinessFigure entry={entry} />
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                      {entry.plain}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span className="font-mono uppercase tracking-caps text-fg-muted">
                        Would relieve
                      </span>
                      {entry.relieves.map((r) => (
                        <Link
                          key={r.bottleneck}
                          href={bottleneckHref(r.bottleneck)}
                          className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                        >
                          {r.bottleneck}
                        </Link>
                      ))}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section>
          <Heading
            index={String(byFront.length + 1).padStart(2, '0')}
            title="The readiness scale"
          />
          <ol className="grid gap-x-8 gap-y-1 border-y border-subtle py-4 sm:grid-cols-2 lg:grid-cols-3">
            {READINESS_SCALE.map((step) => (
              <li key={step.level} className="flex gap-3 text-sm">
                <span className="font-mono text-xs tabular-nums text-fg-muted">{step.level}</span>
                <span className="text-fg-secondary">{step.label}</span>
              </li>
            ))}
          </ol>
          <Legend
            items={[
              {
                term: 'In the lab',
                detail: `Levels 1 to 4: ${readinessLabel(3).toLowerCase()} or earlier. Real physics, no product.`,
              },
              {
                term: 'Being proven',
                detail:
                  'Levels 5 to 7: works outside the laboratory, not yet something a buyer can order at scale.',
              },
              {
                term: 'Reaching production',
                detail: 'Levels 8 and 9: qualified and shipping, or already standard practice.',
              },
              {
                term: `${TECHNOLOGY_LABEL.ai} and the other fronts`,
                detail:
                  'The front is which direction of progress this would unblock, not who sells it.',
              },
            ]}
          />
        </section>
      </Page>
    </Shell>
  );
}
