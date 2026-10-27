/**
 * Schedule 13G and 13D: what a holder of more than 5% of a class files about
 * itself. Since December 2024 both are structured XML on EDGAR
 * (`primary_doc.xml`, namespace http://www.sec.gov/edgar/schedule13g or
 * …/schedule13d), with the issuer's CIK, the holder's name, the shares and
 * the percent of the class as the filer computed it, and the date of the
 * event that required the filing. Older filings are free text; for those the
 * percent is read from the cover page's "Percent of class represented by
 * amount in row (9/11/13)" line, and left null when that line is not found.
 *
 * Two traps the parser handles, both seen on NVIDIA's own filing list:
 *   - A company's EDGAR filing list includes 13Gs it FILED about others
 *     (NVIDIA's stakes in Nebius and others). Only filings whose issuer is the
 *     company are its holders: `issuerCik` is checked.
 *   - A holder can report 0%: Vanguard's March 2026 amendment says its
 *     funds' shares are now reported by separate Vanguard entities
 *     ("disaggregated"). A 0% amendment ends that filer's row; the new
 *     filer's own 13G starts another.
 */

export interface Schedule13 {
  form: string;
  issuerCik: number | null;
  /** The holder, as the cover page names it (the first reporting person). */
  holder: string;
  shares: number | null;
  /** Percent of the class, as the filer computed it. */
  percent: number | null;
  /** The event date that required the filing, YYYY-MM-DD. */
  eventDate: string | null;
  /** "IA" investment adviser, "HC" parent holding company, "IN" individual, … */
  holderType: string | null;
  /** The class the percent is of ("Common Stock", "Ordinary Shares"). */
  classTitle: string | null;
  /** The filer's cover-page note, when it explains a change (disaggregation). */
  comment: string | null;
}

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? m[1].trim() : null;
};

const numberOf = (s: string | null): number | null => {
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** "03/13/2026" → "2026-03-13". */
const usDate = (s: string | null): string | null => {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');

/** A structured (XML) Schedule 13G/13D. Null when the body is not one. */
export function parseSchedule13Xml(xml: string): Schedule13 | null {
  if (!/schedule13[gd]/i.test(xml)) return null;
  // The first reporting person's block; several persons on one cover usually report the same shares.
  const person = tag(xml, 'coverPageHeaderReportingPersonDetails') ?? xml;
  const holder = tag(person, 'reportingPersonName') ?? tag(xml, 'filingPersonName');
  if (!holder) return null;
  return {
    form: tag(xml, 'submissionType') ?? 'SCHEDULE 13G',
    issuerCik: numberOf(tag(xml, 'issuerCik')),
    holder: decode(holder),
    shares: numberOf(
      tag(person, 'reportingPersonBeneficiallyOwnedAggregateNumberOfShares') ??
        tag(person, 'aggregateAmountOwned'),
    ),
    percent: numberOf(tag(person, 'classPercent') ?? tag(person, 'percentOfClass')),
    eventDate: usDate(tag(xml, 'eventDateRequiresFilingThisStatement') ?? tag(xml, 'dateOfEvent')),
    holderType: tag(person, 'typeOfReportingPerson'),
    classTitle: (() => {
      const t = tag(xml, 'securitiesClassTitle');
      return t ? decode(t) : null;
    })(),
    comment: (() => {
      const c = tag(person, 'comments');
      return c ? decode(c).replace(/\s+/g, ' ').slice(0, 400) : null;
    })(),
  };
}

/**
 * A pre-2025 text 13G: the percent from the cover page. Only the FIRST
 * reporting person's line is read, and only when it is a plain number.
 */
export function percentFromText(text: string): number | null {
  const m = text
    .replace(/\s+/g, ' ')
    .match(
      /percent of class represented by amount in row \(?\s*(?:9|11|13)\s*\)?\s*:?\s*(\d{1,3}(?:\.\d+)?)\s*%/i,
    );
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 100 ? n : null;
}

/** The raw XML of a structured filing: EDGAR lists the rendered "xsl…/<name>.xml". */
export function rawXmlUrl(documentUrl: string): string {
  return documentUrl.replace(/\/xsl[^/]+\/([^/]+\.xml)$/, '/$1');
}

export const SCHEDULE_FORMS = /^(SC 13[GD]|SCHEDULE 13[GD])(\/A)?$/;
