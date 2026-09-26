import { Figure } from '@/components/portal/Figure';
import { CRITERION_LABEL } from '@/config/substrata-quality';
import type { DatasetCard } from '@/lib/quality/report';
import { CRITERIA } from '@/lib/quality/types';

export const pctText = (n: number | null) =>
  n === null ? '—' : `${n.toFixed(n === 100 ? 0 : 1)}%`;

/** A score's band, for its colour: the same three bands as the freshness dots. */
export function band(score: number | null): 'good' | 'fair' | 'poor' | 'none' {
  if (score === null) return 'none';
  if (score >= 98) return 'good';
  if (score >= 90) return 'fair';
  return 'poor';
}

/** Every dataset against every criterion, one screen. */
export function ScoreTable({ cards }: { cards: DatasetCard[] }) {
  return (
    <table className="fresh-table quality-table">
      <thead>
        <tr>
          <th scope="col">Dataset</th>
          <th scope="col">Score</th>
          {CRITERIA.map((c) => (
            <th scope="col" key={c}>
              {CRITERION_LABEL[c].label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <tr key={card.dataset.id}>
            <th scope="row">
              <a className="fresh-name" href={`#q-${card.dataset.id}`}>
                {card.dataset.label}
              </a>
            </th>
            <td data-label="Score" className={`fresh-num quality-cell is-${band(card.overall)}`}>
              <Figure method="quality-overall">{pctText(card.overall)}</Figure>
            </td>
            {card.scores.map((s) => {
              const rule = card.dataset.criteria[s.criterion];
              return (
                <td
                  key={s.criterion}
                  data-label={CRITERION_LABEL[s.criterion].label}
                  className={`fresh-num quality-cell is-${band(s.score)}`}
                  title={typeof rule === 'string' ? rule : `Not measured: ${rule.na}`}
                >
                  {s.score === null ? (
                    <span className="quality-na">
                      {typeof rule === 'string' ? 'not yet looked at' : 'not measured'}
                    </span>
                  ) : (
                    <Figure
                      method="quality-score"
                      detail={`${s.passed} of ${s.checked} rows held.`}
                    >
                      {pctText(s.score)}
                    </Figure>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
