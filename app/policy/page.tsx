import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import {
  INSTRUMENTS,
  INSTRUMENT_EFFECT_LABEL,
  INSTRUMENT_KIND_LABEL,
  INSTRUMENT_STATUS_LABEL,
  JURISDICTIONS,
  JURISDICTION_LABEL,
  RECOMMENDATIONS,
  instrumentsNewestFirst,
  policyTotals,
  type Instrument,
} from '@/config/substrata-policy';
import { Empty, Heading, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { bottleneckHref, marketHref, policyHref } from '@/lib/links';
import { hasMarketPage } from '@/lib/participants';

export const metadata: Metadata = {
  title: 'Policy',
  description:
    'The rules that speed up or slow down building: what each instrument does, to which bottleneck, and who publicly asked for it.',
};

const EFFECT_DOT: Record<Instrument['effect'], string> = {
  tightens: 'bg-status-negative',
  loosens: 'bg-status-positive',
  mixed: 'bg-status-warning',
};

function InstrumentCard({ instrument }: { instrument: Instrument }) {
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs tabular-nums text-fg-tertiary">{instrument.date}</span>
        <span className="inline-flex items-center gap-2 text-sm text-fg-secondary">
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${EFFECT_DOT[instrument.effect]}`}
          />
          {INSTRUMENT_EFFECT_LABEL[instrument.effect]}
        </span>
        <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
          {INSTRUMENT_KIND_LABEL[instrument.kind]}
        </span>
        <Link
          href={policyHref(instrument.jurisdiction)}
          className="font-mono text-xs uppercase tracking-caps text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
        >
          {JURISDICTION_LABEL[instrument.jurisdiction]}
        </Link>
        <span
          className={[
            'rounded-full border px-2 py-0.5 font-mono text-[0.68rem] uppercase tracking-caps',
            instrument.status === 'in-force'
              ? 'border-strong text-fg-secondary'
              : 'border-status-warning text-status-warning',
          ].join(' ')}
        >
          {INSTRUMENT_STATUS_LABEL[instrument.status]}
        </span>
      </div>

      <p className="mt-2 font-medium text-fg-primary">{instrument.title}</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
        {instrument.summary}
      </p>

      {instrument.statusNote && (
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-fg-tertiary">
          {instrument.statusNote}
        </p>
      )}

      {instrument.bottlenecks.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="font-mono uppercase tracking-caps text-fg-muted">Bears on</span>
          {instrument.bottlenecks.map((name) => (
            <Link
              key={name}
              href={bottleneckHref(name)}
              className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              {name}
            </Link>
          ))}
        </p>
      )}

      <div className="mt-2 text-xs">
        <span className="font-mono uppercase tracking-caps text-fg-muted">Asked for by · </span>
        {instrument.proponents.length === 0 ? (
          <span className="text-fg-tertiary">None identified</span>
        ) : (
          <span className="text-fg-secondary">
            {instrument.proponents.map((p, i) => (
              <span key={p.name}>
                {i > 0 && '; '}
                {hasMarketPage(p.name) ? (
                  <Link
                    href={marketHref(p.name)}
                    className="text-fg-primary underline-offset-4 hover:underline"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="text-fg-primary">{p.name}</span>
                )}{' '}
                (
                <a
                  href={p.source}
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  what they filed ↗
                </a>
                ) — {p.asked}
              </span>
            ))}
          </span>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-fg-tertiary hover:text-fg-primary">Source</summary>
        <p className="mt-1 max-w-prose leading-relaxed text-fg-tertiary">“{instrument.quote}”</p>
        <p className="mt-1">
          <a
            href={instrument.source}
            rel="noreferrer"
            className="text-accent underline-offset-4 hover:underline"
          >
            {instrument.body} ↗
          </a>
          <span className="ml-2 text-fg-muted">
            {instrument.primary ? 'Official source' : 'Secondary source'} · read {instrument.readOn}
          </span>
        </p>
      </details>
    </li>
  );
}

export default function PolicyPage() {
  const totals = policyTotals();
  const all = instrumentsNewestFirst();
  const slowing = all.filter((i) => i.effect === 'tightens');
  const speeding = all.filter((i) => i.effect !== 'tightens');

  return (
    <Shell currentPath="policy">
      <Page>
        <SectionHeader
          title="Policy"
          lede="Most deliberate slowing of technology happens through rules rather than through physics. This is what those rules do, to which constraint, and who publicly asked for them."
          stats={[
            {
              label: 'Rules tracked',
              value: <Figure method="rules-tracked">{totals.instruments}</Figure>,
              note: (
                <>
                  across <Figure method="jurisdictions">{totals.jurisdictions}</Figure>{' '}
                  jurisdictions
                </>
              ),
            },
            {
              label: 'Slow building',
              value: <Figure method="rule-direction">{totals.tightening}</Figure>,
              note: 'controls, tariffs, safeguards',
            },
            {
              label: 'Speed building',
              value: <Figure method="rule-direction">{totals.loosening}</Figure>,
              note: 'permitting and process reform',
            },
            {
              label: 'With a named backer',
              value: <Figure method="rules-with-backer">{totals.withProponents}</Figure>,
              note: 'organisations that asked in their own words',
            },
          ]}
        />

        <div className="mb-8 rounded-lg border border-strong bg-surface-raised px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-fg-secondary">
            <span className="font-medium text-fg-primary">How this is kept honest.</span> Every rule
            here was fetched and read on the date shown, and carries one sentence from its own
            source. An organisation is named as having asked for a rule only where it says so in its
            own release, filing or testimony — never inferred from who benefits. Where nobody has
            been identified, the row says that rather than implying nobody asked.
          </p>
        </div>

        <section className="mb-14">
          <Heading
            index="01"
            title="Rules that slow building"
            aside={`${slowing.length} tracked, newest first`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {slowing.map((instrument) => (
              <InstrumentCard key={instrument.id} instrument={instrument} />
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <Heading
            index="02"
            title="Rules that speed building, or cut both ways"
            aside={`${speeding.filter((i) => i.effect === 'loosens').length} speed it · ${speeding.filter((i) => i.effect === 'mixed').length} both ways`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {speeding.map((instrument) => (
              <InstrumentCard key={instrument.id} instrument={instrument} />
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <Heading index="03" title="By jurisdiction" />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-strong">
                  {['Jurisdiction', 'What it decides here', 'Slowing', 'Speeding or mixed'].map(
                    (c, i) => (
                      <th
                        key={c}
                        scope="col"
                        className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                          i === 1 ? 'hidden sm:table-cell' : ''
                        }`}
                      >
                        {c}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {JURISDICTIONS.map((j) => {
                  const mine = INSTRUMENTS.filter((i) => i.jurisdiction === j.id);
                  return (
                    <tr key={j.id} className="group align-top">
                      <td className="py-3 pr-4">
                        {mine.length > 0 ? (
                          <Link
                            href={policyHref(j.id)}
                            className="font-medium text-fg-primary underline-offset-4 group-hover:underline"
                          >
                            {j.name}
                          </Link>
                        ) : (
                          <span className="text-fg-tertiary">{j.name}</span>
                        )}
                      </td>
                      <td className="hidden max-w-md py-3 pr-4 text-sm text-fg-secondary sm:table-cell">
                        {j.detail}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary">
                        {mine.filter((i) => i.effect === 'tightens').length || '—'}
                      </td>
                      <td className="py-3 font-mono text-xs tabular-nums text-fg-secondary">
                        {mine.filter((i) => i.effect !== 'tightens').length || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fg-muted">
            A jurisdiction with no number is one nothing has been researched for yet, not one with
            no rules.
          </p>
        </section>

        <section>
          <Heading
            index="04"
            title="What we would change"
            aside="This project's own view, with what would prove it wrong"
          />
          {RECOMMENDATIONS.length === 0 ? (
            <Empty what="No recommendations published yet." />
          ) : (
            <ul className="divide-y divide-subtle border-y border-subtle">
              {RECOMMENDATIONS.map((rec) => (
                <li key={rec.id} className="py-5">
                  <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                    {JURISDICTION_LABEL[rec.jurisdiction]} · decided by {rec.decider}
                  </p>
                  <p className="mt-2 max-w-prose font-medium text-fg-primary">{rec.change}</p>
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                    {rec.because}
                  </p>
                  <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                        Expected effect
                      </dt>
                      <dd className="mt-0.5 max-w-prose leading-relaxed text-fg-secondary">
                        {rec.expectedEffect}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                        What would show this is wrong
                      </dt>
                      <dd className="mt-0.5 max-w-prose leading-relaxed text-fg-secondary">
                        {rec.falsifier}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Page>
    </Shell>
  );
}
