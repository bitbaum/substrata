/**
 * Where a directory row's name is not the name its shares trade under.
 *
 * `scripts/research/listings.ts` looks every company up by name. That fails
 * three ways, and each is handled here by hand rather than guessed:
 *
 * - a division or subsidiary trades only through its parent (Hitachi Energy
 *   is Hitachi). The listing shown is the parent's, marked as such, because a
 *   position in the parent is a diluted position in the chokepoint;
 * - the company is privately held, so there is nothing to find;
 * - the trading name differs enough that a name search misses it (TSMC);
 * - OpenFIGI truncates or decorates the name so no strict match is possible
 *   ("TAIWAN SEMICONDUCTOR MANUFAC", "NKT A/S"). Those get a PINNED home line:
 *   ticker, exchange and the exact OpenFIGI name, each read off an OpenFIGI
 *   mapping by hand. The generator accepts the line only if all three still
 *   match, so a pin cannot drift onto another security — and the matcher in
 *   lib/listing-match.ts stays as strict as it is.
 *
 * Only relationships that are public and settled belong here. A company that
 * is simply not found stays "no listing found" — that is an honest answer,
 * and a wrong parent is not.
 */

/** A home line checked by hand on OpenFIGI's mapping API. */
export interface PinnedLine {
  ticker: string;
  /** Bloomberg composite code, as in HOME_COMPOSITE. */
  exchange: string;
  /** The security's name exactly as OpenFIGI returns it, truncation included. */
  figiName: string;
  /** When the pin was read, for a reviewer. */
  checkedOn: string;
}

export type ListingOverride =
  | {
      parent: string;
      query: string;
      note: string;
      /** The parent's home markets, when they differ from the subsidiary's. */
      jurisdictions?: string[];
      home?: PinnedLine;
    }
  | { private: string }
  | { query?: string; home?: PinnedLine };

const PINNED_ON = '2026-09-25';
const TSMC_TT: PinnedLine = {
  ticker: '2330',
  exchange: 'TT',
  figiName: 'TAIWAN SEMICONDUCTOR MANUFAC',
  checkedOn: PINNED_ON,
};

export const LISTING_OVERRIDES: Record<string, ListingOverride> = {
  // Trades through a listed parent.
  'hitachi-energy': {
    parent: 'Hitachi',
    query: 'HITACHI LTD',
    note: 'Hitachi Energy is a wholly owned subsidiary of Hitachi.',
  },
  'samsung-foundry': {
    parent: 'Samsung Electronics',
    query: 'SAMSUNG ELECTRONICS',
    note: 'A business of Samsung Electronics.',
  },
  'samsung-memory': {
    parent: 'Samsung Electronics',
    query: 'SAMSUNG ELECTRONICS',
    note: 'A business of Samsung Electronics.',
  },
  'intel-foundry': { parent: 'Intel', query: 'INTEL CORP', note: 'A business of Intel.' },
  'tsmc-advanced-packaging': {
    parent: 'TSMC',
    query: 'TAIWAN SEMICONDUCTOR MANUFACTURING',
    note: 'A business of TSMC.',
    home: TSMC_TT,
  },
  'abb-robotics': { parent: 'ABB', query: 'ABB LTD', note: 'A business of ABB.' },
  'amazon-web-services': { parent: 'Amazon', query: 'AMAZON.COM', note: 'A business of Amazon.' },
  google: {
    parent: 'Alphabet',
    query: 'ALPHABET INC',
    note: 'Google is a subsidiary of Alphabet.',
  },
  'sk-siltron': {
    parent: 'SK Inc.',
    query: 'SK INC',
    note: 'SK Siltron is a subsidiary of SK Inc.',
  },
  'sk-siltron-css': {
    parent: 'SK Inc.',
    query: 'SK INC',
    note: 'A US subsidiary of SK Siltron, itself a subsidiary of SK Inc.',
  },
  kuka: {
    parent: 'Midea Group',
    query: 'MIDEA GROUP',
    note: 'Midea took KUKA private in 2022.',
    jurisdictions: ['CN', 'HK'],
  },
  'element-six': {
    parent: 'Anglo American',
    query: 'ANGLO AMERICAN PLC',
    note: 'Element Six is part of the De Beers Group, owned by Anglo American.',
  },
  'thyssenkrupp-electrical-steel': {
    parent: 'thyssenkrupp',
    query: 'THYSSENKRUPP AG',
    note: 'A business of thyssenkrupp.',
  },

  // Privately held: nothing trades.
  openai: { private: 'Privately held.' },
  anthropic: { private: 'Privately held.' },
  xai: { private: 'Privately held.' },
  heraeus: { private: 'Family-owned.' },
  trumpf: { private: 'Family-owned.' },
  messer: { private: 'Family-owned.' },
  'carl-zeiss-smt': { private: 'Part of Carl Zeiss AG, owned by the Carl Zeiss Foundation.' },

  // Trades under a name a search for the short name misses.
  tsmc: { query: 'TAIWAN SEMICONDUCTOR MANUFACTURING', home: TSMC_TT },
  meta: { query: 'META PLATFORMS' },
  chalco: { query: 'ALUMINUM CORP OF CHINA' },
  nornickel: { query: 'NORILSK NICKEL' },
  amd: { query: 'ADVANCED MICRO DEVICES' },
  supermicro: { query: 'SUPER MICRO COMPUTER' },
  umc: {
    query: 'UNITED MICROELECTRONICS',
    home: {
      ticker: '2303',
      exchange: 'TT',
      figiName: 'UNITED MICROELECTRONICS CORP',
      checkedOn: PINNED_ON,
    },
  },
  amsc: { query: 'AMERICAN SUPERCONDUCTOR' },
  smic: {
    query: 'SEMICONDUCTOR MANUFACTURING INTERNATIONAL',
    // Hong Kong is SMIC's original listing (2004); the Shanghai STAR line
    // 688981 CH ("SEMICONDUCTOR MANUFACTURIN-A") is a second one.
    home: {
      ticker: '981',
      exchange: 'HK',
      figiName: 'SEMICONDUCTOR MANUFACTURI-H',
      checkedOn: PINNED_ON,
    },
  },

  // Names OpenFIGI truncates or decorates past what a strict match accepts.
  'ase-technology': {
    home: {
      ticker: '3711',
      exchange: 'TT',
      figiName: 'ASE TECHNOLOGY HOLDING CO LT',
      checkedOn: PINNED_ON,
    },
  },
  globalwafers: {
    home: { ticker: '6488', exchange: 'TT', figiName: 'GLOBALWAFERS CO LTD', checkedOn: PINNED_ON },
  },
  // Rio Tinto plc's London line; the directory row's jurisdiction is Canada
  // (its operations), where no Rio Tinto share trades.
  'rio-tinto': {
    home: { ticker: 'RIO', exchange: 'LN', figiName: 'RIO TINTO PLC', checkedOn: PINNED_ON },
  },
  nkt: { home: { ticker: 'NKT', exchange: 'DC', figiName: 'NKT A/S', checkedOn: PINNED_ON } },
  yaskawa: {
    home: {
      ticker: '6506',
      exchange: 'JP',
      figiName: 'YASKAWA ELECTRIC CORP',
      checkedOn: PINNED_ON,
    },
  },
};
