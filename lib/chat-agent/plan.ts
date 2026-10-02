/**
 * The lookups a question obviously needs, made BEFORE the model is called.
 *
 * Measured live 2026-09-25: of the 15-33 s an answer took, almost all was model
 * rounds — the model asked for tools, waited, asked again, and only then wrote.
 * Every round is a full call on a free tier metered per minute, so the second
 * one often spilled from Groq (0.2 s to first word) to OpenRouter (10 s+).
 * Most of those calls were predictable from where the reader was and the words
 * they used, so they are made here, locally and in parallel, and the model
 * gets one call to write.
 *
 * Deliberately conservative. A plan is `confident` only when it found the
 * record the question is about AND recognised what is being asked of it; then
 * the model is offered no tools at all. Otherwise the model still gets its
 * tools, with the planned results already in hand and one round to use them.
 * The web is never pre-fetched: it is the slowest lookup and only the model can
 * judge that the corpus is not enough.
 */
import type { ReaderContext } from '../chat-context';
import type { ToolEnv } from '../chat-tools/ledger';
import { CHAT_TOOLS, runTool } from '../chat-tools/registry';
import { familyIn } from '../chat-tools/jobs';
import { resourceIn } from '../chat-tools/resources';
import { withAliases } from '../chat-tools/tool';
import { isPageRecord, type AgentEvent } from './answer';
import { safeArgs, type ToolRequest } from './parse';
import { bottleneckIn, bottlenecksIn, companiesIn, countriesIn } from './question';

export { bottleneckIn, bottlenecksIn, companiesIn, countriesIn } from './question';

export interface Plan {
  calls: ToolRequest[];
  /** The planned results answer the question as asked: offer no tools. */
  confident: boolean;
}

const NEWS =
  /\b(new|news|latest|recent(ly)?|update[sd]?|changed?|happen(ed|ing)?|lately|this (week|month))\b/;
const EXPOSURE =
  /\b(listed|tickers?|stocks?|shares|equit(y|ies)|exposed|exposure|invest(ors?|able)?|public(ly)? (traded|compan(y|ies))|traded)\b/;
const MAKERS = /\b(who makes|makers?|producers?|suppliers?|who (supplies|produces)|sourced)\b/;
const DEPENDS =
  /\b(depends?|depending|dependen(t|ts|cy|cies)|rests? on|downstream|upstream|supply chain)\b/;

const JOBS =
  /\b(jobs?|roles?|hiring|hire|careers?|vacanc(y|ies)|openings?|positions?|retrain(ing)?|employers?|work (for|in|at))\b/;
const RESOURCE_ASK =
  /\b(produc(e|es|er|ers|tion)|suppl(y|ies|ier|iers)|reserves?|mines?|mining|who else|output|country|countries)\b/;
const SCENARIO =
  /\b(blockades?|blockaded|embargo(es|ed)?|invad(e|es|ed)|invasion|war|cut off|shuts? down|halts?|halted|bans?|banned|what if|what would happen|disrupt(s|ed|ion)?|sanction(s|ed)?|earthquakes?|outages?|loses|lost|without)\b/;
const SCIENCE_ASK =
  /\b(technolog(y|ies)|readiness|relieve|relief|alternatives?|substitutes?|breakthroughs?|prototypes?|could (fix|solve|replace)|innovations?)\b/;
const RESEARCH = /\b(papers?|preprints?|grants?|research|studies|publications?|arxiv|patents?)\b/;
const POLICY_ASK =
  /\b(rules?|laws?|regulat\w*|polic(y|ies)|export controls?|tariffs?|subsid\w*|permit\w*|lobb\w*|asked for|legislation|sanctions?)\b/;
const FILINGS = /\b(filings?|filed|sec|8-k|6-k|10-k|10-q|edgar|disclos\w*)\b/;
const PRICE = /\b(prices?|costs?|trend|index|spot|how much does)\b/;
const JURISDICTION: [RegExp, string][] = [
  [/\b(eu|europe|european)\b/, 'EU'],
  [/\b(us|u\.s\.|united states|america|american)\b/, 'US'],
  [/\b(china|chinese|prc)\b/, 'CN'],
  [/\b(japan|japanese)\b/, 'JP'],
];
const HOLDINGS = /\b(i hold|my (portfolio|holdings|positions|stocks)|i own|tickers?)\b/;

const call = (name: string, args: Record<string, unknown>): ToolRequest => ({
  name,
  args: JSON.stringify(args),
});

/**
 * What to look up before the first model call. Pure: no model, no network;
 * the calls it returns go through the same `runTool` the model's would.
 */
