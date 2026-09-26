import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { CRITERION_LABEL } from '@/config/substrata-quality';
import { codeHref } from '@/lib/methods';
import type { DatasetCard } from '@/lib/quality/report';
import type { RunRecord } from '@/lib/quality/store';
import { FailureList } from './FailureList';
import { band, pctText } from './ScoreTable';
import { Trend } from './Trend';

const isTable = (file: string) => !file.includes('/');

/** One dataset: its counts, its written criteria with their scores, its trend, and every failing row. */
export function DatasetSection({ card, runs }: { card: DatasetCard; runs: RunRecord[] | null }) {
  const { dataset, counts } = card;
  const network = card.results.filter((r) => r.kind === 'network');
  return (
    <section id={`q-${dataset.id}`} className="quality-dataset">
      <header>
        <h3>
          {dataset.label}{' '}
          <span className={`quality-score is-${band(card.overall)}`}>
            <Figure method="quality-overall">{pctText(card.overall)}</Figure>
          </span>
        </h3>
        <p className="fresh-what">
          {dataset.files.map((f, i) => (
            <span key={f}>
              {i > 0 && ' · '}
              {isTable(f) ? (
                <code className="fresh-code">{f}</code>
              ) : (
                <a href={codeHref(f)} rel="noopener noreferrer">
                  {f}
                </a>
              )}
            </span>
          ))}{' '}
          · shown on <Link href={dataset.page}>{dataset.page}</Link>
        </p>
      </header>
      <p className="quality-counts">
        <Figure method="quality-counts">{String(counts.rows)}</Figure> rows ·{' '}
        <Figure method="quality-counts">{pctText(counts.sourcedPct)}</Figure> sourced ·{' '}
        {counts.verifiedOf > 0 ? (
          <>
            <Figure method="quality-counts">{pctText(counts.verifiedPct)}</Figure> of{' '}
            <Figure method="quality-counts">{String(counts.verifiedOf)}</Figure> re-verified at
            source ·{' '}
          </>
        ) : null}
        <Figure method="quality-counts">{pctText(counts.stalePct)}</Figure> stale ·{' '}
        <Figure method="quality-counts">{String(counts.brokenLinks)}</Figure> broken links
        {counts.blockedLinks > 0 && (
          <>
            {' '}
            (<Figure method="quality-counts">{String(counts.blockedLinks)}</Figure> refused robots)
          </>
        )}
        {counts.uncheckedLinks > 0 && (
          <>
            {' '}
            · <Figure method="quality-counts">{String(counts.uncheckedLinks)}</Figure> links not yet
            looked at
          </>
        )}
      </p>
      <dl className="quality-criteria">
        {card.scores.map((s) => {
          const rule = dataset.criteria[s.criterion];
          return (
            <div key={s.criterion}>
              <dt>
                {CRITERION_LABEL[s.criterion].label}{' '}
                <span className={`quality-score is-${band(s.score)}`}>
                  {s.score === null ? (
                    '—'
                  ) : (
                    <Figure
                      method="quality-score"
                      detail={`${s.passed} of ${s.checked} rows held.`}
                    >
                      {pctText(s.score)}
                    </Figure>
                  )}
                </span>
              </dt>
              <dd>{typeof rule === 'string' ? rule : <>Not measured: {rule.na}</>}</dd>
            </div>
          );
        })}
      </dl>
      <Trend runs={runs} dataset={dataset.id} />
      {network.some((r) => r.asOf) && (
        <p className="quality-note">
          Network looks are a rotation: the oldest verdict here is from{' '}
          {network
            .map((r) => r.asOf)
            .filter(Boolean)
            .sort()[0]
            ?.slice(0, 10)}
          .
        </p>
      )}
      {card.results.map((r) => (
        <FailureList key={r.check} label={dataset.label} result={r} />
      ))}
    </section>
  );
}
