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
import { familyIn } from '../chat-tools/jobs';
import { producerResourcesIn } from '../chat-tools/producers';
import { resourceIn } from '../chat-tools/resources';
import { graphCalls } from './graph-ask';
import { marketCalls } from './market-ask';
import type { ToolRequest } from './parse';
import { bottleneckIn, bottlenecksIn, companiesIn, countriesIn } from './question';

export { bottleneckIn, bottlenecksIn, companiesIn, countriesIn } from './question';

export interface Plan {
  calls: ToolRequest[];
  /** The planned results answer the question as asked: offer no tools. */
  confident: boolean;
  /** What to search the web for when a planned lookup comes back empty. */
  webQuery: string;
}

/**
 * The search a web engine should run for the question: its subject, not its
 * wording. Seen live (2026-10-22): "What open jobs are there in Niger?" sent
 * verbatim brought back OpenAI and the Open University — the engine matched
 * "open". A jobs question searches for jobs in the country it names; any
 * other question loses its question words and keeps the names it carries.
 */
export function webQuery(question: string): string {
  const q = question.toLowerCase();
  const countries = countriesIn(question);
  const family = familyIn(question);
  const named = bottleneckIn(question);
  if (JOBS.test(q)) {
    const where = countries[0] ? ` in ${countries[0].name}` : '';
    const what = family ? family.replace(/-/g, ' ') : named ? named.name : '';
    return `${what} jobs${where}`.trim();
  }
  const stripped = question
    .replace(/^\s*(what|which|where|when|why|how (many|much|does|do|is|are))\b\s*/i, '')
    .replace(/\b(is|are|was|were|do|does|did|can|could|there|tell me|show me|about)\b\s*/gi, ' ')
    .replace(/[?.!]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || question.trim();
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
const OWN_WRITING =
  /\b(substrata|your|this site)\b.*\b(wr[io]tt?en?|published|notes?|articles?|guides?|methods?|methodology|approach)\b|\b(methodology|editorial notes?)\b/;
const PRICE = /\b(prices?|costs?|trend|index|spot|how much does)\b/;
const JURISDICTION: [RegExp, string][] = [
  [/\b(eu|europe|european)\b/, 'EU'],
  [/\b(us|u\.s\.|united states|america|american)\b/, 'US'],
  [/\b(china|chinese|prc)\b/, 'CN'],
  [/\b(japan|japanese)\b/, 'JP'],
];
/** Who runs and owns the mines and plants: the USGS facility rows (producers_in). */
const FACILITY_ASK =
  /\b(compan(y|ies)|operat(e|es|or|ors|ing)|owns?|owners?|owned|ownership|stakes?|shareholders?|mines?|mining|miners?|plants?|refiner(y|ies)|smelters?|facilit(y|ies)|producers?|produce|who (makes|mines|runs|extracts))\b/;
/** With no resource named, only words about companies send a country to its facility rows. */
const COMPANY_ASK =
  /\b(compan(y|ies)|operators?|owns?|owners?|ownership|stakes?|shareholders?|miners?|who (mines|runs|operates))\b/;
const RESTRICTION_ASK =
  /\b(export (ban|bans|restrictions?|controls?|quotas?|tax|taxes|licen[cs]es?)|restrict(s|ed|ions?)?|quotas?|bans? (on )?exports?)\b/;
const SANCTION_ASK = /\b(sanction(s|ed)?|embargo(es|ed)?|ofac)\b/;
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
  // A graph question names its firm itself: a fuzzy directory match ("Sumitomo" →
  // Sumitomo Electric) is kept only when its whole name is in the question.
  const graph = graphCalls(question);
  const companies = companiesIn(question, holdings ? 4 : 2).filter(
    (c) => c.slug !== pageCompany && (!graph.length || q.includes(c.name.toLowerCase())),
  );
  const countries = countriesIn(question);
  const resource = resourceIn(question);
  const company = companies[0]?.slug ?? pageCompany;

  // Rung 3 first: who owns X, what X holds, how X connects to Y (graph-ask.ts).
  // Then a listed company's prices, financials and holders (market-ask.ts).
  const calls: ToolRequest[] = [...graph, ...marketCalls(question)];
  let intent = calls.length > 0;
  // Rung 2 of the answer ladder first: a country's mines, plants, operators and
  // owners are USGS facility rows. Asked live on 2026-10-24 which companies
  // mine uranium in Kazakhstan and who owns them, no tool read those rows and
  // the answer said they were not recorded.
  const facilityResources = producerResourcesIn(question).slice(0, 2);
  if (
    countries[0] &&
    (facilityResources.length ? FACILITY_ASK.test(q) : !resource && COMPANY_ASK.test(q))
  ) {
    intent = true;
    for (const id of facilityResources.length ? facilityResources : [undefined])
      calls.push(
        call('producers_in', { country: countries[0].name, ...(id ? { resource: id } : {}) }),
      );
  }
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
  if (RESTRICTION_ASK.test(q) && !NEWS.test(q) && (resource || countries[0])) {
    intent = true;
    calls.push(
      call('restrictions_on', {
        ...(resource ? { resource: resource.term } : {}),
        ...(countries[0] ? { country: countries[0].name } : {}),
      }),
    );
  }
  if (SANCTION_ASK.test(q) && countries[0]) {
    intent = true;
    calls.push(
      call('sanctions_on', {
        name: countries[0].name,
        ...(resource ? { resource: resource.term } : {}),
      }),
    );
  }
  if (OWN_WRITING.test(q) || /^\/(notes|learn)(\/|$)/.test(section)) {
    intent = true;
    calls.push(call('site_writing', {}));
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
  return {
    calls: calls.slice(0, 5),
    confident: Boolean(bottleneck || company) && intent,
    webQuery: webQuery(question),
  };
}

/**
 * Calls run together. Labels go out first so the reader sees everything being
 * looked up at once; results come back in call order. Used for the planned
 * lookups and for every round of calls the model asks for.
 */
