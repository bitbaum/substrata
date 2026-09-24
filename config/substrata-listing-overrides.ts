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
 * - the trading name differs enough that a name search misses it (TSMC).
 *
 * Only relationships that are public and settled belong here. A company that
 * is simply not found stays "no listing found" — that is an honest answer,
 * and a wrong parent is not.
 */

export type ListingOverride =
  { parent: string; query: string; note: string } | { private: string } | { query: string };

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
  kuka: { parent: 'Midea Group', query: 'MIDEA GROUP', note: 'Midea took KUKA private in 2022.' },
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
  tsmc: { query: 'TAIWAN SEMICONDUCTOR MANUFACTURING' },
  meta: { query: 'META PLATFORMS' },
  chalco: { query: 'ALUMINUM CORP OF CHINA' },
  nornickel: { query: 'NORILSK NICKEL' },
  amd: { query: 'ADVANCED MICRO DEVICES' },
  supermicro: { query: 'SUPER MICRO COMPUTER' },
  umc: { query: 'UNITED MICROELECTRONICS' },
  amsc: { query: 'AMERICAN SUPERCONDUCTOR' },
  smic: { query: 'SEMICONDUCTOR MANUFACTURING INTERNATIONAL' },
};
