/**
 * Market data for the assistant: a listed company's share-price history, its
 * reported financials and who holds its shares — each figure computed in code
 * (lib/market-data), dated, and linked to the page or filing it came from.
 *
 * Asked "who owns NVIDIA and how has the share price done over the last
 * year?" (2026-10-25), the Ask could quote one close from a web page and said
 * no source gave a 12-month series. These tools are that series, its returns,
 * and the filings' holders with the rest named for what it is.
 */
import { findMarketCompany, tickerLabel, type MarketCompany } from '../market-data/identity';
import { priceHistory } from '../market-data/prices/store';
import { isUnavailable, parseRange } from '../market-data/prices/series';
import { fundamentals } from '../market-data/fundamentals/read';
import { annualGrowth, type MetricId, type MetricSeries } from '../market-data/fundamentals/xbrl';
import { holders } from '../market-data/holders/read';
import { bigNumber, holdersChart, marketCap, priceResult } from '../market-data/present';
import { pageSlugFor } from '../market-data/company';
import { remember, type ToolEnv } from './ledger';
import { str, type ChatTool } from './tool';

const NOT_SEED =
  'Market data covers the listed companies in the seed list (lib/market-data/identity.ts) for now; for another company, use web_search and quote a dated page.';

/** The company page, when the directory has one. */
function pageOf(c: MarketCompany): string | null {
  const slug = pageSlugFor(c);
  return slug ? `/markets/${slug}` : null;
}

function note(env: ToolEnv, c: MarketCompany, evidence: string, url: string) {
  remember(env.ledger, {
    title: `${c.name} — ${evidence}`,
    href: pageOf(c) ?? url,
    kind: 'company',
    evidence,
    primary: [url],
  });
}

const company = (a: Record<string, unknown>) => findMarketCompany(str(a.company));

const fmt = (m: MetricSeries, p: { value: number }) =>
  m.unit === 'shares'
    ? `${p.value.toLocaleString('en-US')} shares`
    : `${bigNumber(p.value)} ${m.unit}`;

