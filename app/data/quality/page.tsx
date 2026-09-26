import Link from 'next/link';
import type { Metadata } from 'next';

import { Heading, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { Figure } from '@/components/portal/Figure';
import { DatasetSection } from '@/components/quality/DatasetSection';
import { ScoreTable, pctText } from '@/components/quality/ScoreTable';
import { codeHref, methodHref } from '@/lib/methods';
import { qualityReport } from '@/lib/quality/report';
import { correctionUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Data quality',
  description:
    'Every dataset behind the site, scored against written criteria — completeness, correctness, provenance, freshness, link health, consistency — with every failing row and its source.',
};

export default async function QualityPage() {
  const report = await qualityReport();
  const failing = report.cards.reduce(
    (n, c) => n + c.results.reduce((m, r) => m + r.failures.length, 0),
    0,
  );
  const scored = report.cards.filter((c) => c.overall !== null);
  const lowest = [...scored].sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0))[0];
  return (
    <Shell>
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/data">Data</Link> / Quality
            </>
          }
          title="Is the data correct and complete?"
          status={
            <>
              <Figure method="quality-score">{String(report.cards.length)}</Figure> datasets ·{' '}
              <Figure method="quality-score">{String(failing)}</Figure> failing rows
              {lowest && (
                <>
                  {' '}
                  · weakest: {lowest.dataset.label} at{' '}
                  <Figure method="quality-overall">{pctText(lowest.overall)}</Figure>
                </>
              )}{' '}
              · measured {report.checkedAt.slice(11, 16)} UTC
            </>
          }
          note={
            <>
              Each dataset is held to six written criteria (
              <a href={codeHref('config/substrata-quality.ts')} rel="noopener noreferrer">
                config/substrata-quality.ts
              </a>
              ) and scored by <Link href={methodHref('quality-score')}>one published rule</Link>.
              Checks on the committed files run in every build; checks against live sources — links,
              quotes, tickers, USGS tables — run every six hours on a rotation. No AI is used in
              either. Every failing row below links its source and a way to report it.
            </>
          }
          actions={<a href={correctionUrl('a dataset on /data/quality')}>Report an error →</a>}
        />

        {report.unreadable.length > 0 && (
          <p className="fresh-attention" role="status">
            Could not be read just now: {report.unreadable.join(', ')}. Scores below leave those
            checks out rather than count them as passed.
          </p>
        )}

        <section className="mb-12">
          <Heading index="01" title="Scores" aside="Per dataset and criterion" />
          <ScoreTable cards={report.cards} />
        </section>

        <section>
          <Heading
            index="02"
            title="Each dataset"
            aside="Criteria, counts, trend and every failing row"
          />
          {report.cards.map((card) => (
            <DatasetSection key={card.dataset.id} card={card} runs={report.history} />
          ))}
        </section>
      </Page>
    </Shell>
  );
}
