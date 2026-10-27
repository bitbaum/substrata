/**
 * The frontier registry in the Ask: which companies are tracked in an area, and
 * what the registry says about one, private labs included. Every value comes
 * with its grade and source; a field the registry lacks is reported as a gap,
 * never filled. Decided: docs/architecture/2026-10-28-frontier-registry.md.
 */
import { areaPage } from '../registry/area-view';
import { searchAreas } from '../registry/area-search';
import { areaBySlug, allAreas } from '../registry/areas';
import { gapsOf } from '../registry/gaps';
import { registeredCompany, registeredCompanies } from '../registry/load';
import { GRADE_LABEL, KIND_LABEL, type Company } from '../registry/schema';
import { findUniverseEntry } from '../universe/store';
import { remember } from './ledger';
import { num, str, type ChatTool } from './tool';

const NOTE =
  'Registered means Substrata tracks the company on purpose; it is not a claim about any supply chain. A private company has no share price here. Say which fields are gaps; never fill one from memory.';

export function resolveArea(q: string) {
  const raw = q.trim();
  return (
    areaBySlug(raw) ??
    allAreas().find((a) => a.name.toLowerCase() === raw.toLowerCase()) ??
    searchAreas(raw)[0]
  );
}

export function companyFacts(c: Company) {
  const ev = (field: string) => c.evidence.find((e) => e.field === field);
  const cited = (field: string, value: string | undefined) => {
    const e = ev(field);
    return value && e
      ? { value, grade: GRADE_LABEL[e.grade], source: e.source, read_on: e.readOn }
      : undefined;
  };
  return {
    company: c.name,
    page: `/markets/${c.slug}`,
    kind: KIND_LABEL[c.kind],
    what_it_is: cited('summary', c.summary),
    country: cited('country', c.country),
    headquarters: cited('hq', c.hq),
    areas: c.areas.map((a) => ({
      area: areaBySlug(a.area)?.name ?? a.area,
      page: `/areas/${a.area}`,
    })),
    identifiers: c.ids,
    figures: c.figures.map((f) => {
      const e = ev(`figure:${f.id}`);
      return {
        what: f.label,
        amount: f.amount,
        on: f.on,
        grade: e ? GRADE_LABEL[e.grade] : undefined,
        source: e?.source,
      };
    }),
    not_known_yet: gapsOf(c).map((g) => g.label),
    note: NOTE,
  };
}

export const FRONTIER_TOOLS: readonly ChatTool[] = [
  {
    name: 'registered_company',
    description:
      'What the frontier registry holds on one company, public or private (AI labs, robotics firms, chip, power, space, bio): what it is, kind, country, areas, identifiers, any cited private-company figures, and the gaps. Use for "who is X", "tell me about the lab/startup X", "is X tracked".',
    parameters: {
      type: 'object',
      properties: { company: { type: 'string', description: 'Company name, ticker or slug' } },
      required: ['company'],
    },
    label: (a) => `Looking up ${str(a.company) || 'the company'} in the registry`,
    async run(args, env) {
      const asked = str(args.company);
      if (!asked) return { error: 'Name a company.' };
      const entry = findUniverseEntry(asked);
      const c = entry ? registeredCompany(entry.slug) : undefined;
      if (!c)
        return {
          company: asked,
          status: entry?.proposed ? 'proposed, not yet registered' : 'not registered',
          note: 'Not in the registry. Say so plainly; adding it is one command (company:add) and the question is recorded as a gap.',
        };
      remember(env.ledger, {
        title: c.name,
        href: `/markets/${c.slug}`,
        kind: 'company',
        evidence: 'registry entry',
        primary: c.evidence.slice(0, 3).map((e) => e.source),
      });
      return companyFacts(c);
    },
  },
  {
    name: 'companies_in_area',
    description:
      'The companies registered in a technology area (frontier labs, AI accelerators, humanoids, actuators, fusion, launch, quantum, neurotech …) with kind and country, sub-areas rolled up. Use for "who are the humanoid robot makers", "list frontier labs", "which Chinese companies are in X", "compare companies in an area".',
    parameters: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          description: 'Area slug or name, e.g. humanoids, frontier-labs, fusion',
        },
        country: { type: 'string', description: 'Optional ISO alpha-2, e.g. CN' },
        kind: {
          type: 'string',
          description: 'Optional kind: public, private, lab, subsidiary, state-owned …',
        },
        limit: { type: 'number', description: 'Max rows, default 40' },
      },
      required: ['area'],
    },
    label: (a) => `Listing companies in ${str(a.area) || 'the area'}`,
    async run(args, env) {
      const area = resolveArea(str(args.area));
      if (!area)
        return {
          error: `No area matches "${str(args.area)}".`,
          areas: allAreas().map((a) => a.slug),
        };
      const p = areaPage(area.slug)!;
      const country = str(args.country).toUpperCase();
      const kind = str(args.kind);
      const rows = p.members
        .map((m) => m.company)
        .filter((c) => (!country || c.country === country) && (!kind || c.kind === kind));
      remember(env.ledger, {
        title: area.name,
        href: `/areas/${area.slug}`,
        kind: 'method',
        evidence: 'registry area',
        primary: [],
      });
      return {
        area: area.name,
        page: `/areas/${area.slug}`,
        why_it_matters: `${area.why} (Substrata's framing)`,
        registered: p.members.length,
        matching: rows.length,
        companies: rows.slice(0, num(args.limit, 40, 1, 100)).map((c) => ({
          name: c.name,
          page: `/markets/${c.slug}`,
          kind: KIND_LABEL[c.kind],
          country: c.country,
          what: c.summary,
        })),
        note: NOTE,
      };
    },
  },
  {
    name: 'list_areas',
    description:
      'The technology areas Substrata tracks and how many companies are registered in each. Use for "what areas do you cover", "what sectors".',
    parameters: { type: 'object', properties: {} },
    label: () => 'Listing the areas',
    async run() {
      const cs = registeredCompanies();
      return {
        registered_companies: cs.length,
        areas: allAreas().map((a) => ({
          slug: a.slug,
          name: a.name,
          parent: a.parent,
          page: `/areas/${a.slug}`,
          registered: areaPage(a.slug)!.members.length,
        })),
        note: NOTE,
      };
    },
  },
];
