/**
 * Where the company page's own sections sit among the shared modules.
 *
 * The registry (lib/profile/modules) orders modules by one importance scale.
 * Four sections on a company page are the page's, not the registry's, because
 * their data is per request (sweep leads, SEC filings, open roles) or needs
 * those rows (ways to take part). They take their place on the same scale
 * from here, so the reading order the owner asked for is one list a test can
 * hold: header → at a glance → what it holds → ownership → numbers → what
 * has happened → unread leads → what could loosen its grip → ways to take
 * part → hiring → others at the same step → what it connects to → sources →
 * discussion.
 */
export const COMPANY_SECTION_IMPORTANCE = {
  chokepoints: 10,
  ownership: 20,
  numbers: 30,
  events: 40,
  leads: 45,
  relief: 50,
  'take-part': 55,
  hiring: 58,
  'same-layer': 60,
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
