/**
 * SEC filings by the companies that hold a bottleneck — the one news source
 * that is primary by construction: the company, to its regulator, timestamped.
 *
 * Pure: parsing EDGAR's submissions JSON and labelling what a filing is. The
 * fetch and the table live in lib/filings-store.ts.
 */

/** Forms that can move a thesis. Proxy statements, insider forms and the like are left out. */
export const FORMS = [
  '8-K',
  '8-K/A',
  '6-K',
  '10-K',
  '10-Q',
  '20-F',
  '40-F',
  'SC 13D',
  'SC 13D/A',
] as const;

/** 8-K items, as the SEC names them (Form 8-K General Instructions). */
export const ITEM_LABEL: Record<string, string> = {
  '1.01': 'Material agreement',
  '1.02': 'Material agreement terminated',
  '1.03': 'Bankruptcy or receivership',
  '1.05': 'Cybersecurity incident',
  '2.01': 'Acquisition or disposal completed',
  '2.02': 'Results of operations',
  '2.03': 'New debt obligation',
  '2.04': 'Debt obligation accelerated',
  '2.05': 'Exit or disposal costs',
  '2.06': 'Material impairment',
  '3.01': 'Delisting notice',
  '3.02': 'Unregistered equity sale',
  '3.03': 'Change to shareholder rights',
  '4.01': 'Auditor change',
  '4.02': 'Past financials no longer reliable',
  '5.01': 'Change in control',
  '5.02': 'Director or officer change',
  '5.03': 'Charter or bylaw change',
  '5.07': 'Shareholder vote',
  '7.01': 'Regulation FD disclosure',
  '8.01': 'Other events',
  '9.01': 'Financial statements and exhibits',
};

/** Items that are paperwork around another item, not news in themselves. */
const QUIET_ITEMS = new Set(['9.01']);

export const FORM_LABEL: Record<string, string> = {
  '8-K': 'Current report',
  '8-K/A': 'Current report, amended',
  '6-K': 'Foreign issuer report',
  '10-K': 'Annual report',
  '10-Q': 'Quarterly report',
  '20-F': 'Annual report (foreign issuer)',
  '40-F': 'Annual report (Canadian issuer)',
  'SC 13D': 'Activist stake (over 5%)',
  'SC 13D/A': 'Activist stake, amended',
};

export interface Filing {
  accession: string;
  cik: number;
  company: string;
  form: string;
  filedOn: string;
  /** EDGAR acceptance time, ISO. */
  acceptedAt: string;
  items: string[];
  description: string;
  url: string;
}

interface Recent {
  accessionNumber: string[];
  filingDate: string[];
  acceptanceDateTime: string[];
  form: string[];
  items: string[];
  primaryDocument: string[];
  primaryDocDescription: string[];
}

export function parseSubmissions(
  json: { cik?: string | number; name?: string; filings?: { recent?: Partial<Recent> } },
  sinceDate: string,
): Filing[] {
  const recent = json.filings?.recent;
  const cik = Number(json.cik);
  if (!recent?.accessionNumber || !Number.isFinite(cik)) return [];
  const out: Filing[] = [];
  recent.accessionNumber.forEach((accession, i) => {
    const form = recent.form?.[i] ?? '';
    const filedOn = recent.filingDate?.[i] ?? '';
    if (!(FORMS as readonly string[]).includes(form) || filedOn < sinceDate) return;
    const doc = recent.primaryDocument?.[i] ?? '';
    const accepted = recent.acceptanceDateTime?.[i];
    out.push({
      accession,
      cik,
      company: json.name ?? '',
      form,
      filedOn,
      acceptedAt:
        accepted && Number.isFinite(Date.parse(accepted))
          ? new Date(accepted).toISOString()
          : `${filedOn}T00:00:00.000Z`,
      items: (recent.items?.[i] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      description: recent.primaryDocDescription?.[i] ?? '',
      url: doc
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, '')}/${doc}`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
    });
  });
  return out;
}

/** "ASML — Foreign issuer report" / "Wolfspeed — Results of operations; Material agreement". */
export function filingHeadline(
  f: Pick<Filing, 'form' | 'items' | 'description'>,
  company: string,
): string {
  const items = f.items.filter((i) => !QUIET_ITEMS.has(i)).map((i) => ITEM_LABEL[i] ?? `Item ${i}`);
  const what = items.length > 0 ? items.join('; ') : (FORM_LABEL[f.form] ?? f.form);
  return `${company} — ${what}`;
}
