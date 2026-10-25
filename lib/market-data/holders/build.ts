/**
 * Who owns a listed company, from its filings: the itemised holders, and the
 * rest as a TYPED remainder that says what it is.
 *
 * WHAT "VANGUARD 7.3% / BLACKROCK 7.4%" MEANS. Asset managers file a Schedule
 * 13G once the shares their funds and client accounts hold pass 5% of a
 * class. The figure is BENEFICIAL ownership under SEC rules — shares they can
 * vote or sell for clients, mostly index funds — not the firm's own money,
 * and it is as of the event date on the filing, not today. The company's
 * proxy statement repeats those figures in its ownership table, recomputed on
 * its record-date share count ("based solely on Schedules 13G/A"); that is
 * where NVIDIA's 7.43% (BlackRock) and 7.31% (Vanguard Capital Management)
 * on its page come from, as of 2026-03-23. A figure like "Vanguard 8.9%"
 * from an older filing is the same kind of number from another date — which
 * is why every row here carries its date and its filing.
 *
 * WHAT THE REST IS. Everyone else: thousands of institutions and millions of
 * individuals each below 5%, whom no filing names one by one. 13F is filed
 * per MANAGER (its whole portfolio), not per company, so it is not summed
 * here into a list of one company's holders: the institutions shown come
 * from 13G/13D and the proxy only, and the data says so. The remainder is
 * `{label, percent, explanation}` — never a bare "Other 87%".
 *
 * Merging, in order:
 *   1. The newest proxy table (DEF 14A): holders with a percentage, and the
 *      directors-and-officers group.
 *   2. Structured 13G/13D filed AFTER that proxy, newest per filer: a 0%
 *      amendment removes that holder's row; any other replaces or adds it.
 *   3. With neither (foreign filers file no proxy), the committed ownership
 *      rows in config/substrata-ownership.ts, each read off an annual report.
 */
import type { Holder } from '@/config/substrata-ownership';
import type { InsiderFiling } from './insiders';
import type { ProxyTable } from './proxy';
import type { Schedule13 } from './schedule13';

export type HolderKind =
  'institution' | 'insider' | 'insider-group' | 'state' | 'strategic' | 'other';

export interface ItemisedHolder {
  name: string;
  /** Percent of the class, as the document states it. */
  percent: number;
  shares: number | null;
  kind: HolderKind;
  /** The date the figure is as of, YYYY-MM-DD (or YYYY). */
  asOf: string;
  source: { label: string; url: string };
  /** Counted inside the directors-and-officers group row, so not added again. */
  inGroup?: boolean;
  note?: string;
}

export interface Remainder {
  label: 'Other holders (each below 5%; not itemised in filings)';
  /** The legend's short form. */
  short: 'Others, each below 5%';
  percent: number;
  explanation: string;
}

export interface HoldersView {
  company: string;
  holders: ItemisedHolder[];
  remainder: Remainder | null;
  /** Why there is no remainder, when there is none. */
  remainderWhyNot: string | null;
  /** Recent Form 4s: trades after the proxy's record date. */
  insiders: (InsiderFiling & { url: string })[];
  /** Where the institutions come from, in a sentence, always. */
  institutionsNote: string;
  notes: string[];
}

export const REMAINDER_EXPLANATION =
  'Everyone else: institutions and individuals each holding less than 5%, whom no filing names one by one (Schedules 13G and 13D are filed only above 5%; 13F lists each fund manager’s whole portfolio, not one company’s holders, so it is not summed here). The named rows are of different dates and can overlap where two filers count the same shares, so this is 100 minus the named figures, not a measured holding.';

export const INSTITUTIONS_NOTE =
  'Institutions are shown from Schedules 13G/13D and the proxy statement only — the holders above 5%. Per-manager 13F reports are not aggregated per company here.';

const INSTITUTION =
  /\b(inc|llc|l\.?p|ltd|limited|group|management|capital|investors|advisers|advisors|partners|fund|funds|corporation|corp|company|n\.a|pty|plc|ag|se|holdings|bank|associates|affiliates|international)\b/i;

