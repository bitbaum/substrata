/**
 * `company_membership`: why a company is (or is not) on Substrata's list.
 * The answer is lib/universe/why.ts over the written rule
 * (config/universe-themes.ts): in (tier, themes, each cited row), out (the
 * test it fails), considered (where we looked), named only (tier C), or not
 * yet considered — in which case the gap is filed so the work queue picks it
 * up, and the model must say so rather than guess.
 */
import { resolveIn } from '../entities/registry';
import { isStub } from '../entities/types';
import { whyCompany } from '../universe/why';
import { remember } from './ledger';
import { str, type ChatTool } from './tool';

const NOTE =
  'Membership follows a written rule: a cited theme, a cited size figure over its floor, a registry identifier (/data/companies). A fund holding shows interest in a theme, never a role in a supply chain — do not describe a tier B company as a supplier or producer. For a name not yet considered, say it has not been checked and that a task is queued; never guess why it is absent.';

function namedOnly(name: string) {
  const e = resolveIn('company', name);
  return e && isStub(e) ? { name: e.name, href: e.href, summary: e.summary } : undefined;
}

export const UNIVERSE_TOOLS: readonly ChatTool[] = [
  {
    name: 'company_membership',
    description:
      'Whether a company is covered by Substrata and why: the tier, the themes and the cited evidence that admits it, or exactly which admission test it fails, or that it has not been considered yet. Use for "why is X on the list", "why is there no Y", "is Z covered", "how do you choose companies".',
    parameters: {
      type: 'object',
      properties: { company: { type: 'string', description: 'Company name, ticker or slug' } },
      required: ['company'],
    },
    label: (a) => `Checking whether ${str(a.company) || 'it'} is covered`,
    async run(args, env) {
      const asked = str(args.company);
      if (!asked) return { error: 'Name a company.' };
      const m = whyCompany(asked, { namedOnly, question: `Is ${asked} covered?` });
      remember(env.ledger, {
        title: 'Which companies are in, and why',
        href: '/data/companies',
        kind: 'method',
        evidence: 'the written admission rule',
        primary: [],
      });
      if (m.status === 'in')
        return {
          company: m.name,
          status: `in — tier ${m.tier} (${m.tierLabel})`,
          page: m.href,
          themes: m.themes,
          admitted_by: m.admittedBy.slice(0, 8).map((a) => ({
            test: a.test,
            says: a.detail,
            source: a.source,
            ...(a.quote ? { quote: a.quote.slice(0, 200) } : {}),
            ...(a.asOf ? { as_of: a.asOf } : {}),
          })),
          rule: '/data/companies',
          note: NOTE,
        };
      if (m.status === 'out')
        return {
          company: m.name,
          status: 'considered, not admitted',
          page: m.href,
          fails: m.failed,
          rule: '/data/companies',
          note: NOTE,
        };
      if (m.status === 'proposed')
        return {
          company: m.name,
          status: 'proposed, not yet registered',
          page: m.href,
          themes: m.themes,
          why: m.why,
          note: NOTE,
        };
      if (m.status === 'considered')
        return {
          company: m.name,
          status: 'looked for, not admitted',
          why: m.why,
          looked: m.looked,
          on: m.on,
          note: NOTE,
        };
      if (m.status === 'named')
        return {
          company: m.name,
          status: 'named only (tier C)',
          page: m.href,
          why: m.why,
          note: NOTE,
        };
      return {
        company: m.name,
        status: 'not yet considered',
        why: m.why,
        queued_task: m.task.id,
        note: NOTE,
      };
    },
  },
];
