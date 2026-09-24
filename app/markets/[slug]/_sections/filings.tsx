import { filingsFor } from '@/lib/filings-store';
import { FORM_LABEL, filingHeadline, type Filing } from '@/lib/filings';
import { listingFor } from '@/lib/listings';
import { whenLabel } from '@/lib/desk';

/**
 * The company's own recent filings with the SEC, newest first. Only for a
 * company EDGAR has a registrant for; a build or a box without the table
 * shows nothing rather than failing the page.
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

export function FilingList({ filings, company }: { filings: Filing[]; company: string }) {
  const now = new Date();
  return (
    <>
      <ul className="divide-y divide-subtle border-y border-subtle">
        {filings.map((f) => (
          <li key={f.accession} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
            <span
              className="rounded border border-strong px-1.5 font-mono text-xs text-fg-secondary"
              title={FORM_LABEL[f.form] ?? f.form}
            >
              SEC {f.form}
            </span>
            <span className="font-mono text-xs tabular-nums text-fg-tertiary" title={f.acceptedAt}>
              {whenLabel(f.acceptedAt, now)}
            </span>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-fg-primary underline-offset-4 hover:underline"
            >
              {filingHeadline(f, company).replace(`${company} — `, '')} ↗
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
        The company&rsquo;s own filings, from SEC EDGAR, fetched hourly. Substrata has not judged
        their effect on any bottleneck.
      </p>
    </>
  );
}
