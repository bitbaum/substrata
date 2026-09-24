/**
 * Where a job is, from the free text an applicant-tracking system gives.
 *
 * Greenhouse hands over a location string the employer typed ("Chicago, IL /
 * Toronto, ON", "Taiwan > Hsinchu", "Remote-Friendly | San Francisco, CA");
 * Ashby and Lever add a country field. This turns either into ISO-2 codes. A
 * place it cannot name is left out rather than guessed — the posting keeps its
 * location text, and the country filter simply does not find it.
 */

const COUNTRY_NAMES: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  us: 'US',
  canada: 'CA',
  mexico: 'MX',
  brazil: 'BR',
  chile: 'CL',
  peru: 'PE',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  scotland: 'GB',
  ireland: 'IE',
  netherlands: 'NL',
  'the netherlands': 'NL',
  belgium: 'BE',
  germany: 'DE',
  france: 'FR',
  switzerland: 'CH',
  austria: 'AT',
  italy: 'IT',
  spain: 'ES',
  portugal: 'PT',
  poland: 'PL',
  'czech republic': 'CZ',
  czechia: 'CZ',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  estonia: 'EE',
  romania: 'RO',
  hungary: 'HU',
  israel: 'IL',
  'united arab emirates': 'AE',
  uae: 'AE',
  'saudi arabia': 'SA',
  qatar: 'QA',
  india: 'IN',
  china: 'CN',
  'hong kong': 'HK',
  taiwan: 'TW',
  japan: 'JP',
  'south korea': 'KR',
  korea: 'KR',
  'republic of korea': 'KR',
  singapore: 'SG',
  malaysia: 'MY',
  philippines: 'PH',
  vietnam: 'VN',
  thailand: 'TH',
  indonesia: 'ID',
  australia: 'AU',
  'new zealand': 'NZ',
  'south africa': 'ZA',
};

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' ',
  ),
);
const CA_PROVINCES = new Set('AB BC MB NB NL NS ON PE QC SK'.split(' '));

const US_STATE_NAMES = new Set(
  [
    'arizona',
    'california',
    'colorado',
    'florida',
    'georgia',
    'idaho',
    'illinois',
    'massachusetts',
    'michigan',
    'new jersey',
    'new york',
    'north carolina',
    'ohio',
    'oregon',
    'pennsylvania',
    'texas',
    'utah',
    'virginia',
    'washington',
  ].map((s) => s),
);

/** Cities that appear bare, without a country, on the boards Substrata reads. */
const CITIES: Record<string, string> = {
  'san francisco': 'US',
  'new york': 'US',
  'new york city': 'US',
  seattle: 'US',
  austin: 'US',
  boston: 'US',
  phoenix: 'US',
  chandler: 'US',
  'palo alto': 'US',
  'mountain view': 'US',
  'san jose': 'US',
  'los angeles': 'US',
  'washington dc': 'US',
  london: 'GB',
  dublin: 'IE',
  paris: 'FR',
  munich: 'DE',
  berlin: 'DE',
  zurich: 'CH',
  amsterdam: 'NL',
  eindhoven: 'NL',
  veldhoven: 'NL',
  almere: 'NL',
  tokyo: 'JP',
  seoul: 'KR',
  hsinchu: 'TW',
  taipei: 'TW',
  tainan: 'TW',
  kaohsiung: 'TW',
  taichung: 'TW',
  bangalore: 'IN',
  bengaluru: 'IN',
  shanghai: 'CN',
  beijing: 'CN',
  singapore: 'SG',
  sydney: 'AU',
  toronto: 'CA',
  vancouver: 'CA',
  'tel aviv': 'IL',
};

function one(piece: string): string | null {
  const text = piece.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  const lower = text.toLowerCase();
  if (COUNTRY_NAMES[lower]) return COUNTRY_NAMES[lower];
  if (CITIES[lower]) return CITIES[lower];
  if (US_STATE_NAMES.has(lower)) return 'US';
  if (US_STATES.has(text)) return 'US';
  if (CA_PROVINCES.has(text)) return 'CA';
  return null;
}

/**
 * ISO-2 codes named by a location string, in order, without repeats.
 *
 * Splits on the separators employers use between places ("/", "|", ";", " or ")
 * and reads each place from its most specific end: "Hsinchu, Taiwan" and
 * "Taiwan > Hsinchu" both land on TW, "Phoenix, AZ" on US.
 */
export function countriesIn(text: string): string[] {
  const out: string[] = [];
  for (const place of text.split(/\s*(?:\/|\||;|\bor\b|\n)\s*/i)) {
    const parts = place
      .split(/\s*(?:,|>|-|–|\(|\))\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    let found: string | null = null;
    for (const part of [...parts].reverse()) {
      found = one(part);
      if (found) break;
    }
    if (!found) found = one(place);
    if (found && !out.includes(found)) out.push(found);
  }
  return out;
}

/** A country name or code from a structured field ("United States", "us"). */
export function countryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return one(trimmed);
}

const DISPLAY = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  try {
    return DISPLAY.of(code) ?? code;
  } catch {
    return code;
  }
}
