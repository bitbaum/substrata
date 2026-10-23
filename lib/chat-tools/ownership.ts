/**
 * Who owns a company, for the assistant: its status (listed, private,
 * subsidiary of whom), every holder on record with the share read off a
 * document and the document, and the honesty state of each row spelled out
 * — "no figure on record" is an answer the model must repeat, not fill in.
 *
 * Same discipline as exposure.ts: the ticker and the status travel together,
 * and nothing here is a market-data feed. Asked "who owns ASML", the model
 * had only the listing line and guessed; now it has the annual report's
 * table with its as-of date.
 */
import { HOLDER_KIND_LABEL } from '@/config/substrata-ownership';
import { listingFor } from '../listings';
import { ownershipView } from '../ownership';
import { listingLine } from './exposure';
import { remember } from './ledger';
import { findCompany } from './resolve';
import { str, type ChatTool } from './tool';

const NOTE =
  'Shares are as of the date on each row, read from the document linked. "no figure on record" means the holder is named by a lead only — say so, never estimate a percentage. Nothing here is a price, a market share or advice.';

export const OWNERSHIP_TOOLS: readonly ChatTool[] = [
  {
    name: 'ownership',
    description:
      'Who owns a company: listed, private or a subsidiary (of whom), its largest holders on record with the share each holds and the annual report, proxy or notice it was read from, and the unnamed remainder. Use for "who owns X", "is X public", "who are X\'s investors", "is X state-owned".',
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name or slug' },
      },
      required: ['company'],
    },
    label: (a) => `Reading ownership${str(a.company) ? ` of ${str(a.company)}` : ''}`,
    async run(args, env) {
      const p = str(args.company) ? findCompany(str(args.company)) : undefined;
      if (!p) return { error: `No company called "${str(args.company)}" in the directory.` };
      const view = ownershipView(p.slug);
      remember(env.ledger, {
        title: p.name,
        href: `/markets/${p.slug}#ownership`,
        kind: 'company',
        evidence:
          view.holders.length > 0
            ? `${view.sourced.length} of ${view.holders.length} holders sourced`
            : 'from the listing record',
        primary: [],
      });
      return {
        company: p.name,
        page: `/markets/${p.slug}#ownership`,
        status: view.line,
        ...(view.parent ? { parent: view.parent, shares_are_of: view.parent } : {}),
        listing: listingLine(listingFor(p.slug)),
        holders: view.holders.map((h) => ({
          name: h.name,
          kind: HOLDER_KIND_LABEL[h.kind],
          share: h.share === null ? 'no figure on record' : `${h.share}%`,
          // The plain number a `share` chart block takes (0–100); null stays null.
          share_pct: h.share,
          as_of: h.asOf,
          source: h.source,
          ...(h.note ? { note: h.note } : {}),
        })),
        ...(view.rest !== null
          ? {
              other_holders_and_public_float: `${Number(view.rest.toFixed(2))}%`,
              other_pct: Number(view.rest.toFixed(2)),
            }
          : {}),
        ...(view.holders.length === 0
          ? {
              holders_note: `No holder of ${view.parent ?? p.name} has been read off a document yet.`,
            }
          : {}),
        note: NOTE,
      };
    },
  },
];
