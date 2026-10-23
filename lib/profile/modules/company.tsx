import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { Status } from '@/components/portal/Status';
import { Meter } from '@/components/charts';
import { HORIZON_LABEL } from '@/config/substrata-assessment';
import {
  bindingSum,
  companyProfile,
  type CompanyProfile,
  type Counterpart,
} from '../../company-profile';
import { hostOf } from '../../desk';
import { bottleneckHref, marketHref } from '../../links';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

// What it holds. What has happened to it is `company-happened.tsx`; what
// bears on it from outside — relief, peers at the same step, sources — is
// `company-context.tsx`; who owns it `ownership.tsx`; its numbers `numbers.tsx`.

/**
 * The company profile's sections, all read from `companyProfile()` so they
 * cannot disagree with the header or with each other.
 *
 * Each returns null when it has nothing to say, and then leaves no trace: the
 * page used to print "No covered material is mapped" and "No relevant science
 * entries are mapped yet" under headings, which told a reader nothing and made
 * a well-joined company look broken.
 */
export function profile(entity: Entity): CompanyProfile | undefined {
  return entity.kind === 'company' ? companyProfile(entity.key) : undefined;
}

export const LINK = 'text-accent underline-offset-4 hover:underline';
export const NAME = 'link-target font-medium text-fg-primary underline-offset-4 hover:underline';
export const CAPS = 'font-mono text-xs uppercase tracking-caps text-fg-tertiary';

/**
 * A binding score is a judgement, so it renders as an estimate: whose, when,
 * the four-part sum and the rationale, with the assessment one click away.
 * Drawn as the same meter the front page's "worst right now" rows use.
 */
export function BindingMeter({
  held,
  inLink = false,
}: {
  held: CompanyProfile['held'][number];
  inLink?: boolean;
}) {
  const b = held.bottleneck;
  return (
    <Meter value={b.binding} max={12} label={`${b.name}, binding score`}>
      <Figure
        inLink={inLink}
        estimate={{
          by: 'Substrata',
          on: b.judgedOn,
          basis: `${bindingSum(b)}. ${b.rationale}`,
          source: `${bottleneckHref(b.slug)}#severity`,
        }}
      >
        {b.binding}
      </Figure>
    </Meter>
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
        {/* The front page's row: name and meter on one line, the plain sentence
            and the evidence word on the next, the meter in one x on every row. */}
        <ol className="board-rows">
          {p.held.map((h) => (
            <li key={h.bottleneck.slug} className="board-row">
              <Link href={bottleneckHref(h.bottleneck.slug)} className="board-row-name link-target">
                {h.bottleneck.name}
              </Link>
              <div className="board-row-meter">
                <BindingMeter held={h} />
              </div>
              <div className="board-row-plain">
                <p className={CAPS}>
                  {h.step} · {HORIZON_LABEL[h.bottleneck.horizon]}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
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
              </div>
              <div className="board-row-status">
                {h.source ? (
                  <a href={h.source} rel="noreferrer" className="link-target text-xs">
                    <Status state="sourced" compact label={`${hostOf(h.source)} ↗`} />
                  </a>
                ) : (
                  <Status state={h.verification} compact />
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="board-note">
          Score = concentration + substitution + lead time + inelasticity, each 0–3 · an analyst
          judgement dated {judged} · makers are those the corpus records, not the whole market
        </p>
      </>
    );
  },
};

export { chokepoints };
