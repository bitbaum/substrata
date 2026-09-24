/**
 * Fetching filings from EDGAR into research_filings, and reading them back.
 *
 * EDGAR asks for a descriptive User-Agent with a contact and at most ten
 * requests a second; one request per registrant an hour is far inside that.
 */
import { database } from './db';
import { edgarRegistrants } from './listings';
import { parseSubmissions, type Filing } from './filings';

const USER_AGENT = 'Substrata research cato@orangecat.ch';
/** How far back a first fetch reaches. Later runs only add what is new. */
const BACKFILL_DAYS = 120;
const GAP_MS = 200;

export interface FilingRun {
  registrants: number;
  filingsNew: number;
  failed: number;
}

export async function fetchFilings(): Promise<FilingRun> {
  const db = database();
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_filing_runs DEFAULT VALUES RETURNING id',
  );
  const since = new Date(Date.now() - BACKFILL_DAYS * 86_400_000).toISOString().slice(0, 10);
  const outcome: FilingRun = { registrants: 0, filingsNew: 0, failed: 0 };

  for (const registrant of edgarRegistrants()) {
    outcome.registrants += 1;
    try {
      const cik = String(registrant.cik).padStart(10, '0');
      const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(String(response.status));
      for (const f of parseSubmissions(await response.json(), since)) {
        const inserted = await db.query(
          `INSERT INTO research_filings
             (accession, cik, company, form, filed_on, accepted_at, items, description, url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (accession) DO NOTHING`,
          [
            f.accession,
            f.cik,
            f.company,
            f.form,
            f.filedOn,
            f.acceptedAt,
            f.items,
            f.description,
            f.url,
          ],
        );
        outcome.filingsNew += inserted.rowCount ?? 0;
      }
    } catch {
      outcome.failed += 1;
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }

  await db.query(
    `UPDATE research_filing_runs
        SET finished_at = now(), registrants = $2, filings_new = $3, failed = $4
      WHERE id = $1`,
    [run.rows[0].id, outcome.registrants, outcome.filingsNew, outcome.failed],
  );
  return outcome;
}

/** Filings by these registrants within `days`, newest first. */
export async function filingsFor(ciks: readonly number[], days = 45): Promise<Filing[]> {
  if (ciks.length === 0) return [];
  const result = await database().query<{
    accession: string;
    cik: number;
    company: string;
    form: string;
    filed_on: Date;
    accepted_at: Date;
    items: string[];
    description: string;
    url: string;
  }>(
    `SELECT accession, cik, company, form, filed_on, accepted_at, items, description, url
       FROM research_filings
      WHERE cik = ANY($1::int[])
        AND accepted_at > now() - ($2::float8 * interval '1 day')
      ORDER BY accepted_at DESC
      LIMIT 300`,
    [ciks, days],
  );
  return result.rows.map((row) => ({
    accession: row.accession,
    cik: row.cik,
    company: row.company,
    form: row.form,
    filedOn: row.filed_on.toISOString().slice(0, 10),
    acceptedAt: row.accepted_at.toISOString(),
    items: row.items,
    description: row.description,
    url: row.url,
  }));
}

/** When filings were last fetched: the desk's freshness line for this source. */
export async function lastFilingRun(): Promise<string | null> {
  const result = await database().query<{ finished_at: Date }>(
    'SELECT finished_at FROM research_filing_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1',
  );
  return result.rows[0]?.finished_at.toISOString() ?? null;
}
