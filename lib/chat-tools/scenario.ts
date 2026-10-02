/**
 * "What if X stops?" — the scenario engine behind /scenarios, for the assistant.
 *
 * Asked what a blockade of Taiwan would do to AI chips, the model had no such
 * tool, read a hydropower table, and invented "≈70% of capacity" and ">80% of
 * wafer output" as analyst judgements the record never held (2026-10-02). The
 * engine already computes it from recorded rows: which bottlenecks lose
 * makers, which still have makers elsewhere, what rests on them downstream,
 * and which companies are exposed — a relation, never a size.
 */
import { listingLine } from './exposure';
import { remember } from './ledger';
import { findBottleneck, findCompany } from './resolve';
import { str, type ChatTool } from './tool';
import { resolveIn } from '../entities/registry';
import { EXPOSURE_LABEL, exposedCompanies } from '../scenario/exposed';
import { directHits, downstreamHits } from '../scenario/propagate';
import { parseTarget, targetId, type Target } from '../scenario/target';

const STATUS: Record<string, string> = {
  target: 'the scenario itself',
  'no-maker-left': 'NO recorded maker left',
  'makers-left': 'makers remain elsewhere',
  'part-lost': 'a critical part supplier is lost',
};

function targetOf(a: Record<string, unknown>): Target | null {
  if (str(a.country)) {
    const c = resolveIn('country', str(a.country));
    return c ? parseTarget(`country:${c.key}`) : null;
  }
  if (str(a.company)) {
    const p = findCompany(str(a.company));
    return p ? parseTarget(`company:${p.slug}`) : null;
  }
  if (str(a.bottleneck)) {
    const b = findBottleneck(str(a.bottleneck));
    return b ? parseTarget(`bottleneck:${b.slug}`) : null;
  }
  return null;
}

export const SCENARIO_TOOLS: ChatTool[] = [
  {
    name: 'scenario_impact',
    description:
      'What happens if a country, a company or a bottleneck drops out (blockade, embargo, export ban, plant failure): the bottlenecks that lose recorded makers, whether any maker remains, what rests on them downstream, and the companies exposed. Computed from recorded rows; exposure is a relation, never a size. Give ONE of country, company, bottleneck.',
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'e.g. Taiwan, China' },
        company: { type: 'string', description: 'e.g. ASML' },
        bottleneck: { type: 'string', description: 'e.g. EUV lithography scanners' },
      },
    },
    label: (a) =>
      `Running the scenario: without ${str(a.country) || str(a.company) || str(a.bottleneck) || '…'}`,
    async run(a, env) {
      const at = targetOf(a);
      if (!at)
        return {
          error:
            'No such country, company or bottleneck among the recorded makers — a scenario can only remove what the corpus records.',
        };
      const scenario = { at, only: [] };
      const hits = directHits(scenario);
      const downstream = downstreamHits(hits);
      const exposed = exposedCompanies(hits, downstream, at.kind === 'company' ? at.name : null);
      const page = `/scenarios?at=${encodeURIComponent(targetId(at))}`;
      remember(env.ledger, {
        title: `Scenario: without ${at.name}`,
        href: page,
        kind: 'scenario',
        evidence: 'computed from recorded producer and dependency rows',
        primary: [],
      });
      const worst = [...hits].sort(
        (x, y) =>
          Number(y.status === 'no-maker-left') - Number(x.status === 'no-maker-left') ||
          y.lost.length - x.lost.length,
      );
      return {
        scenario: `Without ${at.name}`,
        page,
        bottlenecks_hit: worst.slice(0, 10).map((h) => ({
          bottleneck: h.bottleneck,
          page: `/bottlenecks/${h.slug}`,
          result: STATUS[h.status] ?? h.status,
          makers_lost: h.lost.slice(0, 6),
          makers_remaining: h.remaining.slice(0, 6),
        })),
        bottlenecks_hit_total: hits.length,
        downstream: downstream.slice(0, 10).map((d) => ({
          bottleneck: d.bottleneck,
          page: `/bottlenecks/${d.slug}`,
          via: d.from,
        })),
        companies_exposed: exposed.slice(0, 12).map((c) => ({
          company: c.name,
          listing: listingLine(c.listing),
          how: [
            ...new Set(c.exposures.map((e) => `${EXPOSURE_LABEL[e.kind]}: ${e.bottleneck}`)),
          ].slice(0, 3),
        })),
        note: 'Computed from the recorded makers and sourced dependency rows only: it says which supply is lost and what rests on it, not how much output falls. "NO recorded maker left" means none in Substrata\'s coverage — not none in the world; say so, and do not turn it into "output drops to zero". Do not add percentages the rows do not carry.',
      };
    },
  },
];
