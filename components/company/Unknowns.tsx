import { connection } from 'next/server';

import { neighbours } from '@/lib/graph/index';
import {
  fundamentalsOf,
  holdersOf,
  listingOf,
  pricesOf,
  expectNameOf,
} from '@/lib/company-page/load';
import { mergeUnknowns, readUnknowns, staticUnknowns } from '@/lib/company-page/unknowns';
import { noListingReason } from '@/lib/market-data/company';
import { isUnavailable } from '@/lib/market-data/prices/series';
import { correctionUrl } from '@/lib/site';
import { universeEntry } from '@/lib/universe/store';
import { SourceNote } from './parts';

/**
 * What the page could not fill, one row each: the thing, why, the documents
 * that would fill it, and where to send them. Each row is also a task in the
 * work queue (`company:<slug>#<box>`), so a gap is a request, not an apology.
 */
export async function Unknowns({ slug, name }: { slug: string; name: string }) {
  await connection();
  const c = listingOf(slug);
  const [h, f, o] = c
    ? await Promise.all([
        pricesOf(c.ticker.exchange, c.ticker.symbol, expectNameOf(c)),
        fundamentalsOf(slug),
        holdersOf(slug),
      ])
    : [null, null, null];
  const reason = (x: object | null) =>
    x && 'unavailable' in x ? ((x as { reason?: string }).reason ?? null) : null;
  const list = mergeUnknowns(
    staticUnknowns({
      slug,
      name,
      entry: universeEntry(slug),
      listed: Boolean(c),
      noListing: c ? undefined : noListingReason(slug),
      relations: neighbours(`company:${slug}`).length,
    }),
    readUnknowns(slug, {
      price: h && isUnavailable(h) ? h.reason : null,
      financials: reason(f),
      holders: reason(o),
    }),
  );
  if (!list.length)
    return (
      <SourceNote>
        Nothing this page shows is missing for lack of a source we know. Each figure above names its
        own filing and date.
      </SourceNote>
    );
  return (
    <>
      <ol className="mk-rows">
        {list.map((u) => (
          <li key={u.task.id} className="mk-row">
            <span className="mk-row-name">{u.label}</span>
            <span className="mk-row-detail">
              {u.missing} Would be filled by: {u.sources.join('; ')}.{' '}
              <a
                href={correctionUrl(`${name} — ${u.label}`, {
                  problem: `Evidence for ${name}: ${u.label}. Task ${u.task.id}.`,
                })}
                rel="noreferrer"
              >
                Send evidence on {u.label.toLowerCase()}
              </a>
            </span>
          </li>
        ))}
      </ol>
      <SourceNote>
        Each row is a task in the work queue ({list.length} for this company). Nothing missing is
        estimated.
      </SourceNote>
    </>
  );
}
