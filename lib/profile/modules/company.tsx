import Link from 'next/link';

import { EventList } from '@/components/portal/EventList';
import { Status } from '@/components/portal/Status';
import { HORIZON_LABEL } from '@/config/substrata-assessment';
import { SCARCITY_LABEL } from '@/config/substrata-participants';
import { BLOCKER_LABEL } from '@/config/substrata-substitutes';
import { readinessLabel } from '@/config/substrata-science';
import {
  bindingSum,
  companyProfile,
  type CompanyProfile,
  type Counterpart,
} from '../../company-profile';
import { hostOf } from '../../desk';
import { bottleneckHref, marketHref, scienceHref } from '../../links';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

/**
 * The company profile's sections, all read from `companyProfile()` so they
 * cannot disagree with the header or with each other.
 *
 * Each returns null when it has nothing to say, and then leaves no trace: the
 * page used to print "No covered material is mapped" and "No relevant science
 * entries are mapped yet" under headings, which told a reader nothing and made
 * a well-joined company look broken.
 */
function profile(entity: Entity): CompanyProfile | undefined {
  return entity.kind === 'company' ? companyProfile(entity.key) : undefined;
}

const LINK = 'text-accent underline-offset-4 hover:underline';
const NAME = 'font-medium text-fg-primary underline-offset-4 hover:underline';
const CAPS = 'font-mono text-xs uppercase tracking-caps text-fg-tertiary';

/** A binding score that links to the assessment it is the sum of. */
export function BindingLink({ held }: { held: CompanyProfile['held'][number] }) {
  const b = held.bottleneck;
  const s = b.score;
  return (
    <Link
      href={`${bottleneckHref(b.slug)}#severity`}
      title={`${bindingSum(b)}. Judged ${b.judgedOn}.`}
      className="group inline-flex flex-col items-end text-right"
    >
      <span className="font-heading text-2xl font-semibold tabular-nums text-fg-primary group-hover:text-accent">
        {b.binding}
        <span className="text-sm font-normal text-fg-muted">/12</span>
      </span>
      <span className="font-mono text-xs tabular-nums text-fg-tertiary group-hover:underline">
        {s.concentration}+{s.substitution}+{s.leadTime}+{s.inelasticity}
      </span>
    </Link>
  );
}

/** Organisations, each linked to its page, with where they operate. */
function Names({ rows }: { rows: Counterpart[] }) {
  return (
    <>
      {rows.map((c, i) => (
        <span key={c.name}>
          {i > 0 && ', '}
          {c.slug ? (
            <Link
              href={marketHref(c.slug)}
              className="text-fg-primary underline-offset-4 hover:underline"
            >
              {c.name}
            </Link>
          ) : (
            c.name
          )}
          {c.jurisdictions.length > 0 && (
            <span className="font-mono text-xs text-fg-muted"> {c.jurisdictions.join(' ')}</span>
          )}
        </span>
      ))}
    </>
  );
}

const chokepoints: ProfileModule<CompanyProfile> = {
  id: 'chokepoints',
  title: t('profile.chokepoints.title'),
  appliesTo: ['company'],
  importance: 10,
  load(entity) {
    const p = profile(entity);
    return p && p.held.length > 0 ? p : null;
  },
  evidence: (p) =>
    `${p.held.filter((h) => h.verification === 'sourced').length} of ${p.held.length} sourced`,
  Render({ data: p }) {
    const judged = [...new Set(p.held.map((h) => h.bottleneck.judgedOn))].join(', ');
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {p.held.map((h) => (
            <li key={h.bottleneck.slug} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 py-4">
              <div className="min-w-0">
                <Link href={bottleneckHref(h.bottleneck.slug)} className={NAME}>
                  {h.bottleneck.name}
                </Link>
                <p className={`mt-1 ${CAPS}`}>
                  {h.step} · {HORIZON_LABEL[h.bottleneck.horizon]}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                  {h.soleRecorded ? (
                    <span className="font-medium text-fg-primary">No other maker recorded.</span>
                  ) : (
                    <>
                      <span className="text-fg-tertiary">
                        {h.supplier ? 'Supplies into ' : 'Other makers: '}
                      </span>
                      <Names rows={h.counterparts} />
                    </>
                  )}
                </p>
                {h.suppliers.length > 0 && (
                  <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
                    <span className="text-fg-tertiary">Critical parts from </span>
                    <Names rows={h.suppliers} />
                  </p>
                )}
                <p className="mt-1 text-xs">
                  {h.source ? (
                    <a href={h.source} rel="noreferrer" className={LINK}>
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-status-positive align-middle"
                      />
                      Sourced: {hostOf(h.source)} ↗
                    </a>
                  ) : (
                    <Status
                      state={h.verification}
                      label={
                        h.candidateCount > 0
                          ? `${h.candidateCount} source${h.candidateCount > 1 ? 's' : ''} found, unchecked`
                          : undefined
                      }
                    />
                  )}
                </p>
              </div>
              <BindingLink held={h} />
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          Score = concentration + substitution + lead time + inelasticity, each 0–3, an analyst
          judgement dated {judged}; click one for its assessment. Makers are those the corpus
          records, not the whole market. No market-share figure is sourced, so none is shown.
        </p>
      </>
    );
  },
};

const companyEvents: ProfileModule<CompanyProfile> = {
  id: 'events',
  title: t('profile.companyEvents.title'),
  appliesTo: ['company'],
  importance: 40,
  load(entity) {
    const p = profile(entity);
    return p && (p.events.length > 0 || p.relatedEvents.length > 0) ? p : null;
  },
  evidence: (p) =>
    [
      p.events.length > 0 ? `${p.events.length} name it` : '',
      p.relatedEvents.length > 0 ? `${p.relatedEvents.length} about what it holds` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  Render({ data: p }) {
    const related = p.relatedEvents.slice(0, 6);
    return (
      <>
        {p.events.length > 0 && <EventList events={p.events} showBottlenecks />}
        {related.length > 0 && (
          <>
            <h3 className={`${p.events.length > 0 ? 'mt-8' : ''} mb-2 ${CAPS}`}>
              About what it holds, not naming {p.participant.name}
            </h3>
            <ul className="divide-y divide-subtle border-y border-subtle">
              {related.map(({ event, through }) => (
                <li key={event.id} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                      {event.date}
                    </span>
                    <Link
                      href={bottleneckHref(through.slug)}
                      className={`${CAPS} underline-offset-4 hover:text-fg-primary hover:underline`}
                    >
                      {through.name}
                    </Link>
                  </div>
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-primary">
                    {event.headline}{' '}
                    <a href={event.source} rel="noreferrer" className={`text-xs ${LINK}`}>
                      {hostOf(event.source)} ↗
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-sm">
          <Link href="/events" className={LINK}>
            {t('action.allEvents')}
          </Link>
        </p>
      </>
    );
  },
};

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
              <Link
                href={`${scienceHref(entry.id)}#readiness`}
                title={`Readiness ${entry.readiness} of 9 (${readinessLabel(entry.readiness)}), judged ${entry.judgedOn}. ${entry.source ? 'Sourced.' : 'Unsourced judgement.'}`}
                className="text-right font-mono text-xs tabular-nums text-fg-secondary underline-offset-4 hover:underline"
              >
                readiness
                <br />
                <span className="font-heading text-lg font-semibold text-fg-primary">
                  {entry.readiness}
                </span>
                /9
              </Link>
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
            Readiness is the 1–9 technology-readiness scale, a dated judgement; click it for the
            reasoning and its source.
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

export { chokepoints, companyEvents, relief, sameLayer, sources };