export const holderKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[.,]/g, '')
    .replace(/\b(inc|llc|lp|ltd|corp|corporation|co|and affiliates?)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface HoldersInput {
  company: string;
  proxy: { table: ProxyTable; url: string; filed: string } | null;
  schedules: { s: Schedule13; url: string; filed: string; filerCik: number }[];
  insiders: (InsiderFiling & { url: string })[];
  fallback: readonly Holder[];
  fallbackFrom?: string;
  /** Several share classes (from the seed): no remainder is computed. */
  multiClass?: boolean;
}

function fromProxy(p: NonNullable<HoldersInput['proxy']>): ItemisedHolder[] {
  const hasGroup = p.table.rows.some((r) => r.group);
  return p.table.rows.map((r) => {
    const kind: HolderKind = r.group
      ? 'insider-group'
      : INSTITUTION.test(r.name)
        ? /government/i.test(r.name)
          ? 'state'
          : 'institution'
        : r.name.toLowerCase().includes('government')
          ? 'state'
          : 'insider';
    return {
      name: r.name,
      percent: r.percent,
      shares: r.shares,
      kind,
      asOf: r.asOf ?? p.filed,
      source: { label: `Proxy statement (DEF 14A) filed ${p.filed}`, url: p.url },
      ...(kind === 'insider' && hasGroup ? { inGroup: true } : {}),
      ...(r.asOf ? {} : { note: 'The table states no date; dated by its filing.' }),
    };
  });
}

/** Pure: the merged holders and the typed remainder. */
const FALLBACK_KIND: Record<Holder['kind'], HolderKind> = {
  fund: 'institution',
  founder: 'insider',
  state: 'state',
  strategic: 'strategic',
  'public-float': 'other',
};

function fromFallback(input: HoldersInput): ItemisedHolder[] {
  return input.fallback
    .filter((h): h is Holder & { share: number } => h.share !== null && h.kind !== 'public-float')
    .map((h): ItemisedHolder => ({
      name: h.name,
      percent: h.share,
      shares: null,
      kind: FALLBACK_KIND[h.kind],
      asOf: h.asOf,
      source: { label: input.fallbackFrom ?? 'Annual report', url: h.source },
      ...(h.note ? { note: h.note } : {}),
    }));
}

export function buildHolders(input: HoldersInput): HoldersView {
  // Without a proxy (foreign filers file none), the annual report's rows are the base.
  const holders = input.proxy ? fromProxy(input.proxy) : fromFallback(input);
  const notes: string[] = [];
  // A 13G/13D changes the picture only if filed after the date the base's figures are of.
  const since = input.proxy ? (input.proxy.table.asOf ?? input.proxy.filed) : '';
  const after = input.schedules
    .filter((x) => x.filed > since || (!input.proxy && !holders.some((h) => h.asOf >= x.filed)))
    .sort((a, b) => (a.filed < b.filed ? 1 : -1));
  const seen = new Set<number>();
  for (const x of after) {
    if (seen.has(x.filerCik) || x.s.percent === null) continue;
    seen.add(x.filerCik);
    const key = holderKey(x.s.holder);
    const at = holders.findIndex((h) => holderKey(h.name) === key);
    if (x.s.percent < 1) {
      if (at >= 0) holders.splice(at, 1);
      notes.push(
        `${x.s.holder} reported ${x.s.percent}% on ${x.s.form} filed ${x.filed}, below the 5% that requires the filing${x.s.comment ? `: “${x.s.comment.slice(0, 200)}”` : '.'}`,
      );
      continue;
    }
    const row: ItemisedHolder = {
      name: x.s.holder,
      percent: x.s.percent,
      shares: x.s.shares,
      kind: x.s.holderType === 'IN' ? 'insider' : 'institution',
      asOf: x.s.eventDate ?? x.filed,
      source: { label: `${x.s.form} filed ${x.filed}`, url: x.url },
      note: [
        `Percent of ${x.s.classTitle ?? 'the class'} as the filer computed it, on its event date.`,
        x.s.percent < 5
          ? 'Below 5%: an exit filing, after which the holder no longer reports changes.'
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    };
    if (at >= 0) holders[at] = row;
    else holders.push(row);
  }
  holders.sort((a, b) => b.percent - a.percent);
  const counted = holders.filter((h) => !h.inGroup);
  const sum = counted.reduce((s, h) => s + h.percent, 0);
  if (holders.some((h) => h.inGroup))
    notes.push(
      'Directors and officers named one by one are counted once, through the “as a group” row.',
    );
  let remainder: Remainder | null = null;
  let remainderWhyNot: string | null = null;
  if (input.multiClass || input.proxy?.table.multiClass)
    remainderWhyNot =
      'The company has several share classes and the filing states each holder’s percent of one class, so the named rows cannot be added into one whole.';
  else if (!holders.length) remainderWhyNot = 'No holder above 5% is named in the filings read.';
  else if (sum > 100)
    remainderWhyNot =
      'The named figures add to more than 100%, because filers count overlapping shares; no remainder is computed.';
  else
    remainder = {
      label: 'Other holders (each below 5%; not itemised in filings)',
      short: 'Others, each below 5%',
      percent: round2(100 - sum),
      explanation: REMAINDER_EXPLANATION,
    };
  return {
    company: input.company,
    holders,
    remainder,
    remainderWhyNot,
    insiders: input.insiders,
    institutionsNote: INSTITUTIONS_NOTE,
    notes,
  };
}
