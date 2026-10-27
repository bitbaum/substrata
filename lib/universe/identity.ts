/**
 * One company, one slug, however many sources name it. Rows from a fund file,
 * EDGAR, GLEIF and Wikidata are joined by their strongest shared key —
 * CUSIP/ISIN, then CIK, then ticker on its venue, then the normalised name —
 * never by a guess: a row with no shared key is a new company.
 */
import { slugify } from '@/lib/links';
import { nameKey } from '@/lib/sources/name-key';
import { displayName } from './store';

export interface Keys {
  cusip?: string;
  isin?: string;
  cik?: string;
  qid?: string;
  ticker?: string;
  exchange?: string;
  name?: string;
}

/** "STMicroelectronics N.V." and "STMICROELECTRONICS NV" are one name. */
const nameOf = (name: string) => nameKey(displayName(name).replace(/\./g, ''));

function keysOf(k: Keys): string[] {
  return [
    k.isin && `isin:${k.isin}`,
    k.cusip && `cusip:${k.cusip}`,
    k.cik && `cik:${Number(k.cik)}`,
    k.qid && `qid:${k.qid}`,
    k.ticker && `ticker:${k.ticker.toUpperCase()}|${(k.exchange ?? 'US').toUpperCase()}`,
    k.name && nameOf(k.name) && `name:${nameOf(k.name)}`,
  ].filter((x): x is string => Boolean(x));
}

export class IdentityIndex {
  private bySlugKey = new Map<string, string>();
  private taken = new Set<string>();
  /** Slugs to reuse for a new company by name: a stub's, so a stub is promoted, not duplicated. */
  constructor(private reuse: Map<string, string> = new Map()) {}

  /** The stub slugs this index may hand out. */
  reused(): string[] {
    return [...this.reuse.values()];
  }

  /** The slug these keys already resolve to, if any. */
  find(k: Keys): string | undefined {
    for (const key of keysOf(k)) {
      const hit = this.bySlugKey.get(key);
      if (hit) return hit;
    }
    return undefined;
  }

  /** Record keys for a known slug (a directory company, or one already resolved). */
  add(slug: string, k: Keys): string {
    this.taken.add(slug);
    for (const key of keysOf(k)) if (!this.bySlugKey.has(key)) this.bySlugKey.set(key, slug);
    return slug;
  }

  /** The slug for these keys: an existing one, else a new one (a stub's when the name matches). */
  resolve(k: Keys): string {
    const found = this.find(k);
    if (found) return this.add(found, k);
    const name = displayName(k.name ?? '');
    let slug = this.reuse.get(nameKey(name)) ?? slugify(nameOf(name)) ?? '';
    if (!slug) slug = slugify(`${k.ticker ?? 'unnamed'}-${k.exchange ?? ''}`);
    if (this.taken.has(slug)) slug = slugify(`${slug}-${k.exchange ?? k.cik ?? 'x'}`);
    while (this.taken.has(slug)) slug = `${slug}-2`;
    return this.add(slug, k);
  }
}
