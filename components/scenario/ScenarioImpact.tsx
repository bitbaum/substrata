/**
 * Steps three and four: who is exposed, and what the record says about how
 * long relief takes. Every time figure here is a labelled judgement or a
 * sourced quantity; there is no computed recovery date.
 */
import Link from 'next/link';

import { JUDGED_BY } from '@/config/substrata-about';
import { Figure } from '@/components/portal/Figure';
import { Ticker } from '@/components/exposure/Ticker';
import { bottleneckHref, marketHref } from '@/lib/links';
import { EXPOSURE_LABEL, type ExposedCompany } from '@/lib/scenario/exposed';
import type { Recovery } from '@/lib/scenario/recovery';

/** Each of the four assessment tests is scored 0 to 3. */
const LEAD_TIME_MAX = 3;

export function ExposedTable({ rows }: { rows: ExposedCompany[] }) {
  return (
    <div className="xray-wrap">
      <table className="xray-table">
        <thead>
          <tr>
            <th scope="col">Company</th>
            <th scope="col">Listing</th>
            <th scope="col">How it is exposed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name}>
              <td>
                {c.slug ? (
                  <Link href={marketHref(c.slug)} className="xray-strong">
                    {c.name}
                  </Link>
                ) : (
                  <span className="xray-strong">{c.name}</span>
                )}
              </td>
              <td>
                <Ticker listing={c.listing} compact />
              </td>
              <td className="xray-how">
                {c.exposures.map((e) => (
                  <span key={`${e.kind}-${e.bottleneck}`} className={`xray-chip is-${e.kind}`}>
                    {EXPOSURE_LABEL[e.kind]} · {e.bottleneck}
                    {e.evidence && (
                      <>
                        {' '}
                        <a href={e.evidence.source} rel="noopener noreferrer" target="_blank">
                          source
                        </a>
                      </>
                    )}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecoveryList({ rows, country }: { rows: Recovery[]; country: string | null }) {
  return (
    <ul className="scenario-recovery">
      {rows.map((r) => (
        <li key={r.slug}>
          <Link href={bottleneckHref(r.slug)} className="xray-strong">
            {r.bottleneck}
          </Link>
          <dl>
            <dt>Lead-time test</dt>
            <dd>
              <Figure estimate={{ by: JUDGED_BY, on: r.judgedOn, basis: r.rationale }}>
                {`${r.leadTime}/${LEAD_TIME_MAX}`}
              </Figure>{' '}
              — decision to new capacity, a judged score in the assessment
            </dd>
            <dt>Relief time at this stage</dt>
            <dd>
              <Figure
                estimate={{
                  by: r.reliefBasis.by,
                  on: r.reliefBasis.on,
                  basis: r.reliefBasis.basis,
                }}
              >
                {r.reliefTime}
              </Figure>{' '}
              ({r.stageName}, order of magnitude)
            </dd>
            {r.output && country && (
              <>
                <dt>Recorded world output in the failed country</dt>
                <dd>
                  <Figure source={r.output.source} asOf={String(r.output.production.year)}>
                    {`${Math.round(r.output.share * 100)}%`}
                  </Figure>{' '}
                  of {r.output.describes ?? 'recorded output'} (
                  <Link href="/data#method-scenario-output-share">rule</Link>) — so about{' '}
                  <Figure method="scenario-output-share">{`${Math.round((1 - r.output.share) * 100)}%`}</Figure>{' '}
                  of recorded output sits elsewhere
                </dd>
              </>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}
