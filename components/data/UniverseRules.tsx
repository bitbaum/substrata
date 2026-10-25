import React from 'react';

import { Heading } from '@/components/portal/Shell';
import {
  IDENTITY_KINDS,
  IDENTITY_LABEL,
  MAX_AGE_DAYS,
  REFRESH,
  SIZE_FLOORS,
  TESTS,
  THEMES,
  TIERS,
} from '@/config/universe-themes';
import { FUNDS, FUNDS_NOT_READ, SIC_THEMES, WIKIDATA_INDUSTRIES } from '@/config/universe-sources';
import { usd } from '@/lib/universe/admit';
import type { FundRead } from '@/lib/universe/store';

const CAPS = 'font-mono text-xs uppercase tracking-caps text-fg-tertiary';
const LINK = 'tap text-accent underline-offset-4 hover:underline';

/**
 * The universe rule, printed from config/universe-themes.ts and
 * config/universe-sources.ts — the same constants admit() reads, so this
 * page cannot describe a rule the code does not run.
 */
export function UniverseRules({
  counts,
  funds,
}: {
  counts: Record<string, number>;
  funds: FundRead[];
}) {
  return (
    <>
      <section className="mb-12">
        <Heading index="01" title="The three tests" aside="A company is in when all three pass" />
        <ol className="research-prose">
          {TESTS.map((t) => (
            <li key={t.id}>
              <strong>{t.label}.</strong> {t.rule}
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-12">
        <Heading
          index="02"
          title="Themes"
          aside={`${THEMES.length} branches of the frontier tree`}
        />
        <ul className="divide-y divide-subtle">
          {THEMES.map((t) => (
            <li key={t.id} id={`theme-${t.id}`} className="scroll-mt-24 py-3">
              <p className="font-medium text-fg-primary">
                {t.label}{' '}
                <span className="text-sm font-normal text-fg-tertiary">
                  · {counts[t.id] ?? 0} admitted
                </span>
              </p>
              <p className="mt-1 max-w-prose text-sm text-fg-secondary">{t.covers}</p>
              <p className="mt-1 max-w-prose text-xs text-fg-muted">
                Why it is on the tree: {t.why}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12">
        <Heading index="03" title="Size floors" aside="Materiality: any one, cited" />
        <ul className="divide-y divide-subtle">
          {SIZE_FLOORS.map((f) => (
            <li key={f.basis} className="py-3">
              <p className="text-sm text-fg-primary">{f.label}</p>
              <p className="mt-1 max-w-prose text-xs text-fg-muted">
                Floor {usd(f.floorUsd)}. {f.why}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-sm text-fg-secondary">
          Identity: at least one of {IDENTITY_KINDS.map((k) => IDENTITY_LABEL[k]).join(', ')}.
        </p>
      </section>

      <section className="mb-12">
        <Heading index="04" title="Tiers" aside="What a page may claim" />
        <ul className="divide-y divide-subtle">
          {TIERS.map((t) => (
            <li key={t.tier} className="py-3">
              <p className="font-medium text-fg-primary">
                Tier {t.tier} · {t.label}
              </p>
              <p className="mt-1 max-w-prose text-sm text-fg-secondary">{t.means}</p>
              <p className="mt-1 max-w-prose text-xs text-fg-muted">{t.becomes}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-sm text-fg-secondary">
          A source counts while it is fresh: a fund file for {MAX_AGE_DAYS.fund} days, a filing for{' '}
          {MAX_AGE_DAYS.filing}, a registry record for {MAX_AGE_DAYS.registry}, a company statement
          for {MAX_AGE_DAYS.statement}. Re-read {REFRESH.cadence}. {REFRESH.leaves}
        </p>
      </section>

      <section className="mb-12">
        <Heading
          index="05"
          title="Where the evidence is read"
          aside="Free, public, each row quoted"
        />
        <p className={CAPS}>Thematic fund holdings</p>
        <ul className="mt-2 divide-y divide-subtle">
          {FUNDS.map((f) => {
            const read = funds.find((r) => r.id === f.id);
            return (
              <li key={f.id} className="py-2 text-sm text-fg-secondary wrap-anywhere">
                <a href={read?.url ?? f.url} rel="noreferrer" className={LINK}>
                  {f.name} ({f.ticker})
                </a>{' '}
                · {THEMES.find((t) => t.id === f.theme)!.label}
                {read ? ` · ${read.rows} holdings as of ${read.asOf ?? 'no date'}` : ''}
              </li>
            );
          })}
        </ul>
        <p className={`${CAPS} mt-6`}>SEC industry codes that are theme codes</p>
        <p className="mt-2 text-sm text-fg-secondary">
          {SIC_THEMES.map((s) => `${s.sic} ${s.label}`).join(' · ')}. A filer under one of these
          with a public float over the floor is admitted on its own filings.
        </p>
        <p className={`${CAPS} mt-6`}>Wikidata industry classes</p>
        <p className="mt-2 text-sm text-fg-secondary">
          {WIKIDATA_INDUSTRIES.map((w) => `${w.label} (${w.qid})`).join(' · ')}. Edited by anyone:
          counts for theme and identity, never for size.
        </p>
        <p className={`${CAPS} mt-6`}>Tried and not usable from here</p>
        <ul className="mt-2 divide-y divide-subtle">
          {FUNDS_NOT_READ.map((f) => (
            <li key={f.fund} className="py-2 text-sm text-fg-secondary">
              {f.fund}: {f.why}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
