/**
 * One scenario, traced: what it hits directly, what lies downstream, who is
 * exposed, and what the record says about recovery. Every step is computed in
 * lib/scenario/*; this only lays the four steps out in reading order.
 */
import { directHits, downstreamHits } from '@/lib/scenario/propagate';
import { exposedCompanies } from '@/lib/scenario/exposed';
import { recoveryFor, type Recovery } from '@/lib/scenario/recovery';
import { PRESETS } from '@/lib/scenario/presets';
import { scenarioHref, scenarioTitle, targetId, type Scenario } from '@/lib/scenario/target';
import { CopyLink } from '@/components/portal/CopyLink';
import { Figure } from '@/components/portal/Figure';
import { DirectHits, Downstream } from './ScenarioSteps';
import { ExposedTable, RecoveryList } from './ScenarioImpact';

export function ScenarioResult({ scenario }: { scenario: Scenario }) {
  const hits = directHits(scenario);
  const downstream = downstreamHits(hits);
  const failed = scenario.at.kind === 'company' ? scenario.at.name : null;
  const companies = exposedCompanies(hits, downstream, failed);
  const country = scenario.at.kind === 'country' ? scenario.at.code : null;
  const recovery = hits
    .map((h) => recoveryFor(h.slug, country))
    .filter((r): r is Recovery => r !== null);
  const preset = PRESETS.find(
    (p) => p.at === targetId(scenario.at) && p.only.join(',') === scenario.only.join(','),
  );
  const shares = Object.fromEntries(
    recovery.flatMap((r) =>
      r.output
        ? [
            [
              r.slug,
              { share: r.output.share, source: r.output.source, year: r.output.production.year },
            ],
          ]
        : [],
    ),
  );
  const listed = companies.filter(
    (c) => c.listing?.status === 'listed' || c.listing?.status === 'parent',
  );

  return (
    <section className="xray-report" id="result" aria-label="Scenario result">
      <h2 className="scenario-title">{preset?.title ?? scenarioTitle(scenario)}</h2>
      {preset && (
        <p className="xray-note">
          Why this is a live question: <a href={preset.basis.href}>{preset.basis.label}</a>
          {preset.basis.date ? ` (${preset.basis.date})` : ''}
        </p>
      )}
      <CopyLink href={scenarioHref(scenario)} label="Copy link to this scenario" />

      <div className="xray-block">
        <h2 className="xray-h2">
          Step one · <Figure method="scenario-propagation">{String(hits.length)}</Figure> bottleneck
          {hits.length === 1 ? '' : 's'} hit directly
        </h2>
        {hits.length === 0 ? (
          <p className="xray-note">
            The corpus records nothing this node makes, supplies or hosts in this scope.
          </p>
        ) : (
          <DirectHits hits={hits} shares={shares} />
        )}
      </div>

      <div className="xray-block">
        <h2 className="xray-h2">
          Step two · <Figure method="scenario-propagation">{String(downstream.length)}</Figure>{' '}
          downstream through recorded inputs
        </h2>
        <Downstream rows={downstream} />
      </div>

      <div className="xray-block">
        <h2 className="xray-h2">
          Step three · <Figure method="scenario-propagation">{String(companies.length)}</Figure>{' '}
          companies exposed, <Figure method="holders-listed">{String(listed.length)}</Figure> with a
          listing
        </h2>
        <p className="xray-note">
          Exposure is a recorded relation, not a size, and not a direction: a remaining maker may
          gain as much as a dependent loses.
        </p>
        {companies.length > 0 && <ExposedTable rows={companies} />}
      </div>

      {recovery.length > 0 && (
        <div className="xray-block">
          <h2 className="xray-h2">Step four · what the record says about recovery</h2>
          <p className="xray-note">
            No recovery date is computed: the corpus holds no measured lead-time series. What it
            holds is shown with its basis.
          </p>
          <RecoveryList rows={recovery} country={country} />
        </div>
      )}
    </section>
  );
}
