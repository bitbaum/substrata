import Link from 'next/link';

import { BarChart } from '@bitbaum/chartkit/react';
import { Figure } from '@/components/portal/Figure';
import { CHAIN_LAYERS, SCARCITY_LABEL } from '@/config/substrata-participants';
import { marketHref } from '../../links';
import { formatShare, ordinal } from '../../resources/format';
import { countryProfile, type CountryProfile } from '../../world/profile';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

// What a country produces and who operates there. The rules it sets, the
// exports it restricts and what has happened are in `country-rules.tsx`.

export function profile(entity: Entity): CountryProfile | undefined {
  return entity.kind === 'country' ? (countryProfile(entity.key) ?? undefined) : undefined;
}

const SHOWN = 12;

/**
 * What it produces: every resource a USGS or EIA table lists the country
 * for, as bars of its share of world output, largest first, each linking to
 * the resource's own ranking. Resources with no computable share (a "more
 * than" world total) are listed under the chart rather than drawn at zero.
 */
const produces: ProfileModule<CountryProfile> = {
  id: 'produces',
  title: t('profile.produces.title'),
  appliesTo: ['country'],
  importance: 10,
  load(entity) {
    const p = profile(entity);
    return p && (p.produces.length > 0 || p.unmeasured.length > 0) ? p : null;
  },
  evidence: (p) =>
    p.produces.length > 0
      ? `${p.produces.length} table${p.produces.length === 1 ? '' : 's'}, USGS, EIA and WNA`
      : 'directory only',
  Render({ data: p }) {
    // The chart draws what the country matters for; small shares (under 1%,
    // or outside the top ten) are a line under it, after the directory's own
    // named resources. Niger's page led with oil at 0.1% while the directory
    // said uranium, before uranium had a table and before this rule.
    const shared = p.produces.filter((r) => r.share !== null && r.significant).slice(0, SHOWN);
    const unshared = p.produces.filter((r) => r.share === null && r.significant);
    const small = p.produces.filter((r) => !r.significant);
    const rest = p.produces.filter((r) => r.share !== null && r.significant).length - shared.length;
    return (
      <>
        {shared.length === 0 && (p.unmeasured.length > 0 || p.why) && (
          <p className="place-note">
            {p.unmeasured.length > 0 && (
              <>
                Named in the directory for{' '}
                {p.unmeasured
                  .map((u) => u.label)
                  .join(', ')
                  .toLowerCase()}
                , with no production table listing this country.{' '}
              </>
            )}
            {p.why && (
              <>
                <span className="font-mono text-xs uppercase tracking-caps">
                  Directory note, not a finding ·{' '}
                </span>
                {p.why}
              </>
            )}
          </p>
        )}
        {shared.length > 0 && (
          <div className="place-chart place-chart-pct">
            <BarChart
              rows={shared.map((r) => ({
                label: `${r.label} · ${ordinal(r.rank)}`,
                value: Math.round((r.share as number) * 1000) / 10,
                href: `/resources/${r.resource}`,
                note: `${ordinal(r.rank)} in the world, ${r.seriesLabel.toLowerCase()}, ${r.year}`,
              }))}
              unit="% of world"
              max={100}
              highlight={shared[0] ? `${shared[0].label} · ${ordinal(shared[0].rank)}` : undefined}
              caption={`Share of world output on the country’s leading production series for each resource, each bar drawn against the whole world, computed from the USGS, EIA and WNA tables; the rank beside each name is among countries the table lists individually.${rest > 0 ? ` ${rest} more with a smaller share are on the resource pages.` : ''}`}
            />
          </div>
        )}
        {unshared.length > 0 && (
          <p className="place-note">
            Listed with no computable share (the world total is printed as “more than”):{' '}
            {unshared.map((r, i) => (
              <span key={r.resource}>
                {i > 0 && ', '}
                <Link href={`/resources/${r.resource}`} className="underline underline-offset-2">
                  {r.label}
                </Link>{' '}
                <Figure method="world-rank" inLink>
                  {ordinal(r.rank)}
                </Figure>
              </span>
            ))}
            .
          </p>
        )}
        {shared.length > 0 && p.unmeasured.length > 0 && (
          <p className="place-note">
            Also named in the directory, with no production table listing this country:{' '}
            {p.unmeasured.map((u) => u.label).join(', ')}.
          </p>
        )}
        {small.length > 0 && (
          <p className="place-note">
            Also produces, small shares:{' '}
            {small.map((r, i) => (
              <span key={r.resource}>
                {i > 0 && ', '}
                <Link href={`/resources/${r.resource}`} className="underline underline-offset-2">
                  {r.label.toLowerCase()}
                </Link>{' '}
                <span className="whitespace-nowrap">
                  {r.share !== null ? `${formatShare(r.share)} · ` : ''}
                  <Figure method="world-rank" inLink>
                    {ordinal(r.rank)}
                  </Figure>
                </span>
              </span>
            ))}
            .
          </p>
        )}
      </>
    );
  },
};

const LAYER_NAME = Object.fromEntries(CHAIN_LAYERS.map((l) => [l.id, l.name]));

/** Companies that operate here, chokepoints first, the grade on the right. */
const companies: ProfileModule<CountryProfile> = {
  id: 'companies',
  title: t('profile.companies.title'),
  appliesTo: ['country'],
  importance: 30,
  load(entity) {
    const p = profile(entity);
    return p && p.companies.length > 0 ? p : null;
  },
  evidence: (p) =>
    `${p.companies.filter((c) => c.hasVerifiedRow || c.directorySource).length} of ${p.companies.length} sourced`,
  Render({ data: p }) {
    return (
      <>
        <ul className="place-rows">
          {p.companies.map((c) => (
            <li key={c.slug} className="place-row">
              <Link href={marketHref(c.slug)} className="place-row-name">
                {c.name}
              </Link>
              <p className="place-row-detail">
                {LAYER_NAME[c.layer] ?? c.layer}
                {c.role ? ` · ${c.role}` : ''}
              </p>
              <span className="place-row-aside">
                {c.scarcity ? SCARCITY_LABEL[c.scarcity] : 'ungraded'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          The grade is the directory’s judgement of how replaceable the company is at its step of
          the chain, not a market share. Companies are those the corpus records, not every firm in
          the country.
        </p>
      </>
    );
  },
};

export { produces, companies };
