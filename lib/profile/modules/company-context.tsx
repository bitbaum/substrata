import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { SCARCITY_LABEL } from '@/config/substrata-participants';
import { BLOCKER_LABEL } from '@/config/substrata-substitutes';
import { readinessLabel } from '@/config/substrata-science';
import type { CompanyProfile } from '../../company-profile';
import { hostOf } from '../../desk';
import { bottleneckHref, marketHref, scienceHref } from '../../links';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { CAPS, LINK, NAME, profile } from './company';

/**
 * The company profile's outward-facing sections: relief on what it holds, who
 * else sits at its step, and the sources the page rests on. Read from the same
 * `companyProfile()` as `company.tsx`.
 */

/** Science and substitutes on the chokepoints it holds — not on the company. */
const relief: ProfileModule<CompanyProfile> = {
  id: 'relief',
  title: t('profile.relief.title'),
  appliesTo: ['company'],
  importance: 50,
  load(entity) {
    const p = profile(entity);
    return p && (p.relief.length > 0 || p.substitutes.length > 0) ? p : null;
  },
  evidence: () => 'about its chokepoints, not the company',
  Render({ data: p }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {p.relief.map(({ entry, bottlenecks }) => (
            <li key={entry.id} className="grid grid-cols-[1fr_auto] gap-x-6 py-3">
              <div className="min-w-0">
                <Link href={scienceHref(entry.id)} className={NAME}>
                  {entry.name}
                </Link>
                <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{entry.plain}</p>
                <p className={`mt-1 ${CAPS}`}>
                  Science · for {bottlenecks.map((b) => b.name).join(', ')}
                </p>
              </div>
              <span className="text-right font-mono text-xs tabular-nums text-fg-secondary">
                readiness
                <br />
                <span className="font-heading text-lg font-semibold text-fg-primary">
                  <Figure
                    estimate={{
                      by: 'Substrata',
                      on: entry.judgedOn,
                      basis: `${readinessLabel(entry.readiness)}. ${entry.readinessWhy}`,
                      source: entry.source ?? `${scienceHref(entry.id)}#readiness`,
                    }}
                  >
                    {entry.readiness}
                  </Figure>
                </span>
                /9
              </span>
            </li>
          ))}
          {p.substitutes.map(({ row, bottleneck }) => (
            <li key={`${row.material}:${row.candidate}`} className="py-3">
              <p className="font-medium text-fg-primary">{row.candidate}</p>
              <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
                {row.status}
                {row.blockedBy[0] ? ` · ${BLOCKER_LABEL[row.blockedBy[0]]}` : ''}
              </p>
              <p className={`mt-1 ${CAPS}`}>
                Substitute · for{' '}
                <Link href={bottleneckHref(bottleneck.slug)} className="hover:underline">
                  {bottleneck.name}
                </Link>
                {row.sources[0] && (
                  <>
                    {' · '}
                    <a href={row.sources[0]} rel="noreferrer" className={LINK}>
                      {hostOf(row.sources[0])} ↗
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
        {p.relief.length > 0 && (
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
            Readiness is the 1–9 technology-readiness scale, a dated judgement; open a figure for
            the reasoning and its source.
          </p>
        )}
      </>
    );
  },
};

/** Who else the directory places at the same step, graded. Context, not a market. */
const sameLayer: ProfileModule<CompanyProfile> = {
  id: 'same-layer',
  title: t('profile.sameLayer.title'),
  appliesTo: ['company'],
  importance: 60,
  load(entity) {
    const p = profile(entity);
    return p && p.layerPeers.length > 0 ? p : null;
  },
  evidence: () => 'directory rows · grades are judgements',
  Render({ data: p }) {
    return (
      <ul className="grid gap-x-8 border-t border-subtle sm:grid-cols-2">
        {p.layerPeers.map((peer) => (
          <li
            key={peer.name}
            className="flex items-baseline justify-between gap-4 border-b border-subtle py-2.5"
          >
            <span className="min-w-0">
              <Link href={marketHref(peer.slug)} className={NAME}>
                {peer.name}
              </Link>
              <span className="ml-2 text-sm text-fg-tertiary">{peer.role}</span>
            </span>
            {peer.scarcity && (
              <span className={`shrink-0 ${CAPS}`}>{SCARCITY_LABEL[peer.scarcity]}</span>
            )}
          </li>
        ))}
      </ul>
    );
  },
};

/** Every URL the page rests on, and what each one supports. */
const sources: ProfileModule<CompanyProfile> = {
  id: 'sources',
  title: t('profile.sources.title'),
  appliesTo: ['company'],
  importance: 86,
  load(entity) {
    const p = profile(entity);
    return p && p.sources.length > 0 ? p : null;
  },
  evidence: (p) => `${p.sources.length} cited`,
  Render({ data: p }) {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm marker:font-mono marker:text-fg-muted">
        {p.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} rel="noreferrer" className={LINK}>
              {hostOf(s.url)} ↗
            </a>{' '}
            <span className="text-fg-secondary">— {s.supports}</span>
          </li>
        ))}
      </ol>
    );
  },
};

export { relief, sameLayer, sources };
