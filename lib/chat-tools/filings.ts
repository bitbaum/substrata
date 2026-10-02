/**
 * SEC filings, for the assistant: the 8-K / 6-K current reports the site
 * collects from EDGAR for the listed companies on the chains. Asked what
 * recent filings said, the assistant answered that the corpus held none.
 *
 * What a filing record carries is its form, its 8-K items (what KIND of news:
 * results, a material agreement, an exit…) and its link — not its text. The
 * tool says so, so the model reports what was filed rather than inventing
 * what it says.
 */
import { FORM_LABEL, ITEM_LABEL } from '../filings';
import { edgarRegistrants } from '../listings';
import { MARKET_PARTICIPANTS } from '../participants';
import { findCompany } from './resolve';
import { num, str, type ChatTool } from './tool';

export const FILING_TOOLS: ChatTool[] = [
  {
    name: 'recent_filings',
    description:
      "Recent SEC current reports (8-K, 6-K) from listed companies on the chains: form, date, what kind of news each item is, and the link to read it on EDGAR. Give a company, or omit it for the newest filings across all tracked companies. Records carry the filing's kind and link, not its text.",
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        days: { type: 'number', description: 'Look-back window, default 45' },
      },
    },
    label: (a) => `Reading SEC filings${str(a.company) ? ` from ${str(a.company)}` : ''}`,
    available: (env) => Boolean(env.filings),
    async run(a, env) {
      if (!env.filings) return { error: 'The filings store is not reachable from here.' };
      const registrants = edgarRegistrants();
      let ciks = registrants.map((r) => r.cik);
      const p = str(a.company) ? findCompany(str(a.company)) : undefined;
      if (str(a.company)) {
        if (!p) return { error: `No company called "${str(a.company)}" in the directory.` };
        const own = registrants.filter((r) => r.slugs.includes(p.slug)).map((r) => r.cik);
        if (!own.length)
          return {
            company: p.name,
            note: `${p.name} files nothing with the SEC that the site tracks (not a US-registered issuer, or no listing recorded).`,
          };
        ciks = own;
      }
      const filings = await env.filings(ciks, num(a.days, 45, 1, 365));
      const nameOf = new Map(
        registrants.flatMap((r) =>
          r.slugs.map(
            (slug) =>
              [r.cik, MARKET_PARTICIPANTS.find((m) => m.slug === slug)?.name ?? r.name] as const,
          ),
        ),
      );
      return {
        ...(p ? { company: p.name } : {}),
        filings: filings.slice(0, 12).map((f) => ({
          company: nameOf.get(f.cik) ?? f.company,
          form: `${f.form} — ${FORM_LABEL[f.form] ?? f.form}`,
          filed: f.filedOn,
          items: f.items.filter((i) => i !== '9.01').map((i) => ITEM_LABEL[i] ?? `Item ${i}`),
          about: f.description || undefined,
          link: `[${f.form} ${f.filedOn}](${f.url})`,
        })),
        status:
          'Filed with the SEC (primary source). The record holds the kind of news, not the text: say what was filed and link it; do not describe contents you have not read.',
        ...(filings.length === 0 ? { note: 'No current reports in that window.' } : {}),
      };
    },
  },
];
