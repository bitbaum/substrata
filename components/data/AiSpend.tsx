import { Figure } from '@/components/portal/Figure';
import type { SpendDay } from '@/lib/ai-budget';

/**
 * Who spent today's free AI budget: readers asking, or scheduled jobs. Shown
 * because "the assistant is out of budget" should never be a mystery, and
 * because the rule that keeps jobs off the readers' share is only credible if
 * its effect is visible.
 */
export function AiSpend({ report }: { report: { capacity: number; days: SpendDay[] } | null }) {
  if (!report)
    return (
      <p>
        The AI spend ledger could not be read just now. That is a failure to measure, not a report
        of zero.
      </p>
    );
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  const today = report.days[0];
  return (
    <>
      <p>
        The free daily AI budget is spent only by readers asking questions (Ask and fact-checks). No
        scheduled job uses it any more: drafting news into events runs only on a reader’s own AI
        key. The background column shows the days before that.{' '}
        {today ? (
          <>
            On {today.day} (UTC), readers used{' '}
            <Figure method="ai-spend">{k(today.interactive)}</Figure> tokens and background jobs{' '}
            <Figure method="ai-spend">{k(today.background)}</Figure>, against an estimated capacity
            of <Figure method="ai-spend">{k(report.capacity)}</Figure>
            {today.held > 0 ? (
              <>
                ; <Figure method="ai-spend">{today.held}</Figure> background call
                {today.held === 1 ? ' was' : 's were'} held back to protect readers
              </>
            ) : null}
            .
          </>
        ) : (
          'Nothing has been spent in the last week that this ledger recorded.'
        )}
      </p>
      {report.days.length > 1 && (
        <ul>
          {report.days.slice(1).map((d) => (
            <li key={d.day}>
              {d.day}: readers <Figure method="ai-spend">{k(d.interactive)}</Figure>, background{' '}
              <Figure method="ai-spend">{k(d.background)}</Figure>, held{' '}
              <Figure method="ai-spend">{d.held}</Figure>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
