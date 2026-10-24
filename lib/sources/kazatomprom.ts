/**
 * Kazatomprom (NAC Kazatomprom JSC) investor relations: the newest integrated
 * annual report and the newest operations and trading update, both PDFs,
 * found by reading the company's own report pages — never a remembered URL.
 *
 * What the reports state about buyers, checked 2026-10-24 against the 2025
 * integrated report and the 2Q26 trading update:
 *   - sales by REGION (Americas, Asia, Europe, in per cent) — regions are not
 *     entities, so those figures are reported as records and skipped as rows;
 *   - "When transporting materials to China …" and "For supplies to the Russian
 *     Federation …" — each names a country it ships to: `ships_to`, stated;
 *   - "conversion facilities owned by companies such as … Cameco (Canada), and
 *     Orano (France)" — a delivery point owned by a firm, not a named buyer
 *     (title passes to the customer there): `ships_to`, graded `lead`.
 * Pure text matching on the extracted pages; the quote is the sentence itself.
 */
import type { SubmittedBy } from '@/lib/entry/candidate';
import { companyEndpoint, countryEndpoint } from './endpoints';
import { readDocument, type DocumentDeps, type DocumentRead } from './document';
import { bodyText, sourceFetch } from './http';
import { quoteText } from './pdf';
import { finalise, type AdapterResult, type Draft, type Skipped } from './proposal';
import { quoteAround } from './text';

export const KAP_ENDPOINT = 'company:nac-kazatomprom-jsc';
const SITE = 'https://www.kazatomprom.kz';
export const KAP_ANNUAL_PAGE = `${SITE}/en/investors/godovie_otcheti`;
export const KAP_UPDATES_PAGE = `${SITE}/en/investors/finansovaya_otchetnost`;

export interface KapReport {
  kind: 'annual-report' | 'trading-update';
  url: string;
  /** The year the report covers (annual) or the quarter's year (update). */
  year: number;
  quarter?: number;
}

/** Every PDF link on a page that names a report kind, newest first. */
export function findReportPdfs(html: string, kind: KapReport['kind']): KapReport[] {
  const out: KapReport[] = [];
  for (const m of html.matchAll(/href="([^"]+\.pdf)"/gi)) {
    const href = m[1];
    const file = href.split('/').pop()!.toLowerCase();
    const url = new URL(href, SITE).toString();
    if (kind === 'trading-update' && file.includes('trading_update')) {
      const q = /(?:^|_)(?:([1-4])q(\d{2})|q?([1-4])q?_?(\d{2})|(\d{2})q([1-4]))(?=_|\.)/.exec(
        file,
      );
      const quarter = Number(q?.[1] ?? q?.[3] ?? q?.[6]);
      const yy = Number(q?.[2] ?? q?.[4] ?? q?.[5]);
      if (quarter && !Number.isNaN(yy)) out.push({ kind, url, year: 2000 + yy, quarter });
    }
    if (kind === 'annual-report') {
      const y = /(?:^|_)(?:kap_)?(?:ir|ar|iar)_?(20\d{2})/.exec(file);
      if (y) out.push({ kind, url, year: Number(y[1]) });
    }
  }
  const seen = new Set<string>();
  return out
    .filter((r) => !seen.has(r.url) && seen.add(r.url))
    .sort((a, b) => b.year - a.year || (b.quarter ?? 0) - (a.quarter ?? 0));
}

const COUNTRY_SENTENCES = [
  /When transporting materials to ((?:the )?[A-Z][a-z]+(?: [A-Z][a-z]+)*),/g,
  /For supplies to (?:the )?([A-Z][a-z]+(?: [A-Z][a-z]+)*), the Group transports/g,
];
const CONVERSION =
  /The Group transports U3O8 to licensed conversion facilities owned by companies such as ([^.]+?(?:Inc\.[^.]*?)?)\./g;
