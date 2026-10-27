import Link from 'next/link';
import type { Metadata } from 'next';

import { Heading, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { Figure } from '@/components/portal/Figure';
import { UniverseRules } from '@/components/data/UniverseRules';
import { CONSIDERED } from '@/config/universe-considered';
import { resolveIn } from '@/lib/entities/registry';
import { isStub } from '@/lib/entities/types';
import { PAGE_KINDS, pageKindCounts } from '@/lib/universe/page-kinds';
import { counts } from '@/lib/universe/report';
import { UNIVERSE_FILE, universeEntries } from '@/lib/universe/store';
import { whyCompany, type Membership } from '@/lib/universe/why';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Which companies are in, and why',
  description:
    'The written rule that decides which companies Substrata covers: a theme, a size floor and a registry identifier, each cited — and, for any name, which test it passes or fails.',
};

/** The owner's question, answered from the rule every time the page renders. */
const WORKED = [
  'NVIDIA',
  'SpaceX',
  'Tesla',
  'NuScale',
  'Oklo',
  'X-energy',
  'Figure AI',
  'Unitree',
  'TerraPower',
];

function namedOnly(name: string) {
  const e = resolveIn('company', name);
  return e && isStub(e) ? { name: e.name, href: e.href, summary: e.summary } : undefined;
}

function Answer({ asked, m }: { asked: string; m: Membership }) {
  const line =
    m.status === 'in'
      ? `In — tier ${m.tier} (${m.tierLabel}): ${m.themes.join(', ')}.`
      : m.status === 'out'
        ? `Out — fails ${m.failed.map((f) => `${f.test}: ${f.reason}`).join(' ')}`
        : m.status === 'considered'
          ? `Considered, not admitted — ${m.why}`
          : m.status === 'named'
            ? `Named only (tier C) — ${m.why}`
            : `Not yet considered — ${m.why}`;
  const href = 'href' in m ? m.href : undefined;
  return (
    <li className="py-3">
      <p className="font-medium text-fg-primary">
        {href ? (
          <Link href={href} className="tap underline-offset-4 hover:underline">
            {asked}
          </Link>
        ) : (
          asked
        )}
      </p>
      <p className="mt-1 max-w-prose text-sm text-fg-secondary wrap-anywhere">{line}</p>
    </li>
  );
}

export default function CompaniesMethodPage() {
  const entries = universeEntries();
  const c = counts(entries);
  const byTheme = Object.fromEntries(c.byTheme.map((t) => [t.theme, t.count]));
  const kinds = pageKindCounts(entries);
  const out = entries.filter((e) => !e.admitted).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Shell>
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/data">Data</Link> / Companies
            </>
          }
          title="Why is a company on the list?"
          status={
            <>
              <Figure method="universe-count">{String(c.tiers.A + c.tiers.B)}</Figure> companies in
              ({c.tiers.A} profiled, {c.tiers.B} identified) from {c.byCountry.length} countries ·{' '}
              {c.out} considered and not admitted · evidence read {UNIVERSE_FILE.readOn}
            </>
          }
          note={
            <>
              A company is in when cited sources place it in a theme, show it clears a size floor
              and identify it in a registry. Absence now means something: every name either passes,
              fails a named test, or has not been looked at yet — and asking about it queues the
              look. The design is in{' '}
              <a href="https://github.com/bitbaum/substrata/blob/main/docs/architecture/2026-10-25-company-universe.md">
                the decision record
              </a>
              .
            </>
          }
          actions={<Link href="/data">Data quality and methods →</Link>}
        />

        <section className="mb-12">
          <Heading index="00" title="Is it covered?" aside="Answered by the rule, today" />
          <ul className="divide-y divide-subtle">
            {WORKED.map((name) => (
              <Answer key={name} asked={name} m={whyCompany(name, { namedOnly, file: false })} />
            ))}
          </ul>
        </section>

        <UniverseRules counts={byTheme} funds={UNIVERSE_FILE.funds} />

        <section className="mb-12">
          <Heading
            index="06"
            title="Looked for, not admitted"
            aside="Where we looked, and what is missing"
          />
          <ul className="divide-y divide-subtle">
            {CONSIDERED.map((x) => (
              <li key={x.name} className="py-3">
                <p className="font-medium text-fg-primary">{x.name}</p>
                <p className="mt-1 max-w-prose text-sm text-fg-secondary">{x.why}</p>
                <p className="mt-1 max-w-prose text-xs text-fg-muted">
                  Looked: {x.looked.join('; ')} ({x.on}).
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <Heading
            index="07"
            title="What each page can show"
            aside="Counted from identifiers, not promised"
          />
          <ul className="divide-y divide-subtle">
            {PAGE_KINDS.map((k) => (
              <li key={k.kind} className="py-3">
                <p className="font-medium text-fg-primary">
                  {k.label}{' '}
                  <span className="text-sm font-normal text-fg-tertiary">
                    · {kinds[k.kind]} companies
                  </span>
                </p>
                <p className="mt-1 max-w-prose text-sm text-fg-secondary">{k.shows}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-prose text-sm text-fg-secondary">
            Quotes are delayed end-of-day closes from Yahoo Finance, kept to draw charts and compute
            returns, never redistributed. Where a price table is empty the page says so and reads
            the source live; it never draws a line it could not read.{' '}
            <Link
              href="/markets/directory"
              className="text-accent underline-offset-4 hover:underline"
            >
              Filter all {c.tiers.A + c.tiers.B} companies →
            </Link>
          </p>
        </section>

        <section className="mb-12">
          <Heading
            index="08"
            title="Considered and out, by test"
            aside={`${c.out} companies, each with the test it failed`}
          />
          <p className="mb-3 max-w-prose text-sm text-fg-secondary">
            Out is a statement about the evidence read, not about the company. The largest group
            fails materiality: a thematic fund holds it, but under the floor or in a file that
            prints no market value. Each reason below is the sentence the rule produced.
          </p>
          <details>
            <summary className="tap cursor-pointer text-sm text-accent">
              Show all {out.length} names
            </summary>
            <ul className="mt-2 divide-y divide-subtle">
              {out.map((e) => (
                <li key={e.slug} className="py-2 text-sm text-fg-secondary wrap-anywhere">
                  <span className="font-medium text-fg-primary">{e.name}</span>
                  {e.ids.ticker
                    ? ` (${e.ids.ticker}${e.ids.exchange ? ` · ${e.ids.exchange}` : ''})`
                    : ''}{' '}
                  — fails {e.failed.join(' + ')}: {e.failed.map((t) => e.tests[t].reason).join(' ')}
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section>
          <Heading
            index="09"
            title="By country"
            aside="Legal address where a registry says, else listing venue"
          />
          <p className="research-prose">
            {c.byCountry.map((x) => `${x.country} ${x.count}`).join(' · ')}
            {c.noCountry > 0 && ` · no country stated ${c.noCountry}`}
          </p>
        </section>
      </Page>
    </Shell>
  );
}
