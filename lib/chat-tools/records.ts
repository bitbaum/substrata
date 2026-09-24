/** Corpus records: find one by phrase, or read one by name. */
import { BOTTLENECKS } from '../bottlenecks';
import { ENTITY_KINDS, type EntityKind } from '../entities/types';
import { chatContext } from '../chat/retrieve';
import { remember } from './ledger';
import { findBottleneck, findCompany, findEntity } from './resolve';
import { bottleneckDetail, clip, companyDetail, entityDetail } from './shape';
import { str, type ChatTool } from './tool';

export const RECORD_TOOLS: readonly ChatTool[] = [
  {
    name: 'search_corpus',
    description:
      'Find records in the Substrata corpus (bottlenecks, companies, countries, policies, science, capital, facilities, talent, articles) matching a phrase. Use when you do not know the exact record, or for questions spanning many records.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to search for, e.g. "gallium refining"' },
        kind: { type: 'string', enum: [...ENTITY_KINDS], description: 'Optional: only this kind' },
      },
      required: ['query'],
    },
    label: (a) => `Searching the corpus for "${str(a.query)}"`,
    async run(args, env) {
      const kind = ENTITY_KINDS.includes(args.kind as EntityKind)
        ? (args.kind as EntityKind)
        : undefined;
      const hits = chatContext(str(args.query))
        .filter((d) => !kind || d.kind === kind)
        .slice(0, 8);
      for (const d of hits)
        remember(env.ledger, {
          title: d.title,
          href: d.href,
          kind: d.kind,
          evidence: d.evidence,
          primary: d.sources.slice(0, 3),
        });
      if (!hits.length)
        return { results: [], note: 'No record matches. Try other words or a lookup by name.' };
      return {
        results: hits.map((d) => ({
          name: d.title,
          kind: d.kind,
          page: d.href,
          evidence_state: d.evidence,
          excerpt: clip(d.text, 260),
        })),
      };
    },
  },
  {
    name: 'get_bottleneck',
    description:
      'Full record for one bottleneck: what it is, why it binds, the analyst assessment, every recorded producer with its evidence state and source, and recent accepted events.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Bottleneck name or slug' } },
      required: ['name'],
    },
    label: (a) => `Reading the ${str(a.name)} record`,
    async run(args, env) {
      const b = findBottleneck(str(args.name));
      if (!b)
        return {
          error: `No bottleneck called "${str(args.name)}".`,
          known: BOTTLENECKS.map((x) => x.name),
        };
      return bottleneckDetail(b, env.ledger);
    },
  },
  {
    name: 'get_company',
    description:
      'Full record for one company / market participant: its role in the chain, scarcity grade (a judgement), what it is recorded as making (each with evidence state and source), and recent accepted events.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Company name or slug' } },
      required: ['name'],
    },
    label: (a) => `Reading the ${str(a.name)} record`,
    async run(args, env) {
      const p = findCompany(str(args.name));
      if (!p) {
        const near = chatContext(str(args.name))
          .filter((d) => d.kind === 'company')
          .slice(0, 5)
          .map((d) => d.title);
        return {
          error: `"${str(args.name)}" is not in the corpus's company list.`,
          closest: near,
        };
      }
      return companyDetail(p, env.ledger);
    },
  },
  {
    name: 'get_record',
    description:
      'Any other corpus record by name: a country, policy, science programme, capital source, feedback loop, facility, talent gap, explainer or article. Returns its summary, evidence state, sources and what it is connected to.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        kind: { type: 'string', enum: [...ENTITY_KINDS] },
      },
      required: ['name'],
    },
    label: (a) => `Reading the ${str(a.name)} record`,
    async run(args, env) {
      const kind = ENTITY_KINDS.includes(args.kind as EntityKind)
        ? (args.kind as EntityKind)
        : undefined;
      if (kind === 'bottleneck') {
        const b = findBottleneck(str(args.name));
        if (b) return bottleneckDetail(b, env.ledger);
      }
      if (kind === 'company') {
        const p = findCompany(str(args.name));
        if (p) return companyDetail(p, env.ledger);
      }
      const e = findEntity(str(args.name), kind);
      if (!e)
        return { error: `No ${kind ?? 'record'} called "${str(args.name)}". Try search_corpus.` };
      return entityDetail(e, env.ledger);
    },
  },
];