export function planLookups(
  question: string,
  context: ReaderContext,
  env: Pick<ToolEnv, 'leads'>,
): Plan {
  const q = question.toLowerCase();
  const onExposure = /^\/exposure(\/|\?|$)/.test(context.path ?? '');
  const page = context.entity;
  const pageBottleneck = page?.kind === 'bottleneck' ? page.key : undefined;
  const pageCompany = page?.kind === 'company' ? page.key : undefined;
  const named = bottleneckIn(question);
  const bottleneck = named?.slug ?? pageBottleneck;
  const holdings = HOLDINGS.test(q);
  const companies = companiesIn(question, holdings ? 4 : 2).filter((c) => c.slug !== pageCompany);
  const countries = countriesIn(question);
  const resource = resourceIn(question);
  const company = companies[0]?.slug ?? pageCompany;

  const calls: ToolRequest[] = [];
  let intent = false;
  if (named && named.slug !== pageBottleneck)
    calls.push(call('get_bottleneck', { name: named.slug }));
  else if (!named)
    for (const b of bottlenecksIn(question).filter((x) => x.slug !== pageBottleneck))
      calls.push(call('get_bottleneck', { name: b.slug }));
  for (const c of companies) calls.push(call('get_company', { name: c.slug }));

  if (EXPOSURE.test(q) || onExposure) {
    intent = true;
    calls.push(
      call(
        'listed_exposure',
        bottleneck ? { bottleneck } : company ? { company } : { listed_only: /\blisted\b/.test(q) },
      ),
    );
  } else if (DEPENDS.test(q) && (bottleneck || company)) {
    intent = true;
    calls.push(
      call('trace_dependencies', {
        name: bottleneck ?? company,
        direction: bottleneck && !company ? 'downstream' : 'upstream',
      }),
    );
  }
  if (NEWS.test(q)) {
    intent = true;
    if (bottleneck) {
      if (env.leads) calls.push(call('recent_leads', { bottleneck }));
    } else if (company) calls.push(call('list_events', { company }));
    else if (env.leads) calls.push(call('recent_leads', {}));
  }
  if (MAKERS.test(q) && (bottleneck || company)) intent = true;

  if (SCENARIO.test(q) && (countries[0] || company || bottleneck)) {
    intent = true;
    calls.push(
      call(
        'scenario_impact',
        countries[0] ? { country: countries[0].name } : company ? { company } : { bottleneck },
      ),
    );
  }

  // What the section the reader is on is about, and what the words ask for.
  const section = context.path ?? '';
  if (SCIENCE_ASK.test(q) || (/^\/science(\/|$)/.test(section) && !RESEARCH.test(q))) {
    intent = true;
    calls.push(call('relief_technologies', bottleneck ? { bottleneck } : {}));
  }
  if (RESEARCH.test(q) && bottleneck) {
    intent = true;
    calls.push(call('research_pipeline', { bottleneck }));
  }
  if (POLICY_ASK.test(q) || /^\/policy(\/|$)/.test(section)) {
    intent = true;
    const where = JURISDICTION.find(([re]) => re.test(q))?.[1];
    calls.push(
      call('policy_rules', {
        ...(bottleneck ? { bottleneck } : {}),
        ...(where ? { jurisdiction: where } : {}),
      }),
    );
  }
  if (FILINGS.test(q)) {
    intent = true;
    calls.push(call('recent_filings', company ? { company } : {}));
  }
  if (PRICE.test(q) && !bottleneck) {
    intent = true;
    // The measuring words only ("tin price"), not the whole sentence.
    const words = q
      .split(/[^a-z0-9-]+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !/^(what|which|the|and|for|with|are|has|have|how|does|did|show|tell|give|numbers?|trend|this|that|from|over|into|about|its|their|current|currently|now)$/.test(
            w,
          ),
      );
    calls.push(call('find_numbers', { query: words.join(' ') || question }));
  }

  if (JOBS.test(q)) {
    intent = true;
    const family = familyIn(question);
    calls.push(
      call('open_roles', {
        // A bottleneck only when the question names one outright; "electrical
        // engineer" is a job, not the electrical-steel rail.
        ...(bottleneck && !family ? { bottleneck } : {}),
        ...(family ? { family } : {}),
        ...(countries[0] ? { country: countries[0].iso2 } : {}),
      }),
    );
  }
  if (resource && (RESOURCE_ASK.test(q) || countries.length || !bottleneck)) {
    intent = true;
    calls.push(
      call('resource_production', {
        resource: resource.term,
        ...(/\breserves?\b/.test(q) ? { measure: 'reserves' } : {}),
        ...(countries[0] ? { country: countries[0].name } : {}),
      }),
    );
  } else if (countries.length && !JOBS.test(q) && !SCENARIO.test(q)) {
    calls.push(call('resource_production', { country: countries[0].name }));
  }

  // Nothing recognised: no guess. A corpus search here would list its eight
  // hits among the records read whether or not the answer used them.
  return { calls: calls.slice(0, 5), confident: Boolean(bottleneck || company) && intent };
}

/**
 * Calls run together. Labels go out first so the reader sees everything being
 * looked up at once; results come back in call order. Used for the planned
 * lookups and for every round of calls the model asks for.
 */
export async function runLookups(
  calls: ToolRequest[],
  context: ReaderContext,
  env: ToolEnv,
  emit: (event: AgentEvent) => void,
): Promise<string[]> {
  for (const c of calls) {
    const tool = CHAT_TOOLS.find((t) => t.name === c.name);
    const label = tool?.label(withAliases(tool.parameters, safeArgs(c.args)));
    emit({ type: 'tool', label: label ?? c.name });
  }
  const outs = await Promise.all(
    calls.map((c) =>
      isPageRecord(c, context)
        ? {
            result: '{"note":"This is the record on this page; it is already given to you above."}',
          }
        : runTool(c.name, c.args, env),
    ),
  );
  return outs.map((o, i) => `[${calls[i].name}] ${o.result}`);
}
