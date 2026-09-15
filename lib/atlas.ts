import { BOTTLENECKS } from './bottlenecks';
import { STAGES } from '@/config/substrata-stages';

/** Association map. Membership edges do not claim supplier/customer relationships. */
export function atlasData(topic = '') {
  const rows = BOTTLENECKS.filter((b) => !topic || b.technologies.some((t) => t === topic));
  return STAGES.map((stage) => ({
    ...stage,
    rows: rows.filter((b) => b.stage === stage.id),
    total: rows.filter((b) => b.stage === stage.id).length,
    sourced: rows.filter((b) => b.stage === stage.id && b.state === 'sourced').length,
  }));
}

export function evidenceTotals() {
  const rows = BOTTLENECKS.flatMap((b) => b.producers.map((p) => ({ ...p, bottleneck: b.name })));
  return {
    producerRows: rows.length,
    sourced: rows.filter((p) => p.verification === 'sourced').length,
    candidate: rows.filter((p) => p.verification === 'candidate').length,
    unverified: rows.filter((p) => p.verification === 'unverified').length,
    assessments: BOTTLENECKS.length,
    latestAssessment:
      BOTTLENECKS.map((b) => b.judgedOn)
        .sort()
        .at(-1) ?? null,
  };
}
