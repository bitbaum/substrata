/**
 * Where the company page's own sections sit among the shared modules.
 *
 * The registry (lib/profile/modules) orders modules by one importance scale.
 * Four sections on a company page are the page's, not the registry's, because
 * their data is per request (sweep leads, SEC filings, open roles) or needs
 * those rows (ways to take part). They take their place on the same scale
 * from here, so the reading order the owner asked for is one list a test can
 * hold: header → share price → key statistics → role in the chain (listed
 * companies) → financials → what it holds →
 * ownership → how it does business → numbers → what has happened → unread
 * leads → what could loosen its grip → ways to take part → hiring → others at
 * the same step → peers → what it connects to → sources → discussion. The
 * market frame is the same on every company (docs/design/company-page.md).
 */
export const COMPANY_SECTION_IMPORTANCE = {
  // The market frame (components/company/marketSections.tsx,
  // docs/design/company-page.md): first after the header, on every company.
  price: 6,
  'key-stats': 7,
  // A listed company's role in the chain (the lede and the five tiles) reads
  // after its quote and key statistics, as on a quote page; an unlisted one
  // keeps it in the header and has no such section.
  'chain-role': 7.5,
  financials: 8,
  chokepoints: 10,
  ownership: 20,
  business: 25,
  numbers: 30,
  events: 40,
  leads: 45,
  relief: 50,
  'take-part': 55,
  hiring: 58,
  'same-layer': 60,
  peers: 62,
  related: 88,
  sources: 89,
  discussion: 90,
} as const;

export type CompanySectionId = keyof typeof COMPANY_SECTION_IMPORTANCE;

/** The reading order, as ids. */
export const COMPANY_SECTION_ORDER: readonly CompanySectionId[] = (
  Object.entries(COMPANY_SECTION_IMPORTANCE) as [CompanySectionId, number][]
)
  .sort((a, b) => a[1] - b[1])
  .map(([id]) => id);

/** How many unread leads show before "All n". */
export const LEADS_SHOWN = 3;
