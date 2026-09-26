/**
 * Network re-derivations against the registries a dataset was built from:
 * tickers against the SEC ticker file and OpenFIGI, and USGS table values
 * against the chapter PDF. Each returns one verdict per row, with the link.
 */
import listingsFile from '@/research/listings.json';
import mcs from '@/research/usgs-mcs.json';
import type { Listing } from '@/lib/listings';
import type { UsgsChapter } from '@/lib/resources/usgs';
import { pageText } from './page-text';

const SEC_AGENT = 'Substrata research cato@orangecat.ch';

export interface RowVerdict {
  check: string;
  key: string;
  ok: boolean | null;
  detail: string;
  url: string;
}

type Traded = Extract<Listing, { primary: unknown }>;
function tradedListings(): [string, Traded][] {
  return Object.entries((listingsFile as { listings: Record<string, Listing> }).listings).filter(
    (e): e is [string, Traded] => e[1].status === 'listed' || e[1].status === 'parent',
  );
}

/** Every distinct SEC line: US primaries, and ADR/OTC lines that differ from them. */
export function secLines() {
  return tradedListings().flatMap(([slug, l]) =>
    (
      [
        ['primary', l.primary],
        ['us', l.us],
      ] as const
    ).flatMap(([which, line]) =>
      line?.cik &&
      !(which === 'us' && l.primary?.cik === line.cik && l.primary.ticker === line.ticker)
        ? [{ key: `${slug}:${which}`, line }]
        : [],
    ),
  );
}

/** Every SEC line against company_tickers_exchange.json. */
export async function secVerdicts(): Promise<RowVerdict[]> {
  const response = await fetch('https://www.sec.gov/files/company_tickers_exchange.json', {
    headers: { 'User-Agent': SEC_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`SEC ticker file: HTTP ${response.status}`);
  const file = (await response.json()) as { data: [number, string, string, string][] };
  const byCik = new Map<number, { ticker: string; exchange: string }[]>();
  for (const [cik, , ticker, exchange] of file.data)
    byCik.set(cik, [...(byCik.get(cik) ?? []), { ticker, exchange }]);
  return secLines().map(({ key, line }) => {
    const lines = byCik.get(line.cik!) ?? [];
    const hit = lines.find((x) => x.ticker === line.ticker);
    return {
      check: 'sec',
      key,
      ok: Boolean(hit),
      detail: hit
        ? `${line.ticker} on ${hit.exchange}`
        : lines.length
          ? `SEC now lists CIK ${line.cik} as ${lines.map((x) => `${x.ticker} (${x.exchange})`).join(', ')}`
          : `CIK ${line.cik} is not in the SEC ticker file`,
      url: line.source,
    };
  });
}

/** A slice of OpenFIGI lines: does the FIGI still map to the ticker and exchange the file records? */
export async function figiVerdicts(slugs: readonly string[]): Promise<RowVerdict[]> {
  const lines = tradedListings().flatMap(([slug, l]) =>
    slugs.includes(slug) && l.primary?.figi ? [{ slug, line: l.primary }] : [],
  );
  const out: RowVerdict[] = [];
  for (let i = 0; i < lines.length; i += 10) {
    const batch = lines.slice(i, i + 10);
    const response = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        batch.map(({ line }) => ({ idType: 'ID_BB_GLOBAL', idValue: line.figi })),
      ),
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 429) break;
    if (!response.ok) throw new Error(`OpenFIGI mapping: HTTP ${response.status}`);
    const body = (await response.json()) as {
      data?: { ticker: string; exchCode: string; name: string }[];
      error?: string;
    }[];
    batch.forEach(({ slug, line }, j) => {
      const hit = body[j]?.data?.[0];
      out.push({
        check: 'figi',
        key: slug,
        // exchCode can carry the venue's name: "TT (Taiwan Stock Exchange)".
        ok: hit
          ? hit.ticker === line.ticker && hit.exchCode.split(' ')[0] === line.exchange
          : false,
        detail: hit
          ? `OpenFIGI: ${hit.ticker} ${hit.exchCode} "${hit.name}"`
          : (body[j]?.error ?? 'no mapping'),
        url: line.source,
      });
    });
    // Unkeyed OpenFIGI allows 25 mapping requests a minute.
    await new Promise((r) => setTimeout(r, 2600));
  }
  return out;
}

export function figiSlugs(): string[] {
  return tradedListings().flatMap(([slug, l]) => (l.primary?.figi ? [slug] : []));
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * A table row as the PDF lays it out: the line that names it plus the lines
 * under it that start with no word (numbers, footnote marks, an "e"), where a
 * superscript pushed a value down (Argentina⁵ 13,800 … prints on two lines).
 */
export function rowWindows(text: string): { head: string; text: string }[] {
  const lines = text.split('\n');
  const out: { head: string; text: string }[] = [];
  lines.forEach((line, i) => {
    if (!/^\s*[A-Z]/.test(line)) return;
    const window = [line];
    for (
      let j = i + 1;
      j < lines.length && lines[j].trim() && !/^\s*[A-Z][a-z]/.test(lines[j]);
      j++
    )
      window.push(lines[j]);
    out.push({ head: squash(line), text: window.join(' ').replace(/\s+/g, ' ') });
  });
  return out;
}

/** One MCS chapter: is each row's printed value on the row that names that country in the PDF? */
export async function mcsVerdicts(slug: string): Promise<RowVerdict[]> {
  const ch = (mcs.chapters as unknown as UsgsChapter[]).find((c) => c.slug === slug);
  if (!ch) return [];
  const windows = rowWindows(await pageText(ch.url));
  return ch.rows.map((row) => {
    const head = squash(row.name).slice(0, 12);
    const raws = Object.values(row.cells)
      .map((c) => c.raw)
      .filter((r) => /\d/.test(r));
    const hit = windows.find(
      (w) => w.head.startsWith(head) && raws.every((r) => w.text.includes(r)),
    );
    return {
      check: 'usgs-pdf',
      key: `${slug}:${row.name}`,
      ok: raws.length === 0 ? null : Boolean(hit),
      detail: hit
        ? hit.text.trim().slice(0, 140)
        : `no row names ${row.name} with ${raws.join(' ')}`,
      url: ch.url,
    };
  });
}

export function mcsSlugs(): string[] {
  return mcs.chapters.map((c) => c.slug);
}
