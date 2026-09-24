/**
 * The grant feeds: NSF, OpenAIRE (EU CORDIS and national funders) and DOE
 * awards via USAspending. Pure, like `lib/science-sources.ts`, whose helpers
 * these share.
 */
import type { ScienceQuery } from '@/config/substrata-pipeline';
import type { ScienceItem } from './science';
import { arr, daysBefore, isoDay, num, obj, quoted, str } from './science-sources';

// ---------------------------------------------------------------- NSF

/** NSF's keyword search drops every hit when quoted phrases are OR-ed, so one phrase per call. */
export function nsfUrl(phrase: string, now: Date): string {
  const start = daysBefore(now, 1096);
  const params = new URLSearchParams({
    keyword: `"${phrase.replace(/"/g, '')}"`,
    printFields:
      'id,title,awardeeName,awardeeCountryCode,startDate,date,fundsObligatedAmt,abstractText,fundProgramName',
    dateStart: `${String(start.getUTCMonth() + 1).padStart(2, '0')}/${String(start.getUTCDate()).padStart(2, '0')}/${start.getUTCFullYear()}`,
    rpp: '25',
  });
  return `https://api.nsf.gov/services/v1/awards.json?${params}`;
}

/** NSF writes dates as MM/DD/YYYY. */
function usDate(v: unknown): string | null {
  const m = str(v)?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

export function parseNsf(json: unknown): ScienceItem[] {
  return arr(obj(obj(json).response).award).flatMap((a): ScienceItem[] => {
    const id = str(a.id);
    const title = str(a.title);
    if (!id || !title) return [];
    const on = usDate(a.date) ?? usDate(a.startDate);
    const awardee = str(a.awardeeName);
    return [
      {
        id: `nsf:${id}`,
        source: 'nsf',
        kind: 'grant',
        title,
        abstract: str(a.abstractText)?.replace(/\s+/g, ' ') ?? '',
        venue: null,
        year: on ? Number(on.slice(0, 4)) : null,
        publishedOn: on,
        url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${id}`,
        doi: null,
        pdfUrl: null,
        citations: null,
        institutions: awardee
          ? [{ name: awardee, type: null, country: str(a.awardeeCountryCode) }]
          : [],
        funder: 'US National Science Foundation',
        programme: str(a.fundProgramName),
        amount: Number(a.fundsObligatedAmt) || null,
        currency: 'USD',
      },
    ];
  });
}

// ---------------------------------------------------------------- OpenAIRE

/** OpenAIRE's project search takes one phrase at a time; the store calls this per phrase. */
export function openAireUrl(phrase: string, now: Date): string {
  const params = new URLSearchParams({
    search: `"${phrase.replace(/"/g, '')}"`,
    pageSize: '20',
    sortBy: 'startDate DESC',
    fromStartDate: isoDay(daysBefore(now, 1826)),
  });
  return `https://api.openaire.eu/graph/v1/projects?${params}`;
}

export function parseOpenAire(json: unknown): ScienceItem[] {
  return arr(obj(json).results).flatMap((p): ScienceItem[] => {
    const id = str(p.id);
    const title = str(p.title);
    const funding = obj(arr(p.fundings)[0]);
    const funderShort = str(funding.shortName);
    // NSF comes straight from NSF; a second copy would count twice.
    if (!id || !title || funderShort === 'NSF') return [];
    const code = str(p.code);
    const granted = obj(p.granted);
    const amount = num(granted.fundedAmount) || num(granted.totalCost) || null;
    const on = str(p.startDate);
    return [
      {
        id: `openaire:${id}`,
        source: 'openaire',
        kind: 'grant',
        title,
        abstract: str(p.summary) ?? '',
        venue: null,
        year: on ? Number(on.slice(0, 4)) : null,
        publishedOn: on,
        url:
          funderShort === 'EC' && code
            ? `https://cordis.europa.eu/project/id/${code}`
            : `https://explore.openaire.eu/search/project?projectId=${encodeURIComponent(id)}`,
        doi: null,
        pdfUrl: null,
        citations: null,
        institutions: [],
        funder: str(funding.name) ?? funderShort,
        programme: str(obj(funding.fundingStream).id) ?? str(p.callIdentifier),
        amount,
        currency: amount ? str(granted.currency) : null,
      },
    ];
  });
}

// ---------------------------------------------------------------- DOE via USAspending

export const USASPENDING_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';

export function usaSpendingBody(q: ScienceQuery, now: Date): string {
  return JSON.stringify({
    filters: {
      keywords: q.phrases,
      award_type_codes: ['02', '03', '04', '05'],
      agencies: [{ type: 'awarding', tier: 'toptier', name: 'Department of Energy' }],
      time_period: [{ start_date: isoDay(daysBefore(now, 1096)), end_date: isoDay(now) }],
    },
    fields: [
      'Award ID',
      'Recipient Name',
      'Start Date',
      'Award Amount',
      'Description',
      'generated_internal_id',
    ],
    limit: 25,
    sort: 'Start Date',
    order: 'desc',
  });
}

/** USAspending writes descriptions in capitals; shown in sentence case, words unchanged. */
export function sentenceCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function parseUsaSpending(json: unknown): ScienceItem[] {
  return arr(obj(json).results).flatMap((a): ScienceItem[] => {
    const internal = str(a.generated_internal_id);
    const awardId = str(a['Award ID']);
    const description = str(a.Description);
    if (!internal || !awardId || !description) return [];
    const on = str(a['Start Date']);
    const recipient = str(a['Recipient Name']);
    return [
      {
        id: `doe:${awardId}`,
        source: 'doe',
        kind: 'grant',
        title: sentenceCase(description),
        abstract: '',
        venue: null,
        year: on ? Number(on.slice(0, 4)) : null,
        publishedOn: on,
        url: `https://www.usaspending.gov/award/${internal}`,
        doi: null,
        pdfUrl: null,
        citations: null,
        institutions: recipient ? [{ name: recipient, type: null, country: 'US' }] : [],
        funder: 'US Department of Energy',
        programme: awardId.startsWith('DEAR') ? 'ARPA-E' : null,
        amount: num(a['Award Amount']),
        currency: 'USD',
      },
    ];
  });
}
