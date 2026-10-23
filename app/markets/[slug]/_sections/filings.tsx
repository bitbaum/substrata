import { filingsFor } from '@/lib/filings-store';
import type { Filing } from '@/lib/filings';
import { listingFor } from '@/lib/listings';

/**
 * The company's own recent filings with the SEC, newest first, for the
 * "what has happened" axis and list (lib/profile/modules/company.tsx). Only
 * for a company EDGAR has a registrant for; a build or a box without the
 * table shows nothing rather than failing the page.
 */
export async function filingsOf(slug: string): Promise<Filing[]> {
  const l = listingFor(slug);
  const cik = l && (l.status === 'listed' || l.status === 'parent') ? l.us?.cik : undefined;
  if (!cik) return [];
  try {
    return (await filingsFor([cik], 120)).slice(0, 8);
  } catch {
    return [];
  }
}
