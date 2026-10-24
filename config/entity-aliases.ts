/**
 * Reviewed name pairs: two printed spellings of ONE organisation, merged in
 * the relation graph. Nothing else merges.
 *
 * The graph mints an id from the name a source prints (`lib/graph/parties.ts`),
 * so a typesetting slip in a yearbook ("NAC Kazatomp JSC" for "NAC Kazatomprom
 * JSC") becomes a second node, and a question about Kazatomprom misses a
 * venture. `pnpm run research:alias-candidates` PROPOSES pairs with the
 * evidence for each (lib/graph/alias-match.ts); a person reads the rows, and
 * only a pair written here is applied — by the USGS parser, so
 * `research/usgs-relations.json` carries the merged id, and by the store for
 * every other producer.
 *
 * Each entry must be justified from the data itself, in one line: the rows
 * that print both spellings, and why they cannot be two firms. A guess from a
 * name alone does not belong here; a subsidiary is never an alias of its
 * parent (Glencore International AG and Uranium One Rotterdam B.V. are their
 * own nodes, owned by their parents through edges).
 */
import type { EntityId } from '@/lib/entities/types';

export interface EntityAlias {
  /** The id the second spelling was minted as. It disappears from the graph. */
  alias: EntityId;
  /** The spelling as the source printed it. */
  printed: string;
  /** The id every relation of the alias moves to. */
  canonical: EntityId;
  /** The canonical spelling, as the same source prints it. */
  name: string;
  /** Why these are one organisation, from the rows themselves. */
  reason: string;
  /** Where the reviewer read both spellings. */
  source: string;
  reviewedOn: string;
}

const USGS_KZ_2023 = 'https://pubs.usgs.gov/myb/vol3/2023/myb3-2023-kazakhstan.xlsx';
const USGS_AU_2023 = 'https://pubs.usgs.gov/myb/vol3/2023/myb3-2023-australia.xlsx';

export const ENTITY_ALIASES: readonly EntityAlias[] = [
  {
    alias: 'company:nac-kazatomp-jsc',
    printed: 'NAC Kazatomp JSC',
    canonical: 'company:nac-kazatomprom-jsc',
    name: 'NAC Kazatomprom JSC',
    reason:
      'The Kazakh uranium cell lists sixteen ventures; fifteen name their state partner "NAC Kazatomprom JSC" and PE Ortalyk LLP alone prints "NAC Kazatomp JSC" — the same word cut short in one row, same table, same year.',
    source: USGS_KZ_2023,
    reviewedOn: '2026-10-24',
  },
  {
    alias: 'company:uraniumone-inc',
    printed: 'UraniumOne Inc.',
    canonical: 'company:uranium-one-inc',
    name: 'Uranium One Inc.',
    reason:
      'The same Kazakh uranium cell prints "Uranium One Inc., 50%" in Akbastau JV and "UraniumOne Inc., 20%" in Kyzylkum LLP: one name with and without its space, beside the same partner (NAC Kazatomprom JSC). Its Dutch subsidiaries stay separate.',
    source: USGS_KZ_2023,
    reviewedOn: '2026-10-24',
  },
  {
    alias: 'company:glencore',
    printed: 'Glencore',
    canonical: 'company:glencore-plc',
    name: 'Glencore Plc.',
    reason:
      'The Australian table prints the Murrin Murrin nickel-cobalt mine twice in one year: "[Murrin Murrin Operations Pty. Ltd. (Glencore, 100%)]" and "[Murrin Murrin Pty. Ltd. (Glencore Plc., 100%)]" — the same holder with and without its legal form. Glencore International AG, a subsidiary, stays separate.',
    source: USGS_AU_2023,
    reviewedOn: '2026-10-24',
  },
];
