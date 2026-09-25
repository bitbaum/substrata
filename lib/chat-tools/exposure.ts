/**
 * The exposure screen, for the assistant: who holds a bottleneck, who rests on
 * it, and where each one's shares trade — with the listed-vs-parent status
 * spelled out on every row.
 *
 * Measured failure this exists for (2026-09-25): asked "which listed companies
 * are exposed to transformer lead times?" on /exposure, the model called
 * Hitachi Energy "listed". It is not — its parent Hitachi is (6501 JP), and
 * research/listings.json says so with status "parent". The answer had no
 * ticker in it because no tool carried one. Here the ticker and the status
 * travel together, in words a model repeats rather than reinterprets.
 */
import { VERIFICATION_LABEL } from '@/config/substrata-evidence';
import { companiesOn } from '../dependencies';
import { exposureRows, isListed, PRESSURE_WINDOW_DAYS, type ExposureRow } from '../exposure';
import { listingFor, listingForName, terminalTicker, type Listing } from '../listings';
import { remember } from './ledger';
import { findBottleneck, findCompany } from './resolve';
import { str, type ChatTool } from './tool';

/** One listing, as a sentence a model can repeat verbatim. */
export function listingLine(listing: Listing | null | undefined): string {
  if (!listing) return 'Listing not looked up (no directory page)';
  if (listing.status === 'private') return 'Private — no listed shares';
  if (listing.status === 'none-found') return 'No listing found';
  const lines = [listing.primary, listing.us]
    .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
    .map(terminalTicker);
  const tickers = [...new Set(lines)].join(', ') || 'ticker not recorded';
  return listing.status === 'parent'
    ? `NOT listed itself — its parent ${listing.parent ?? 'company'} is listed: ${tickers}`
    : `Listed: ${tickers}`;
}

function holderRow(r: ExposureRow) {
  return {
    company: r.company,
    ...(r.companySlug ? { page: `/markets/${r.companySlug}` } : {}),
    role: r.supplier ? 'part supplier' : 'maker',
    ...(r.role && r.role !== 'Makes it' ? { detail: r.role } : {}),
    evidence: VERIFICATION_LABEL[r.verification],
    listing: listingLine(r.listing),
  };
}

const NOTE =
  'Tickers are from research/listings.json (SEC EDGAR + OpenFIGI). "NOT listed itself" means only a parent trades — name the parent and its ticker. Nothing here is a share of supply, revenue exposure or a price.';

export const EXPOSURE_TOOLS: readonly ChatTool[] = [
  {
    name: 'listed_exposure',
    description:
      'The exposure screen: for a bottleneck, every recorded holder (maker or part supplier) and every company recorded as depending on or selling into it, each with its listing status and tickers ("Listed: 6503 JP", "NOT listed itself — its parent Hitachi is listed: 6501 JP"). For a company, its listing and the bottlenecks it holds. Use for listed / ticker / stock / exposure questions.',
    parameters: {
      type: 'object',
      properties: {
        bottleneck: { type: 'string', description: 'Bottleneck name or slug' },
        company: { type: 'string', description: 'Company name or slug' },
        listed_only: { type: 'boolean', description: 'Only rows with listed shares' },
      },
    },
    label: (a) =>
      `Reading listings and exposure${a.bottleneck || a.company ? ` for ${str(a.bottleneck) || str(a.company)}` : ''}`,
    async run(args, env) {
      const rows = exposureRows();
      const listedOnly = args.listed_only === true || args.listed_only === 'true';
      const b = str(args.bottleneck) ? findBottleneck(str(args.bottleneck)) : undefined;
      if (b) {
        const held = rows.filter((r) => r.bottleneckSlug === b.slug);
        remember(env.ledger, {
          title: b.name,
          href: `/bottlenecks/${b.slug}`,
          kind: 'bottleneck',
          evidence: 'listings from SEC EDGAR + OpenFIGI',
          primary: [],
        });
        const dependents = companiesOn(b.name).map((d) => ({
          company: d.from,
          relation: d.kind === 'needs' ? 'depends on it' : 'sells into it',
          listing: listingLine(listingForName(d.from)),
          source: d.source,
        }));
        return {
          bottleneck: b.name,
          page: `/bottlenecks/${b.slug}`,
          exposure_page: `/exposure?q=${encodeURIComponent(b.name)}`,
          binding_score: `${b.binding}/12 (analyst judgement)`,
          [`net_pressure_${PRESSURE_WINDOW_DAYS}d`]: held[0]?.netPressure ?? 0,
          holders: held.filter((r) => !listedOnly || isListed(r)).map(holderRow),
          companies_resting_on_it: dependents.filter(
            (d) => !listedOnly || !/^(Private|No listing|Listing not)/.test(d.listing),
          ),
          note: NOTE,
        };
      }
      const p = str(args.company) ? findCompany(str(args.company)) : undefined;
      if (p) {
        return {
          company: p.name,
          page: `/markets/${p.slug}`,
          listing: listingLine(listingFor(p.slug)),
          holds: rows
            .filter((r) => r.companySlug === p.slug)
            .map((r) => ({
              bottleneck: r.bottleneck,
              page: `/bottlenecks/${r.bottleneckSlug}`,
              role: r.supplier ? 'part supplier' : 'maker',
              evidence: VERIFICATION_LABEL[r.verification],
              other_makers_recorded: r.otherMakers,
            })),
          note: NOTE,
        };
      }
      if (str(args.bottleneck) || str(args.company))
        return {
          error: `No bottleneck or company called "${str(args.bottleneck) || str(args.company)}".`,
        };
      // No target: the most binding listed rows, as the screen sorts them.
      const top = rows
        .filter((r) => !listedOnly || isListed(r))
        .sort((x, y) => y.binding - x.binding || y.netPressure - x.netPressure)
        .slice(0, 14);
      return {
        exposure_page: '/exposure',
        rows: top.map((r) => ({ bottleneck: r.bottleneck, ...holderRow(r) })),
        note: NOTE,
      };
    },
  },
];
