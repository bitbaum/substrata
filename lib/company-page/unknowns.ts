/**
 * "What we do not know yet" for one company: each thing a quote page would
 * show and this page cannot, said once with the reason, the documents that
 * would fill it, and a work-queue task (`company:<slug>#<box>`) a data agent
 * can pick up. Pure: the page passes in what its sections read, and
 * `staticUnknowns` is what is known without any network read, so the same rule
 * lists the whole universe's gaps (scripts/research/company-gaps.ts).
 *
 * Nothing here estimates a figure. A gap is a gap.
 */
import type { GapTask } from '@/lib/graph/types';
import type { UniverseEntry } from '@/lib/universe/types';

export interface Unknown {
  /** The box: `listing`, `prices`, `financials`, `holders`, `relations`, `identity`, `country`. */
  box: string;
  label: string;
  missing: string;
  sources: readonly string[];
  task: GapTask;
}

const WRITE_TO = 'config/candidates/universe.json (facet universe) or the facet the task names';

const FILINGS_HOME =
  'its annual report as a PDF (read with a page locator through scripts/research/add.ts)';

function unknown(
  slug: string,
  box: string,
  label: string,
  missing: string,
  sources: readonly string[],
): Unknown {
  return {
    box,
    label,
    missing,
    sources,
    task: {
      id: `company:${slug}#${box}`,
      entity: `company:${slug}`,
      box,
      status: 'empty',
      missing,
      allowedSources: [...sources],
      writeTo: WRITE_TO,
      demand: 0,
    },
  };
}

export interface UnknownsInput {
  slug: string;
  name: string;
  entry?: UniverseEntry;
  /** Whether a share price line could be built for it at all. */
  listed: boolean;
  /** Why not, when not (lib/market-data/company noListingReason). */
  noListing?: string;
  /** Relations the graph holds for it. */
  relations: number;
}

/** Gaps that follow from the identifiers and relations alone: no network read. */
export function staticUnknowns(i: UnknownsInput): Unknown[] {
  const out: Unknown[] = [];
  const ids = i.entry?.ids ?? {};
  if (!i.listed)
    out.push(
      unknown(
        i.slug,
        'listing',
        'Share price and quote',
        i.noListing ??
          'No source read names an exchange line the price source can serve for it, so there is no quote.',
        [
          'the exchange’s own page for the issuer, naming its ticker',
          'a GLEIF record or a filing that states the listing',
        ],
      ),
    );
  else if (!ids.cik)
    out.push(
      unknown(
        i.slug,
        'financials',
        'Financial statements and holders',
        `It files nothing with the SEC (no CIK in any source read), so no revenue, margin, cash, debt, share count or shareholder list is read for it. No figure is estimated.`,
        [FILINGS_HOME, 'the exchange’s filing archive, with the page quoted'],
      ),
    );
  if (!ids.lei)
    out.push(
      unknown(
        i.slug,
        'identity',
        'Legal entity identifier',
        'No LEI was found in GLEIF for it by its ISIN, so its legal entity and country are not confirmed by a registry.',
        ['a GLEIF record (search.gleif.org) naming the legal entity'],
      ),
    );
  if (i.entry && !i.entry.country)
    out.push(
      unknown(
        i.slug,
        'country',
        'Country',
        'No registry gave its legal address and the listing venue does not name a country.',
        ['a GLEIF record’s legal address', 'the issuer’s annual report cover'],
      ),
    );
  if (i.relations === 0)
    out.push(
      unknown(
        i.slug,
        'relations',
        'Customers, suppliers and competitors',
        'No published relation names it as a customer, supplier, competitor, owner or operator, so nothing is drawn about who it does business with.',
        [
          '10-K Item 1 or a 20-F business section naming customers and competitors',
          'a government or agency table naming it as operator or owner',
        ],
      ),
    );
  return out;
}

export interface ReadResults {
  /** The reason, when the close series could not be read; null when it was. */
  price: string | null;
  financials: string | null;
  holders: string | null;
}

/** The gaps a read just found, beyond the static ones. */
export function readUnknowns(slug: string, r: ReadResults): Unknown[] {
  const out: Unknown[] = [];
  if (r.price)
    out.push(
      unknown(slug, 'prices', 'Price history', r.price, [
        'the exchange’s own end-of-day history for the line',
      ]),
    );
  if (r.financials)
    out.push(
      unknown(slug, 'financials', 'Financial statements', r.financials, [
        'SEC EDGAR XBRL company facts (10-K, 20-F, 40-F)',
        FILINGS_HOME,
      ]),
    );
  if (r.holders)
    out.push(
      unknown(slug, 'holders', 'Shareholders', r.holders, [
        'a proxy statement (DEF 14A) or an annual report’s ownership table',
        'Schedules 13G and 13D',
      ]),
    );
  return out;
}

/** One list, no box twice: a static gap and a read gap about the same box merge to the read one. */
export function mergeUnknowns(...lists: Unknown[][]): Unknown[] {
  const byBox = new Map<string, Unknown>();
  for (const u of lists.flat()) byBox.set(u.box, u);
  return [...byBox.values()];
}
