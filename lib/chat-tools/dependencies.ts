/**
 * The dependency layer, for the assistant: the one-hop rows on a record, and a
 * walk that follows them several hops with the sentence behind every step.
 *
 * "What does my NVIDIA position rest on, all the way down?" is a question the
 * corpus can answer only by chaining rows — NVIDIA needs CoWoS, CoWoS needs
 * HBM, HBM needs 300 mm wafers. The model should not guess the chain from its
 * own knowledge; it asks for it, and each hop comes back quoted.
 */
import {
  companiesOn,
  companyEdges,
  downstreamOf,
  pathLabel,
  upstreamOf,
  type Dependency,
} from '../dependencies';
import { DEPENDENCY_GAPS } from '@/config/substrata-dependencies';
import { bottleneckByName } from '../bottlenecks';
import { remember, type Ledger } from './ledger';
import { findBottleneck, findCompany } from './resolve';
import { clip } from './shape';
import { str, type ChatTool } from './tool';

/** One recorded row, as the model reads it. */
export function dependencyRow(d: Dependency, ledger?: Ledger) {
  if (ledger) {
    const b = bottleneckByName(d.on);
    if (b)
      remember(ledger, {
        title: b.name,
        href: `/bottlenecks/${b.slug}`,
        kind: 'bottleneck',
        evidence: d.primary ? 'primary source' : 'secondary source',
        primary: [d.source],
      });
  }
  return {
    from: d.from,
    relation: d.kind === 'needs' ? 'depends on' : 'sells into',
    on: d.on,
    source: d.source,
    ...(d.primary ? {} : { secondary: true }),
    quote: clip(d.quote, 130),
    ...(d.scope ? { scope: clip(d.scope, 90) } : {}),
  };
}

/** Companies recorded against a bottleneck, and which way. Their sentences are one trace away. */
function participants(rows: Dependency[]) {
  return rows.map((d) => ({
    company: d.from,
    relation: d.kind === 'needs' ? 'depends on it' : 'sells into it',
  }));
}

const NOTE =
  'Each row is one sentence from its source. None states a share, a volume, a contract, or that no substitute exists.';

const last = (path: Dependency[]) => path[path.length - 1];

/**
 * Each reached node carries only the hop that reached it: the earlier hops are
 * the entries before it, so every sentence is quoted once and the result stays
 * inside the tool budget.
 */
function walkFrom(starts: string[], direction: 'upstream' | 'downstream', ledger: Ledger) {
  const reached = direction === 'upstream' ? upstreamOf(starts) : downstreamOf(starts);
  return reached.slice(0, 7).map((r) => {
    const start = direction === 'upstream' ? r.path[0].from : r.path[0].on;
    return {
      reaches: r.bottleneck,
      chain: pathLabel(start, r.path, direction === 'upstream'),
      source: last(r.path).source,
      quote: clip(last(r.path).quote, 110),
      companies_resting_on_it:
        direction === 'downstream' ? participants(companiesOn(r.bottleneck)) : undefined,
    };
  });
}

export const DEPENDENCY_TOOLS: readonly ChatTool[] = [
  {
    name: 'trace_dependencies',
    description:
      'Follow the sourced dependency rows from a company or bottleneck. "upstream" = what it rests on, hop by hop (e.g. NVIDIA → advanced packaging → HBM → wafers); "downstream" = what rests on a bottleneck and which companies depend on or sell into it. Every hop carries its source URL and verbatim sentence.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company or bottleneck name or slug' },
        direction: { type: 'string', enum: ['upstream', 'downstream'] },
      },
      required: ['name'],
    },
    label: (a) => `Tracing what ${str(a.name)} rests on`,
    async run(args, env) {
      const direction = args.direction === 'downstream' ? 'downstream' : 'upstream';
      const name = str(args.name);
      const b = findBottleneck(name);
      const company = b ? undefined : findCompany(name);
      if (company) {
        const direct = companyEdges(company.name);
        const needs = direct.filter((d) => d.kind === 'needs').map((d) => d.on);
        return {
          company: company.name,
          page: `/markets/${company.slug}`,
          direct: direct.map((d) => dependencyRow(d, env.ledger)),
          further_upstream: walkFrom(needs, 'upstream', env.ledger),
          note: direct.length ? NOTE : 'No dependency row is recorded for this company.',
          not_recorded: direct.length ? undefined : DEPENDENCY_GAPS,
        };
      }
      if (!b) return { error: `No company or bottleneck called "${name}".` };
      return {
        bottleneck: b.name,
        page: `/bottlenecks/${b.slug}`,
        direction,
        reached: walkFrom([b.name], direction, env.ledger),
        companies_on_it: participants(companiesOn(b.name)),
        note: NOTE,
      };
    },
  },
];
