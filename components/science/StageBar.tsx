import Link from 'next/link';

import { PIPELINE_STAGES } from '@/config/substrata-pipeline';
import { Figure } from '@/components/portal/Figure';
import type { StageCell } from '@/lib/science-pipeline';
import { pipelineHref } from '@/lib/links';

/** Established: a collected item or a cited judgement. Claimed: only an uncited judgement. */
export function cellStatus(cell: StageCell): 'established' | 'claimed' | 'empty' {
  if (cell.items > 0 || cell.judgements.some((j) => j.source)) return 'established';
  return cell.judgements.length > 0 ? 'claimed' : 'empty';
}

const STATUS_NOTE = {
  established: 'evidence attached',
  claimed: 'claimed — a judgement with no citation',
  empty: 'nothing found',
} as const;

/**
 * Five cells, research to scale, each a link to that stage's rows. The count
 * is items the feeds collected; the dots are hand-written judgements, so the
 * two kinds of evidence are never added into one number.
 */
export function StageBar({ bottleneck, cells }: { bottleneck: string; cells: StageCell[] }) {
  return (
    <ol className="pipe-bar" aria-label={`Science pipeline for ${bottleneck}`}>
      {cells.map((cell) => {
        const stage = PIPELINE_STAGES.find((s) => s.id === cell.stage)!;
        const status = cellStatus(cell);
        return (
          <li key={cell.stage} className={`pipe-cell pipe-${status}`}>
            <Link
              href={pipelineHref(bottleneck, cell.stage)}
              className="pipe-cell-link"
              title={`${stage.label} (readiness ${stage.trl.join('–')}): ${STATUS_NOTE[status]}`}
            >
              <span className="pipe-cell-label">{stage.short}</span>
              <span className="pipe-cell-count">
                <Figure method="science-pipeline" inLink>
                  {cell.items}
                </Figure>
              </span>
              <span className="pipe-cell-judged">
                {cell.judgements.map((j) => (
                  <span
                    key={j.name}
                    className={j.source ? 'pipe-dot' : 'pipe-dot pipe-dot-claimed'}
                    aria-hidden
                  />
                ))}
                {cell.fresh > 0 && (
                  <span className="pipe-fresh">
                    +
                    <Figure method="science-new" inLink>
                      {cell.fresh}
                    </Figure>{' '}
                    new
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function StageLegend() {
  return (
    <p className="pipe-legend">
      <span>
        <span className="pipe-dot" aria-hidden /> judged, with a citation
      </span>
      <span>
        <span className="pipe-dot pipe-dot-claimed" aria-hidden /> claimed, no citation
      </span>
      <span>Number: papers, preprints and grants the feeds collected — unreviewed</span>
    </p>
  );
}
