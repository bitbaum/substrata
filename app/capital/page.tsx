import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import {
  CAPITAL_KINDS,
  CAPITAL_KIND_LABEL,
  CAPITAL_PROVIDERS,
  CONSTRAINT_LABEL,
  FUNDING_ASSESSMENTS,
  capitalTotals,
  type FundingConstraint,
} from '@/config/substrata-capital';
import { JURISDICTION_LABEL } from '@/config/substrata-policy';
import { bottleneckHref, capitalHref, glossaryHref } from '@/lib/links';
import { Heading, Legend, Page, SectionHeader, Shell } from '@/components/portal/Shell';

export const metadata: Metadata = {
  title: 'Capital',
  description:
    'Who could fund relief for each bottleneck, what each kind of money will not fund, and where money is not the constraint at all.',
};

const CONSTRAINT_DOT: Record<FundingConstraint, string> = {
  'not-money': 'bg-fg-muted',
  'partly-money': 'bg-status-warning',
  money: 'bg-status-positive',
};

export default function CapitalPage() {
  const totals = capitalTotals();

  return (
    <Shell currentPath="capital">
      <Page>
        <SectionHeader
          title="Capital"
          lede="Money is rarely the scarce thing. Money with the right mandate and the right patience is — and for most constraints on this site, funding is not what is missing."
          stats={[
            { label: 'Kinds of capital', value: totals.kinds, note: 'and what each will not fund' },
            {
              label: 'Providers',
              value: totals.providers,
              note: 'each citing its own mandate document',
            },
            {
              label: 'Bottlenecks assessed',
              value: totals.assessed,
              note: 'is funding actually the constraint?',
            },
            {
              label: 'Where money is not it',
              value: totals.notMoney,
              note: `of ${totals.assessed} assessed`,
            },
          ]}
        />

        <div className="mb-8 rounded-lg border border-strong bg-surface-raised px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-fg-secondary">
            <span className="font-medium text-fg-primary">This is not investment advice.</span> It
            maps who funds what, on whose mandate, over what horizon. Nothing here says where to put
            money and nothing here is a recommendation. If you want the argument rather than the
            tables, read{' '}
            <Link
              href="/learn/what-money-cannot-buy"
              className="text-accent underline-offset-4 hover:underline"
            >
              what money cannot buy
            </Link>
            .
          </p>
        </div>

        <section className="mb-14">
          <Heading
            index="01"
            title="Kinds of money, and what each will not fund"
            aside="The last column is the one that matters"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-strong">
                  {['Kind', 'Cheque', 'Patience', 'Will not fund'].map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                        i === 1 ? 'hidden lg:table-cell' : i === 2 ? 'hidden sm:table-cell' : ''
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {CAPITAL_KINDS.map((kind) => (
                  <tr key={kind.id} className="align-top">
                    <td className="py-3 pr-4">
                      <span className="font-medium text-fg-primary">{kind.name}</span>
                      <p className="mt-0.5 max-w-xs text-xs leading-snug text-fg-tertiary">
                        {kind.plain}
                      </p>
                    </td>
                    <td className="hidden py-3 pr-4 text-sm text-fg-secondary lg:table-cell">
                      {kind.chequeSize}
                    </td>
                    <td className="hidden py-3 pr-4 text-sm text-fg-secondary sm:table-cell">
                      {kind.horizon}
                    </td>
                    <td className="max-w-md py-3 text-sm leading-relaxed text-fg-secondary">
                      {kind.willNotFund}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Legend
            items={[
              {
                term: 'Cheque',
                detail: 'The size of commitment this kind of money typically writes at once.',
              },
              {
                term: 'Patience',
                detail:
                  'How long it will wait before it wants its money back. For a fifteen-year asset this is the field that eliminates most candidates.',
              },
              {
                term: 'Offtake',
                detail:
                  'A buyer committing to purchase output for years, which is usually what makes a new plant financeable at all.',
              },
            ]}
          />
        </section>

        <section className="mb-14">
          <Heading
            index="02"
            title="Is funding actually the constraint?"
            aside={`${totals.notMoney} of ${totals.assessed} say no`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {FUNDING_ASSESSMENTS.map((item) => (
              <li key={item.bottleneck} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link
                    href={bottleneckHref(item.bottleneck)}
                    className="font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {item.bottleneck}
                  </Link>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-fg-secondary">
                    <span
                      aria-hidden
                      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${CONSTRAINT_DOT[item.constraint]}`}
                    />
                    {CONSTRAINT_LABEL[item.constraint]}
                  </span>
                </div>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {item.why}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
            These are judgements, dated like every other judgement here. The reasoning is next to
            each one so it can be argued with.
          </p>
        </section>

        <section>
          <Heading
            index="03"
            title="Who could fund relief"
            aside={`${totals.providers} tracked, each from its own mandate`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {CAPITAL_PROVIDERS.map((provider) => (
              <li key={provider.id} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={capitalHref(provider.id)}
                    className="font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {provider.name}
                  </Link>
                  <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                    {CAPITAL_KIND_LABEL[provider.kind]}
                  </span>
                  <span className="font-mono text-xs text-fg-muted">
                    {JURISDICTION_LABEL[provider.jurisdiction]}
                  </span>
                </div>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {provider.mandate}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className="font-mono uppercase tracking-caps text-fg-muted">
                    Could move
                  </span>
                  {provider.canMove.map((name) => (
                    <Link
                      key={name}
                      href={bottleneckHref(name)}
                      className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                    >
                      {name}
                    </Link>
                  ))}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
            Three, not more. Two others were drafted and removed because their mandate sentences
            could not be found on their own pages — the same bar the{' '}
            <Link href="/policy" className="text-accent underline-offset-4 hover:underline">
              policy section
            </Link>{' '}
            uses. See{' '}
            <Link
              href={glossaryHref('Project finance')}
              className="text-accent underline-offset-4 hover:underline"
            >
              project finance
            </Link>{' '}
            and{' '}
            <Link
              href={glossaryHref('Offtake')}
              className="text-accent underline-offset-4 hover:underline"
            >
              offtake
            </Link>{' '}
            for the mechanisms most of this turns on.
          </p>
        </section>
      </Page>
    </Shell>
  );
}
