import Link from 'next/link';

import { PIPELINE_STAGE_LABEL } from '@/config/substrata-pipeline';
import { ReadinessFigure } from '@/components/portal/Status';
import type { Judgement } from '@/lib/science-pipeline';

/**
 * Hand-written placements: a science entry's readiness or a substitute's
 * status. Each says it is a judgement; one without a citation says it is
 * only claimed.
 */
export function JudgementList({ judgements }: { judgements: Judgement[] }) {
  return (
    <ul className="sci-list">
      {judgements.map((j) => (
        <li key={`${j.what}-${j.name}`} className="sci-item">
          <p className="sci-meta">
            <span className="sci-kind">
              {j.what === 'technology' ? 'Technology' : 'Substitute'}
            </span>
            <span>{PIPELINE_STAGE_LABEL[j.stage]}</span>
            {j.readiness !== null && (
              <span>
                readiness{' '}
                <ReadinessFigure
                  entry={{
                    readiness: j.readiness,
                    readinessWhy: j.basis,
                    judgedOn: j.judgedOn,
                    source: j.source,
                  }}
                />
              </span>
            )}
            <span className={j.source ? 'sci-judged' : 'sci-claimed'}>
              {j.source
                ? `Judgement, cited · ${j.judgedOn}`
                : `Claimed, no citation · ${j.judgedOn}`}
            </span>
          </p>
          {j.href ? (
            <Link href={j.href} className="sci-title">
              {j.name}
            </Link>
          ) : (
            <span className="sci-title">{j.name}</span>
          )}
          <p className="sci-abstract">{j.basis}</p>
          {j.source && (
            <p className="sci-foot">
              <a href={j.source} target="_blank" rel="noopener noreferrer">
                Source ↗
              </a>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