export const MARKET_TOOLS: readonly ChatTool[] = [
  {
    name: 'price_history',
    description:
      'Share-price history of a listed company (daily closes, end of day): the returns over 1M/3M/6M/YTD/1Y/5Y, 52-week high and low, largest fall, moving averages and, where it is meaningful, market value — all computed in code — plus a line chart the reader sees. Use for "how has X stock done", "share price of X", "X market cap". `range`: 1M, 3M, 6M, YTD, 1Y (default) or 5Y.',
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name or ticker, e.g. NVIDIA or NVDA' },
        range: { type: 'string', description: '1M, 3M, 6M, YTD, 1Y or 5Y' },
      },
      required: ['company'],
    },
    label: (a) => `Reading ${str(a.company) || 'the'} share-price history`,
    async run(a, env) {
      const c = company(a);
      if (!c)
        return {
          error: `No listed company called "${str(a.company)}" in the market data.`,
          note: NOT_SEED,
        };
      const range = parseRange(a.range);
      const h = await priceHistory(c.ticker, env.market);
      if (isUnavailable(h))
        return { company: c.name, ticker: tickerLabel(c.ticker), unavailable: h.reason };
      note(env, c, 'Share price', h.source.url);
      const out = priceResult(c, h, range, pageOf(c));
      const f = c.marketCap === true ? await fundamentals(c, env.market) : null;
      const shares =
        f && !('unavailable' in f)
          ? f.metrics.find((m) => m.metric === 'sharesOutstanding')
          : undefined;
      const cap = marketCap(
        c,
        h,
        shares && 'annual' in shares ? [...shares.annual, ...shares.quarterly] : [],
      );
      return { ...out, market_value: typeof cap === 'string' ? cap : cap.display };
    },
    budget: 4000,
  },
  {
    name: 'fundamentals',
    description:
      'Reported financials of a listed company from its SEC filings (XBRL): revenue, gross profit, operating income, net income, R&D, capital expenditure, cash, total assets, long-term debt and shares outstanding — annual (and quarterly for US filers), each with its period, form and filing link, and year-on-year growth computed in code. Use for "revenue of X", "compare X and Y revenue growth", "is X profitable". Call once per company.',
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name or ticker' },
        metrics: {
          type: 'string',
          description:
            'Optional, comma-separated: revenue, netIncome, grossProfit, operatingIncome, researchAndDevelopment, capex, cash, totalAssets, longTermDebt, sharesOutstanding',
        },
      },
      required: ['company'],
    },
    label: (a) => `Reading ${str(a.company) || 'the'} reported financials`,
    async run(a, env) {
      const c = company(a);
      if (!c)
        return {
          error: `No listed company called "${str(a.company)}" in the market data.`,
          note: NOT_SEED,
        };
      const f = await fundamentals(c, env.market);
      if ('unavailable' in f) return { company: c.name, unavailable: f.reason };
      note(env, c, 'Financials', f.source.url);
      const wanted = str(a.metrics)
        .split(/[,\s]+/)
        .filter(Boolean) as MetricId[];
      const metrics = f.metrics.filter((m) =>
        wanted.length
          ? wanted.includes(m.metric)
          : ['revenue', 'netIncome', 'operatingIncome'].includes(m.metric),
      );
      return {
        company: c.name,
        ...(pageOf(c) ? { page: pageOf(c) } : {}),
        filer: `${f.entityName} (SEC CIK ${f.cik})`,
        // Fiscal years end on different dates by company: compare them as labelled.
        metrics: metrics.map((m) =>
          'unavailable' in m
            ? { metric: m.label, unavailable: m.reason }
            : {
                metric: m.label,
                // Newest first: a result cut for length keeps the head of each list.
                annual_newest_first: [...m.annual]
                  .reverse()
                  .slice(0, 5)
                  .map((p) => ({
                    period: `fiscal year ending ${p.end}`,
                    value: fmt(m, p),
                    form: p.form,
                    filing: p.url,
                  })),
                ...(m.metric === 'revenue' || m.metric === 'netIncome'
                  ? {
                      growth_year_on_year: annualGrowth(m)
                        .reverse()
                        .slice(0, 4)
                        .map(
                          (g) => `${g.display}, fiscal year ending ${g.to.end} vs ${g.from.end}`,
                        ),
                    }
                  : {}),
                ...(m.quarterly.length
                  ? {
                      latest_quarters: [...m.quarterly]
                        .reverse()
                        .slice(0, 4)
                        .map((p) => ({
                          period: `${p.start} to ${p.end}`,
                          value: fmt(m, p),
                          form: p.form,
                          filing: p.url,
                        })),
                    }
                  : {}),
                reported_as: m.annual.at(-1)?.concept ?? m.quarterly.at(-1)?.concept,
              },
        ),
        notes: f.notes,
        source: `${f.source.name}: ${f.source.url}`,
      };
    },
    budget: 5000,
  },
  {
    name: 'holders',
    description:
      'Who holds a listed company\'s shares, from its filings: holders above 5% (Schedules 13G/13D, the proxy statement\'s ownership table), the directors and officers, recent insider trades (Form 4), each with its percent, date and filing link — and the rest as "Other holders (each below 5%; not itemised in filings)" with what that means. A share chart is shown to the reader. Use with or instead of ownership for "who owns X", "X\'s biggest shareholders", "insider holdings".',
    parameters: {
      type: 'object',
      properties: { company: { type: 'string', description: 'Company name or ticker' } },
      required: ['company'],
    },
    label: (a) => `Reading the shareholder filings${str(a.company) ? ` of ${str(a.company)}` : ''}`,
    async run(a, env) {
      const c = company(a);
      if (!c)
        return {
          error: `No listed company called "${str(a.company)}" in the market data.`,
          note: NOT_SEED,
        };
      const v = await holders(c, env.market);
      if ('unavailable' in v) return { company: c.name, unavailable: v.reason };
      const chart = holdersChart(c, v, pageOf(c));
      note(env, c, 'Holders', v.holders[0]?.source.url ?? 'https://www.sec.gov/');
      return {
        company: c.name,
        ...(pageOf(c) ? { page: `${pageOf(c)}#ownership` } : {}),
        holders: v.holders.map((h) => ({
          name: h.name,
          percent: `${h.percent}%`,
          as_of: h.asOf,
          kind: h.kind,
          source: `${h.source.label}: ${h.source.url}`,
          ...(h.inGroup ? { counted_in: 'Directors and executive officers as a group' } : {}),
          ...(h.note ? { note: h.note } : {}),
        })),
        rest: v.remainder
          ? {
              label: v.remainder.label,
              percent: `${v.remainder.percent}%`,
              what_it_is: v.remainder.explanation,
            }
          : v.remainderWhyNot,
        recent_insider_filings: v.insiders
          .slice(0, 4)
          .map(
            (i) =>
              `${i.owner} (${i.role}), Form 4 for ${i.date}: at least ${i.sharesReported.toLocaleString('en-US')} shares on the lines it reports — ${i.url}`,
          ),
        institutions: v.institutionsNote,
        notes: v.notes,
        read_on: v.fetchedAt.slice(0, 10),
        ...(chart ? { chart } : {}),
      };
    },
    budget: 4500,
  },
];
