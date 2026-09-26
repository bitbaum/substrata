/**
 * Pick what fails. Presets first — one click each, taken from the record —
 * then a plain GET form to build your own, so the resulting URL is the
 * scenario and works without JavaScript.
 */
import Link from 'next/link';

import { PRESETS } from '@/lib/scenario/presets';
import {
  bottleneckTargets,
  companyTargets,
  countryTargets,
  scenarioHref,
  targetId,
  parseTarget,
  type Scenario,
} from '@/lib/scenario/target';

export function ScenarioPicker({ current }: { current: Scenario | null }) {
  const at = current ? targetId(current.at) : '';
  const only = current?.only.length === 1 ? current.only[0] : '';
  return (
    <>
      <h2 className="scenario-label">On the record</h2>
      <ul className="scenario-presets" aria-label="Scenarios from the record">
        {PRESETS.map((p) => {
          const target = parseTarget(p.at);
          if (!target) return null;
          const href = scenarioHref({ at: target, only: p.only });
          const active = current && scenarioHref(current) === href;
          return (
            <li key={p.id}>
              <Link href={href} className={`scenario-preset${active ? ' is-active' : ''}`}>
                {p.title}
              </Link>
            </li>
          );
        })}
      </ul>
      <h2 className="scenario-label scenario-own">Or build your own</h2>
      <form action="/scenarios" method="get" className="scenario-form">
        <label className="desk-filter">
          <span className="scenario-label">What fails</span>
          <select name="at" defaultValue={at} required>
            <option value="" disabled>
              Pick a company, bottleneck or country
            </option>
            <optgroup label="Companies (holders of a bottleneck)">
              {companyTargets().map((t) => (
                <option key={t.slug} value={targetId(t)}>
                  {t.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Countries">
              {countryTargets().map((t) => (
                <option key={t.code} value={targetId(t)}>
                  {t.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Bottlenecks">
              {bottleneckTargets().map((t) => (
                <option key={t.slug} value={targetId(t)}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="desk-filter">
          <span className="scenario-label">Only for (optional)</span>
          <select name="only" defaultValue={only}>
            <option value="">Everything it touches</option>
            {bottleneckTargets().map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="research-button">
          Run the scenario
        </button>
      </form>
    </>
  );
}
