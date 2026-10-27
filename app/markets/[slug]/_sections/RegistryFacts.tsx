import Link from 'next/link';

import { areaBySlug } from '@/lib/registry/areas';
import { gapsOf } from '@/lib/registry/gaps';
import { GRADE_LABEL, KIND_LABEL, type Company } from '@/lib/registry/schema';
import { correctionUrl } from '@/lib/site';

const CAPS = 'font-mono text-xs uppercase tracking-caps text-fg-tertiary';

/** Registered, not necessarily profiled: what the registry says about a company, and what it does not. */
export function RegistryFacts({ company }: { company: Company }) {
  const summary = company.evidence.find((e) => e.field === 'summary');
  const gaps = gapsOf(company);
  return (
    <div className="space-y-6">
      {company.summary && summary && (
        <div>
          <p className={CAPS}>What it is</p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-primary">
            {company.summary}
          </p>
          <p className="mt-1 text-xs text-fg-tertiary">
            {GRADE_LABEL[summary.grade]} ·{' '}
            <a
              href={summary.source}
              rel="noreferrer"
              className="tap underline-offset-4 hover:underline"
            >
              source
            </a>{' '}
            · read {summary.readOn}
          </p>
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className={CAPS}>Kind</dt>
          <dd className="mt-1 text-fg-primary">{KIND_LABEL[company.kind]}</dd>
        </div>
        {company.hq && (
          <div>
            <dt className={CAPS}>Headquarters</dt>
            <dd className="mt-1 text-fg-primary">{company.hq}</dd>
          </div>
        )}
        {company.areas.length > 0 && (
          <div className="sm:col-span-2">
            <dt className={CAPS}>Areas</dt>
            <dd className="mt-1 text-fg-primary">
              {company.areas.map((a, i) => (
                <span key={a.area}>
                  {i > 0 && ', '}
                  <Link
                    href={`/areas/${a.area}`}
                    className="tap underline-offset-4 hover:underline"
                  >
                    {areaBySlug(a.area)?.name ?? a.area}
                  </Link>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      {gaps.length > 0 && (
        <div>
          <p className={CAPS}>Not known yet</p>
          <ul className="mt-2 divide-y divide-subtle border-y border-subtle text-sm">
            {gaps.map((g) => (
              <li key={g.field} className="py-2">
                <span className="text-fg-primary">{g.label}</span>
                <span className="text-fg-secondary"> — would come from {g.from}.</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <a
              href={correctionUrl(company.name, {
                problem: `Evidence for: ${gaps.map((g) => g.label).join(', ')}.`,
              })}
              className="tap inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline"
            >
              Send evidence
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
