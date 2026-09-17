import Link from 'next/link';

import { Empty } from '@/components/portal/Shell';
import { Status } from '@/components/portal/Status';
import {
  INSTRUMENT_EFFECT_LABEL,
  JURISDICTION_LABEL,
  instrumentsFor,
} from '@/config/substrata-policy';
import { callsAbout } from '@/config/substrata-calls';
import { CONSTRAINT_LABEL, fundingFor, kindById, providersFor } from '@/config/substrata-capital';
import { RESEARCH_PROGRAMMES } from '@/config/substrata-programmes';
import { readinessLabel, scienceFor } from '@/config/substrata-science';
import { stageById } from '@/config/substrata-stages';
import { bottleneckBySlug, type Bottleneck } from '../../bottlenecks';
import { capitalHref, marketHref, policyHref, scienceHref } from '../../links';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

function bottleneck(e: Entity): Bottleneck | undefined {
  return e.kind === 'bottleneck' ? bottleneckBySlug(e.key) : undefined;
}

const TESTS = [
  ['concentration', 'How few suppliers qualify'],
  ['substitution', 'How hard to replace'],
  ['leadTime', 'Decision to new capacity'],
  ['inelasticity', 'Can the buyer walk away'],
] as const;

const why: ProfileModule<Bottleneck> = {
  id: 'why',
  title: t('profile.why.title'),
  appliesTo: ['bottleneck'],
  importance: 10,
  load: bottleneck,
  Render({ data: b }) {
    const stage = stageById(b.stage);
    return (
      <>
        <p className="max-w-prose text-base leading-relaxed text-fg-secondary">{b.why}</p>
        {b.spec && (
          <p className="mt-3 max-w-prose text-sm text-fg-tertiary">
            <span className="font-mono text-xs uppercase tracking-caps">Grade that ships · </span>
            {b.spec}
          </p>
        )}
        <p className="mt-3 max-w-prose text-sm text-fg-tertiary">
          <span className="font-mono text-xs uppercase tracking-caps">Part of the process · </span>
          {stage.name}, which takes {stage.reliefTime.toLowerCase()} to loosen once somebody decides
          to.
        </p>
      </>
    );
  },
};

