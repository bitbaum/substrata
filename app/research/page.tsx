import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import {
  DELIVERABLE_STATUS_LABEL,
  RESEARCH_PROGRAMMES,
  programmeProgress,
  rowsCitedBy,
} from '@/config/substrata-programmes';
import { correctionUrl } from '@/lib/site';
import { Ladder } from '@/components/portal/Ladder';
import { Heading, Page, Shell } from '@/components/portal/Shell';

const programme = RESEARCH_PROGRAMMES[0];

export const metadata: Metadata = {
  title: programme.title,
  description: programme.question,
};

const LEDGER_DOT = {
  done: 'bg-status-positive',
  'in-progress': 'bg-status-warning',
  'not-started': 'bg-fg-muted',
} as const;

/**
 * One programme, as a picture first: the ladder of loop layers to scale,
 * then the open questions, then the ledger. Framing beyond the first
 * paragraph is folded away — it is there for the reader who wants it and
 * out of the way of the one who does not.
 */
export default function ResearchPage() {
  const progress = programmeProgress(programme);
  const cited = rowsCitedBy(programme);

  return (
    <Shell>
      <Page>
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Programme · opened {programme.opened} · {programme.status}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-5xl">
            {programme.title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-fg-secondary">{programme.question}</p>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-tertiary">
            {programme.framing[0]}
          </p>
          <details className="mt-2 max-w-prose text-sm leading-relaxed text-fg-tertiary">
            <summary className="cursor-pointer text-fg-secondary underline-offset-4 hover:underline">
              Why this framing
            </summary>
            {programme.framing.slice(1).map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="mt-3">
                {paragraph}
              </p>
            ))}
          </details>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <a
              href={correctionUrl(programme.title)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Contribute a source
            </a>
            <Link
              href="/api/map"
              className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              As JSON →
            </Link>
          </div>
        </header>

        <section className="mb-12">
          <Heading
            index="01"
            title="One turn of the loop, layer by layer"
            aside={`${programme.layers.length} layers · ${cited.length} bottlenecks cited · bar length is log of the period`}
          />
          <Ladder layers={programme.layers} />
        </section>

        <section className="mb-12">
          <Heading
            index="02"
            title="Open questions"
            aside="Each with the observation that would settle it"
          />
          <ol className="divide-y divide-subtle border-y border-subtle">
            {programme.questions.map((question, index) => (
              <li key={question.id} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[2rem_1fr]">
                <span className="font-mono text-xs text-fg-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-medium text-fg-primary">{question.question}</p>
                  <p className="mt-1 text-sm text-fg-tertiary">
                    <span className="font-mono text-xs uppercase tracking-caps">Settled by · </span>
                    {question.settledBy}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <Heading
            index="03"
            title="Ledger"
            aside={`${progress.done} done · ${progress.inProgress} in progress · ${progress.total - progress.done - progress.inProgress} not started`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {programme.deliverables.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                <span
                  className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${LEDGER_DOT[item.status]}`}
                />
                <div>
                  <p className="text-fg-primary">
                    {item.what}
                    <span className="ml-2 font-mono text-xs text-fg-muted">
                      {DELIVERABLE_STATUS_LABEL[item.status]}
                    </span>
                  </p>
                  <p className="mt-0.5 max-w-prose text-sm text-fg-tertiary">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </Page>
    </Shell>
  );
}
