import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { STAGE_LABEL, UNIT_LABEL, type Endowment } from '@/config/substrata-quantities';
import { BLOCKER_LABEL, substitutesFor, type Substitute } from '@/config/substrata-substitutes';
import {
  concentrationOf,
  endowmentsFor,
  formatQuantity,
  reservesToProduction,
  sharesFor,
  worldTotalFor,
} from '../../quantities';
import { resolveIn } from '../../entities/registry';
import { t } from '../../i18n/messages';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';

function placeName(iso2: string): string {
  return resolveIn('country', iso2)?.name ?? iso2.toUpperCase();
}

interface Figures {
  material: string;
  rows: Endowment[];
  shares: ReturnType<typeof sharesFor>;
  concentration: ReturnType<typeof concentrationOf>;
  total: ReturnType<typeof worldTotalFor>;
}

/**
 * How much, where, and how much is left.
 *
 * The first question a reader asks, and the corpus could not answer it. The bar
 * is a share of the published world total, not a judgement — so unlike the
 * severity score it can be checked against the source, and it is deliberately
 * drawn only where a share is actually known.
 */
const production: ProfileModule<Figures> = {
  id: 'production',
  title: t('profile.production.title'),
  appliesTo: ['bottleneck'],
  importance: 25,
  load(entity: Entity) {
    if (entity.kind !== 'bottleneck') return null;
    const rows = endowmentsFor(entity.key);
    if (rows.length === 0) return null;
    return {
      material: entity.key,
      rows,
      shares: sharesFor(entity.key),
      concentration: concentrationOf(entity.key),
      total: worldTotalFor(entity.key),
    };
  },
  evidence: (figures) =>
    figures.total
      ? `world total ${formatQuantity(figures.total.total, UNIT_LABEL)} (${figures.total.total.year}, ${figures.total.total.basis})`
      : undefined,
  Render({ data }) {
    const { shares, concentration, total, rows } = data;
    return (
      <>
        {rows[0]?.describes && (
          <p className="mb-4 max-w-prose rounded border-l-2 border-status-warning bg-surface-raised px-4 py-2 text-xs leading-relaxed text-fg-tertiary">
            <span className="font-mono uppercase tracking-caps text-fg-muted">
              What these figures count ·{' '}
            </span>
            {rows[0].describes}. Read the stage before the number: this is{' '}
            {STAGE_LABEL[rows[0].stage]} output.
          </p>
        )}
        <ul className="divide-y divide-subtle border-y border-subtle">
          {shares.map((row) => {
            const entry = rows.find((r) => r.place === row.place);
            const rp = reservesToProduction(data.material, row.place);
            return (
              <li key={row.place} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <span className="font-medium text-fg-primary">{placeName(row.place)}</span>
                  <span className="font-mono text-xs tabular-nums text-fg-secondary">
                    {entry ? (
                      <Figure
                        source={entry.source}
                        sourceLabel={quantitySourceLabel(entry.source)}
                        asOf={`${row.production.year}${row.production.basis === 'estimated' ? ', estimated by the source' : ''}`}
                      >
                        {formatQuantity(row.production, UNIT_LABEL)}
                      </Figure>
                    ) : (
                      formatQuantity(row.production, UNIT_LABEL)
                    )}{' '}
                    ({row.production.year}
                    {row.production.basis === 'estimated' ? ', est.' : ''})
                  </span>
                </div>
                {row.share !== undefined && (
                  <div
                    className="mt-1.5 h-1 w-full overflow-hidden rounded bg-border-subtle"
                    role="img"
                    aria-label={`${(row.share * 100).toFixed(1)} per cent of the published world total`}
                  >
                    <div
                      className="h-full bg-fg-primary"
                      style={{ width: `${Math.max(row.share * 100, 0.5)}%` }}
                    />
                  </div>
                )}
                <p className="mt-1 text-xs text-fg-tertiary">
                  {row.share !== undefined && (
                    <>
                      <Figure method="share">{(row.share * 100).toFixed(1)}%</Figure> of{' '}
                      {STAGE_LABEL[entry?.stage ?? 'mine']} world output
                    </>
                  )}
                  {entry?.reserves && (
                    <>
                      {' · reserves '}
                      <Figure
                        source={entry.source}
                        sourceLabel={quantitySourceLabel(entry.source)}
                        asOf={String(entry.reserves.year)}
                      >
                        {formatQuantity(entry.reserves, UNIT_LABEL)}
                      </Figure>
                    </>
                  )}
                  {rp && (
                    <>
                      {' · about '}
                      <Figure method="reserves-to-production">
                        {Math.round(rp.years)} years
                      </Figure>{' '}
                      at this rate
                    </>
                  )}
                </p>
                {entry?.note && (
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-fg-muted">
                    {entry.note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {concentration && (
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-tertiary">
            <span className="font-mono uppercase tracking-caps text-fg-muted">
              Concentration ·{' '}
            </span>
            <Figure method="hhi">{concentration.hhi.toFixed(2)}</Figure> on the Herfindahl index
            across {concentration.from} recorded producers, where 1.00 is a single supplier. This is
            arithmetic from the figures above, not the judgement shown under severity — the two are
            worth comparing.
          </p>
        )}
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-fg-muted">
          {total?.caveat} Figures are {rows[0]?.readOn ? `read ${rows[0].readOn} from ` : 'from '}
          <a
            href={rows[0]?.source}
            rel="noreferrer"
            className="text-accent underline-offset-4 hover:underline"
          >
            the source ↗
          </a>
          . Reserves are not resources: what is economic to extract, not what exists.
        </p>
      </>
    );
  },
};

/** The corpus's figures come from USGS MCS; anything else is named by its host. */
function quantitySourceLabel(url: string): string | undefined {
  const edition = url.match(/usgs\.gov\/periodicals\/mcs(\d{4})/);
  return edition ? `USGS Mineral Commodity Summaries ${edition[1]}` : undefined;
}

/**
 * Whether an alternative exists, and whether that helps.
 *
 * Progressive disclosure: the blocker is the headline, because it is the thing
 * that decides whether relief is a schedule or an impossibility. The reasoning
 * sits underneath it.
 */
const substitutes: ProfileModule<Substitute[]> = {
  id: 'substitutes',
  title: t('profile.substitutes.title'),
  appliesTo: ['bottleneck'],
  importance: 55,
  load(entity: Entity) {
    if (entity.kind !== 'bottleneck') return null;
    const rows = substitutesFor(entity.key);
    return rows.length > 0 ? rows : null;
  },
  evidence: (rows) =>
    rows.some((row) => row.blockedBy[0] === 'physics')
      ? 'one of these is a law, not a schedule'
      : `${rows.length} recorded`,
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.map((row) => (
            <li key={row.candidate} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <span className="font-medium text-fg-primary">{row.candidate}</span>
                <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                  {row.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-fg-tertiary">
                {row.blockedBy.map((blocker) => BLOCKER_LABEL[blocker]).join(' · ')}
              </p>
              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-fg-secondary">
                {row.why}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                {row.sources.map((source, index) => (
                  <a
                    key={source}
                    href={source}
                    rel="noreferrer"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    Source {row.sources.length > 1 ? index + 1 : ''} ↗
                  </a>
                ))}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          An alternative existing is not the same as it being available.{' '}
          <Link href="/learn" className="text-accent underline-offset-4 hover:underline">
            Physics is a law; qualification and capacity are schedules
          </Link>{' '}
          — and only one of those can be changed with money.
        </p>
      </>
    );
  },
};

export { production, substitutes };