/** The four tests behind the score, so a judgement can be argued with rather than trusted. */
const severity: ProfileModule<Bottleneck> = {
  id: 'severity',
  title: t('profile.severity.title'),
  appliesTo: ['bottleneck'],
  importance: 20,
  load: bottleneck,
  evidence: (b) => `judged ${b.judgedOn} · a judgement, not a measurement`,
  Render({ data: b }) {
    return (
      <>
        <p className="mb-4 font-heading text-2xl font-semibold tabular-nums text-fg-primary">
          {b.binding}
          <span className="text-base font-normal text-fg-muted"> / 12</span>
        </p>
        <div className="grid gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle sm:grid-cols-4">
          {TESTS.map(([key, label]) => (
            <div key={key} className="bg-surface-raised px-4 py-3">
              <div className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {label}
              </div>
              <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-fg-primary">
                {b.score[key]}
                <span className="text-sm font-normal text-fg-muted"> / 3</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-fg-secondary">{b.rationale}</p>
      </>
    );
  },
};

const producers: ProfileModule<Bottleneck> = {
  id: 'producers',
  title: t('profile.producers.title'),
  appliesTo: ['bottleneck'],
  importance: 30,
  load: (e) => {
    const b = bottleneck(e);
    return b && b.producers.length > 0 ? b : null;
  },
  evidence: (b) =>
    `${b.counts.sourced} verified · ${b.counts.candidate} unchecked · ${b.counts.total} rows`,
  Render({ data: b }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-strong">
              {['Organisation', 'Where', 'Step', 'Evidence'].map((column, i) => (
                <th
                  key={column}
                  scope="col"
                  className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                    i === 1 ? 'hidden sm:table-cell' : ''
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {b.producers.map((p) => (
              <tr key={p.name} className="group align-top">
                <td className="py-3 pr-4">
                  <Link
                    href={marketHref(p.name)}
                    className="text-fg-primary underline-offset-4 group-hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="hidden py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary sm:table-cell">
                  {p.jurisdictions.join(' ')}
                </td>
                <td className="py-3 pr-4 text-sm text-fg-secondary">{p.role}</td>
                <td className="py-3 text-sm">
                  {p.source ? (
                    <a
                      href={p.source}
                      className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
                      rel="noreferrer"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-status-positive"
                      />
                      Verified source ↗
                    </a>
                  ) : p.candidates.length > 0 ? (
                    <details>
                      <summary className="inline-flex cursor-pointer items-center gap-2 text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full bg-status-warning"
                        />
                        {p.candidates.length} found, unchecked
                      </summary>
                      <ul className="mt-2 space-y-3">
                        {p.candidates.map((c) => (
                          <li key={c.url} className="max-w-prose">
                            <a
                              href={c.url}
                              rel="noreferrer"
                              className="text-accent underline-offset-4 hover:underline"
                            >
                              {c.title || c.url} ↗
                            </a>
                            <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">
                              “{c.excerpt}”
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Status state="unverified" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
};

const rules: ProfileModule<ReturnType<typeof instrumentsFor>> = {
  id: 'rules',
  title: t('profile.rules.title'),
  appliesTo: ['bottleneck'],
  importance: 40,
  load: (e) => {
    const b = bottleneck(e);
    return b ? instrumentsFor(b.name) : null;
  },
  Render({ data }) {
    if (data.length === 0)
      return (
        <Empty
          what="No rule has been researched for this one yet."
          next="Policy coverage is being built jurisdiction by jurisdiction."
        />
      );
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.map((rule) => (
            <li key={rule.id} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs tabular-nums text-fg-tertiary">{rule.date}</span>
                <Link
                  href={policyHref(rule.jurisdiction)}
                  className="font-mono text-xs uppercase tracking-caps text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  {JURISDICTION_LABEL[rule.jurisdiction]}
                </Link>
                <span className="text-sm text-fg-secondary">
                  {INSTRUMENT_EFFECT_LABEL[rule.effect]}
                </span>
              </div>
              <p className="mt-1 font-medium text-fg-primary">{rule.title}</p>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                {rule.summary}
              </p>
              <p className="mt-1 text-xs">
                <a
                  href={rule.source}
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {rule.body} ↗
                </a>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/policy" className="text-accent underline-offset-4 hover:underline">
            All policy →
          </Link>
        </p>
      </>
    );
  },
};

const removes: ProfileModule<{ b: Bottleneck; fixes: ReturnType<typeof scienceFor> }> = {
  id: 'removes',
  title: t('profile.removes.title'),
  appliesTo: ['bottleneck'],
  importance: 50,
  load: (e) => {
    const b = bottleneck(e);
    return b ? { b, fixes: scienceFor(b.name) } : null;
  },
  Render({ data: { b, fixes } }) {
    if (fixes.length === 0)
      return <Empty what="No candidate relief has been written up for this one yet." />;
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {fixes.map((fix) => {
            const relief = fix.relieves.find((r) => r.bottleneck === b.name);
            return (
              <li key={fix.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link
                    href={scienceHref(fix.id)}
                    className="font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {fix.name}
                  </Link>
                  <span className="font-mono text-xs text-fg-secondary">
                    {fix.readiness}/9 · {readinessLabel(fix.readiness)}
                  </span>
                </div>
                {relief && (
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                    {relief.mechanism}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/science" className="text-accent underline-offset-4 hover:underline">
            All science →
          </Link>
        </p>
      </>
    );
  },
};

const calls: ProfileModule<ReturnType<typeof callsAbout>> = {
  id: 'calls',
  title: t('profile.calls.title'),
  appliesTo: ['bottleneck'],
  importance: 60,
  load: (e) => {
    const b = bottleneck(e);
    const found = b ? callsAbout(b.name) : [];
    return found.length > 0 ? found : null;
  },
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.map((call) => (
            <li key={call.id} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                  {call.madeOn}
                </span>
                <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                  {call.resolution ? call.resolution.verdict : `open until ${call.resolveBy}`}
                </span>
              </div>
              <p className="mt-1 max-w-prose text-fg-primary">{call.claim}</p>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-fg-tertiary">
                <span className="font-mono uppercase tracking-caps">Settled by · </span>
                {call.settledBy}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/calls" className="text-accent underline-offset-4 hover:underline">
            All calls →
          </Link>
        </p>
      </>
    );
  },
};

const funding: ProfileModule<{
  funding: ReturnType<typeof fundingFor>;
  providers: ReturnType<typeof providersFor>;
}> = {
  id: 'funding',
  title: t('profile.funding.title'),
  appliesTo: ['bottleneck'],
  importance: 70,
  load: (e) => {
    const b = bottleneck(e);
    if (!b) return null;
    const found = { funding: fundingFor(b.name), providers: providersFor(b.name) };
    return found.funding || found.providers.length > 0 ? found : null;
  },
  Render({ data }) {
    return (
      <>
        {data.funding && (
          <div className="mb-4 rounded-lg border border-strong bg-surface-raised px-5 py-4">
            <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              Is funding the constraint? · {CONSTRAINT_LABEL[data.funding.constraint]}
            </p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-secondary">
              {data.funding.why}
            </p>
          </div>
        )}
        {data.providers.length > 0 && (
          // `willNotFund` belongs to the KIND, not the provider, so two
          // development banks in a row would print the same sentence twice and
          // read as a rendering fault. Say it once per kind.
          <ul className="divide-y divide-subtle border-y border-subtle">
            {data.providers.map((provider, index) => (
              <li key={provider.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={capitalHref(provider.id)}
                    className="font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {provider.name}
                  </Link>
                  <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                    {kindById(provider.kind).name}
                  </span>
                </div>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {provider.mandate}
                </p>
                {data.providers.findIndex((other) => other.kind === provider.kind) === index && (
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-fg-tertiary">
                    <span className="font-mono uppercase tracking-caps text-fg-muted">
                      {kindById(provider.kind).name} will not fund ·{' '}
                    </span>
                    {kindById(provider.kind).willNotFund}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          A mandate covering the kind of asset that would relieve this row. Not a claim that anyone
          has funded one, and not advice.
        </p>
      </>
    );
  },
};

const loops: ProfileModule<{ id: string; name: string; period: string }[]> = {
  id: 'loops',
  title: t('profile.loops.title'),
  appliesTo: ['bottleneck'],
  importance: 84,
  load: (e) => {
    const b = bottleneck(e);
    if (!b) return null;
    const found = RESEARCH_PROGRAMMES.flatMap((programme) =>
      programme.layers.filter((layer) => layer.gatedBy.includes(b.name)),
    );
    return found.length > 0 ? found : null;
  },
  Render({ data }) {
    return (
      <ul className="divide-y divide-subtle border-y border-subtle">
        {data.map((layer) => (
          <li
            key={layer.id}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
          >
            <Link href="/research" className="text-fg-primary underline-offset-4 hover:underline">
              {layer.name}
            </Link>
            <span className="font-mono text-xs text-fg-secondary">{layer.period}</span>
          </li>
        ))}
      </ul>
    );
  },
};

export { why, severity, producers, rules, removes, calls, funding, loops };
