import { Figure } from '@/components/portal/Figure';
import type { AskLatency as Report } from '@/lib/ask-timing';

/**
 * How long Ask kept readers waiting over the last day, as p50/p90 — so "the
 * assistant is slow" is a number anyone can check, and a regression shows.
 */
export function AskLatency({ report }: { report: Report | null }) {
  if (!report)
    return (
      <p>
        Ask&apos;s timing log could not be read just now. That is a failure to measure, not a report
        of speed.
      </p>
    );
  if (report.answered === 0)
    return (
      <p>
        No Ask question was answered in the last day
        {report.questions ? ` (${report.questions} asked, none answered)` : ''}, so there is no
        latency to report.
      </p>
    );
  const s = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);
  return (
    <p>
      Over the last day, <Figure method="ask-latency">{report.answered}</Figure> questions were
      answered{report.questions > report.answered ? ` (of ${report.questions} asked)` : ''}. The
      first words appeared after <Figure method="ask-latency">{s(report.firstP50)}</Figure> at the
      median and <Figure method="ask-latency">{s(report.firstP90)}</Figure> for the slowest tenth;
      the whole answer took <Figure method="ask-latency">{s(report.totalP50)}</Figure> and{' '}
      <Figure method="ask-latency">{s(report.totalP90)}</Figure>.{' '}
      <Figure method="ask-latency">{report.oneCall}</Figure> needed a single model call.
    </p>
  );
}