const REGIONS = /principal export markets for the Group[’']s products are countries in ([^.]+)\./g;

/** Drafts from one report's pages; the record strings say what each was read from. */
export function kazatompromDrafts(pages: readonly string[], report: KapReport) {
  const drafts: Draft[] = [];
  const skipped: Skipped[] = [];
  const asOf = String(report.year);
  pages.forEach((raw, i) => {
    const page = quoteText(raw);
    const where = `${report.kind} ${report.year}${report.quarter ? ` Q${report.quarter}` : ''}, page ${i + 1}`;
    for (const rx of COUNTRY_SENTENCES) {
      for (const m of page.matchAll(rx)) {
        const name = m[1].replace(/^the /, '');
        const to = countryEndpoint(name);
        const quote = quoteAround(page, m.index!, m.index! + m[0].length);
        const label = `${where}: ships to ${name}`;
        if (!to) skipped.push({ record: label, reason: `"${name}" is not a country on the site` });
        else if (!quote)
          skipped.push({
            record: label,
            reason: 'sentence outside the 20–400 character quote bounds',
          });
        else
          drafts.push({
            from: KAP_ENDPOINT,
            to,
            type: 'ships_to',
            grade: 'stated',
            asOf,
            url: report.url,
            quote,
            label,
          });
      }
    }
    for (const m of page.matchAll(CONVERSION)) {
      // The match is the whole sentence: quote it, nothing around it.
      const quote = m[0].length <= 400 ? m[0] : null;
      // "A, Inc. (USA), B (Canada), and C (France)": each owner ends at its bracketed country.
      const owners = m[1].split(/\)\s*,?\s*(?:and\s+)?/).map((s) =>
        s
          .replace(/^and\s+/, '')
          .replace(/\s*\([^)]*\)?\s*$/, '')
          .trim(),
      );
      for (const owner of owners.filter(Boolean)) {
        const label = `${where}: delivers to a conversion facility owned by ${owner}`;
        const to = companyEndpoint(owner);
        if (to.id === null) skipped.push({ record: label, reason: to.reason });
        else if (!quote)
          skipped.push({ record: label, reason: 'sentence outside the quote bounds' });
        else
          drafts.push({
            from: KAP_ENDPOINT,
            to: to.id,
            type: 'ships_to',
            grade: 'lead',
            asOf,
            url: report.url,
            quote,
            note: 'A conversion facility this company owns is a delivery point, not a named buyer: title passes to the customer there.',
            label,
          });
      }
    }
    for (const m of page.matchAll(REGIONS))
      skipped.push({
        record: `${where}: export markets "${m[1]}"`,
        reason: 'regions are not entities; no row',
      });
    if (/BY REGION/.test(page) && /Americas/.test(page) && /Asia/.test(page))
      skipped.push({
        record: `${where}: sales by region table (Americas, Asia, Europe, per cent)`,
        reason:
          'regions are not entities; the per-country split is printed as a map graphic with no text',
      });
  });
  return { drafts, skipped };
}

export interface KazatompromOptions {
  /** Which reports: default both, newest of each. */
  kinds?: KapReport['kind'][];
  /** Read these PDF URLs instead of discovering them (still allow-listed). */
  urls?: KapReport[];
}

export async function runKazatomprom(
  submittedBy: SubmittedBy,
  opts: KazatompromOptions = {},
  deps: DocumentDeps = {},
): Promise<AdapterResult<KapReport>> {
  const reports: KapReport[] = opts.urls ? [...opts.urls] : [];
  if (!opts.urls) {
    for (const kind of opts.kinds ?? (['annual-report', 'trading-update'] as const)) {
      const page = await readRaw(
        kind === 'annual-report' ? KAP_ANNUAL_PAGE : KAP_UPDATES_PAGE,
        deps,
      );
      const newest = findReportPdfs(page, kind)[0];
      if (newest) reports.push(newest);
    }
  }
  const docs = new Map<string, DocumentRead>();
  const drafts: Draft[] = [];
  const skipped: Skipped[] = [];
  for (const report of reports) {
    const doc = await readDocument(report.url, deps);
    docs.set(report.url, doc);
    if (!doc.ok || !doc.pages) {
      skipped.push({ record: report.url, reason: doc.ok ? 'not a PDF' : doc.reason });
      continue;
    }
    const got = kazatompromDrafts(doc.pages, report);
    drafts.push(...got.drafts);
    skipped.push(...got.skipped);
  }
  const done = finalise(drafts, { adapter: 'kazatomprom', docs, submittedBy, ceiling: 'stated' });
  return {
    adapter: 'kazatomprom',
    records: reports,
    rows: done.rows,
    skipped: [...skipped, ...done.skipped],
  };
}

/** An IR page's HTML as served (the link list lives in it, not in the readable text). */
async function readRaw(url: string, deps: DocumentDeps): Promise<string> {
  return bodyText(await sourceFetch(url, 'text/html', deps));
}
