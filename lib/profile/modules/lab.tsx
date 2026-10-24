import Link from 'next/link';

import { LAB_TYPE_LABEL, labById, type Lab } from '@/config/substrata-labs';
import { relationEvidence, relationsTo, type PrintedEvidence } from '../../graph/index';
import { bottleneckHref } from '../../links';
import { countryHref, countryNameOf } from '../../world/pages';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

function labOf(e: Entity): Lab | undefined {
  return e.kind === 'lab' ? labById(e.key) : undefined;
}

const LINK = 'tap text-accent underline-offset-4 hover:underline';

/** What it works on: each line of work linked to the bottleneck it bears on. */
const labWork: ProfileModule<Lab> = {
  id: 'lab-work',
  title: t('profile.labWork.title'),
  appliesTo: ['lab'],
  importance: 10,
  load: labOf,
  evidence: (lab) => (lab.evidence === 'candidate' ? 'candidate source' : 'from its source'),
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.worksOn.map((w) => (
            <li key={w.bottleneck} className="py-4">
              <Link
                href={bottleneckHref(w.bottleneck)}
                className="link-target font-medium text-fg-primary underline-offset-4 hover:underline"
              >
                {w.bottleneck}
              </Link>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">{w.what}</p>
            </li>
          ))}
        </ul>
        <blockquote className="mt-4 max-w-prose border-l border-subtle pl-3 text-sm leading-relaxed text-fg-secondary wrap-anywhere">
          {data.quote}
        </blockquote>
        <p className="mt-1 text-xs">
          <a href={data.source} rel="noreferrer" className={LINK}>
            Source ↗
          </a>
          <span className="text-fg-muted"> · read {data.readOn}</span>
        </p>
      </>
    );
  },
};

/** Where it is and where to apply: the two things a reader who wants in needs. */
const labJoin: ProfileModule<Lab> = {
  id: 'lab-join',
  title: t('profile.labJoin.title'),
  appliesTo: ['lab'],
  importance: 30,
  load: labOf,
  evidence: (lab) => (lab.join ? 'its own pages' : 'no way to apply is recorded'),
  Render({ data }) {
    return (
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">What</dt>
        <dd className="text-fg-secondary">{LAB_TYPE_LABEL[data.type]}</dd>
        <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">Where</dt>
        <dd className="text-fg-secondary">
          {data.where ? `${data.where}, ` : ''}
          <Link href={countryHref(data.place)} className={LINK}>
            {countryNameOf(data.place)}
          </Link>
        </dd>
        <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">Its page</dt>
        <dd className="wrap-anywhere">
          <a href={data.url} rel="noreferrer" className={LINK}>
            {new URL(data.url).hostname.replace(/^www\./, '')} ↗
          </a>
        </dd>
        <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">How to join</dt>
        <dd className="wrap-anywhere">
          {data.join ? (
            <a href={data.join} rel="noreferrer" className={LINK}>
              Where to apply ↗
            </a>
          ) : (
            <span className="text-fg-muted">Not recorded yet.</span>
          )}
        </dd>
      </dl>
    );
  },
};

/** Stated funders only: `finances` relations into the lab with a quote, never a lead. */
const labFunding: ProfileModule<PrintedEvidence[]> = {
  id: 'lab-funding',
  title: t('profile.labFunding.title'),
  appliesTo: ['lab'],
  importance: 40,
  load(e) {
    if (e.kind !== 'lab') return null;
    const rows = relationsTo(e.id, { type: 'finances', minGrade: 'stated' });
    return rows.length > 0 ? rows.map((r) => relationEvidence(r)) : null;
  },
  evidence: (rows) => `${rows.length} stated`,
  Render({ data }) {
    return (
      <ul className="divide-y divide-subtle border-y border-subtle">
        {data.map((row) => (
          <li key={row.relationId} className="py-4">
            <p className="text-sm text-fg-primary">{row.sentence}</p>
            <p className="mt-1 text-xs text-fg-tertiary">
              {row.gradeLabel} · as of {row.asOf}
              {row.candidate ? ' · candidate, not yet reviewed' : ''}
            </p>
            {row.sources.map((s) => (
              <p key={s.url} className="mt-1 text-xs wrap-anywhere">
                <a href={s.url} rel="noreferrer" className={LINK}>
                  {s.quote}
                </a>
              </p>
            ))}
          </li>
        ))}
      </ul>
    );
  },
};

export { labWork, labJoin, labFunding };
