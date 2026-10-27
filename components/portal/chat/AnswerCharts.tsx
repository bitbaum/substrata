'use client';

import { isAnswerChart, type AnswerChart } from '@/lib/chat/answer-chart';
import { renderChart } from './chartRenderers';

/**
 * The charts an answer carries (lib/chat/answer-chart.ts) — a price line, a
 * holders' share bar — drawn under its prose by the same chartkit figures as
 * every other chart on the site, each with its source and what to know to
 * read it, and a link to the company page the figures belong on. Built in
 * code from tool rows; a malformed one is not drawn.
 */
export function AnswerCharts({ charts }: { charts: AnswerChart[] }) {
  return (
    <>
      {charts.filter(isAnswerChart).map((c) => (
        <figure key={c.id} className="answer-chart">
          {renderChart(c.block, c.otherLabel)}
          <figcaption className="answer-chart-source">
            {c.note} Source:{' '}
            <a href={c.source.url} rel="noreferrer" target="_blank">
              {c.source.label}
            </a>
          </figcaption>
          {c.page && (
            <a className="answer-chart-open" href={c.page.href}>
              {c.page.label} →
            </a>
          )}
        </figure>
      ))}
    </>
  );
}
