import Link from 'next/link';
import type { Metadata } from 'next';

import { DEPENDENCY_GAPS } from '@/config/substrata-dependencies';
import { methodHref } from '@/lib/methods';
import { parseScenario, scenarioTitle } from '@/lib/scenario/target';
import { Empty, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { ScenarioPicker } from '@/components/scenario/ScenarioPicker';
import { ScenarioResult } from '@/components/scenario/ScenarioResult';
import '../xray/xray.css';

type Params = Record<string, string | string[] | undefined>;

const DESCRIPTION =
  'What if a company, a bottleneck or a country fails? Which bottlenecks lose a maker, what lies downstream, which listed companies are exposed, and what the record says about recovery.';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const s = parseScenario(await searchParams);
  return { title: s ? `Scenario: ${scenarioTitle(s)}` : 'Scenarios', description: DESCRIPTION };
}

export default async function ScenariosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const scenario = parseScenario(params);
  // An `at` that names nothing in the corpus (an old or mistyped link) says so.
  const unreadable = !scenario && typeof params.at === 'string' && params.at !== '';

  return (
    <Shell>
      <Page>
        <PageHeader
          kicker="Scenarios"
          title="What if it fails?"
          status={
            <>
              Pick a scenario on the record, or build your own from a company (private ones
              included), a bottleneck or a country. You get what it hits, what lies downstream,
              which listed companies are exposed, and what the record says about recovery — one
              recorded step at a time (<Link href={methodHref('scenario-propagation')}>rule</Link>
              ).
            </>
          }
        />

        {unreadable && (
          <Empty
            what="That scenario names nothing in the directory."
            next="The company, bottleneck or country may have been renamed."
            action={<Link href="/scenarios">Pick one below</Link>}
          />
        )}

        {scenario ? (
          <>
            <ScenarioResult scenario={scenario} />
            <details className="scenario-change">
              <summary>Try another scenario</summary>
              <ScenarioPicker current={scenario} />
            </details>
          </>
        ) : (
          <ScenarioPicker current={null} />
        )}

        <aside className="xray-block xray-limits">
          <h2 className="xray-h2">Where the map stops</h2>
          <ul className="xray-list">
            {DEPENDENCY_GAPS.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <p className="xray-note">
            Holding some of these? <Link href="/xray">X-ray a portfolio</Link> to see which of them
            it rests on.
          </p>
        </aside>
      </Page>
    </Shell>
  );
}
