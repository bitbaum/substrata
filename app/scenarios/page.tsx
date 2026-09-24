import Link from 'next/link';
import type { Metadata } from 'next';

import { DEPENDENCY_GAPS } from '@/config/substrata-dependencies';
import { methodHref } from '@/lib/methods';
import { directHits, downstreamHits } from '@/lib/scenario/propagate';
import { exposedCompanies } from '@/lib/scenario/exposed';
import { recoveryFor, type Recovery } from '@/lib/scenario/recovery';
import { PRESETS } from '@/lib/scenario/presets';
import { parseScenario, scenarioHref, scenarioTitle, targetId } from '@/lib/scenario/target';
import { SITE } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { ScenarioPicker } from '@/components/scenario/ScenarioPicker';
import { DirectHits, Downstream } from '@/components/scenario/ScenarioSteps';
import { ExposedTable, RecoveryList } from '@/components/scenario/ScenarioImpact';
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
  const scenario = parseScenario(await searchParams);
  const hits = scenario ? directHits(scenario) : [];
  const downstream = downstreamHits(hits);
  const failed = scenario?.at.kind === 'company' ? scenario.at.name : null;
  const companies = exposedCompanies(hits, downstream, failed);
  const country = scenario?.at.kind === 'country' ? scenario.at.code : null;
  const recovery = hits
    .map((h) => recoveryFor(h.slug, country))
    .filter((r): r is Recovery => r !== null);
  const preset = scenario
    ? PRESETS.find(
        (p) => p.at === targetId(scenario.at) && p.only.join(',') === scenario.only.join(','),
      )
    : undefined;
  const listed = companies.filter(
    (c) => c.listing?.status === 'listed' || c.listing?.status === 'parent',
  );

  return (
    <Shell currentPath="scenarios">
      <Page>
        <header className="xray-head">
          <p className="desk-kicker">Scenarios</p>
          <h1 className="desk-title">What if it fails?</h1>
          <p className="desk-status">
            Pick a company (private ones included), a bottleneck or a country. The failure is traced
            through the corpus one recorded step at a time: who makes what, what needs what, who
            holds or relies on the result. Every step links the row behind it (
            <Link href={methodHref('scenario-propagation')}>rule</Link>).
          </p>
        </header>

        <ScenarioPicker current={scenario} />

        {scenario && (
          <section className="xray-report" aria-label="Scenario result">
            <h2 className="scenario-title">{scenarioTitle(scenario)}</h2>
            {preset && (
              <p className="xray-note">
                Why this is a live question: <a href={preset.basis.href}>{preset.basis.label}</a>
                {preset.basis.date ? ` (${preset.basis.date})` : ''}
              </p>
            )}
            <p className="xray-sub">
              Share this scenario: <code>{`https://${SITE.host}${scenarioHref(scenario)}`}</code>
            </p>

            <div className="xray-block">
              <h2 className="xray-h2">
                Step one · <Figure method="scenario-propagation">{String(hits.length)}</Figure>{' '}
                bottleneck{hits.length === 1 ? '' : 's'} hit directly
              </h2>
              {hits.length === 0 ? (
                <p className="xray-note">
                  The corpus records nothing this node makes, supplies or hosts in this scope.
                </p>
              ) : (
                <DirectHits hits={hits} />
              )}
            </div>

            <div className="xray-block">
              <h2 className="xray-h2">
                Step two ·{' '}
                <Figure method="scenario-propagation">{String(downstream.length)}</Figure>{' '}
                downstream through recorded inputs
              </h2>
              <Downstream rows={downstream} />
            </div>

            <div className="xray-block">
              <h2 className="xray-h2">
                Step three ·{' '}
                <Figure method="scenario-propagation">{String(companies.length)}</Figure> companies
                exposed, <Figure method="holders-listed">{String(listed.length)}</Figure> with a
                listing
              </h2>
              <p className="xray-note">
                Exposure is a recorded relation, not a size, and not a direction: a remaining maker
                may gain as much as a dependent loses.
              </p>
              {companies.length > 0 && <ExposedTable rows={companies} />}
            </div>

            {recovery.length > 0 && (
              <div className="xray-block">
                <h2 className="xray-h2">Step four · what the record says about recovery</h2>
                <p className="xray-note">
                  No recovery date is computed: the corpus holds no measured lead-time series. What
                  it holds is shown with its basis.
                </p>
                <RecoveryList rows={recovery} country={country} />
              </div>
            )}
          </section>
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
