/**
 * From a printed name to a graph endpoint.
 *
 * A relation joins two `EntityId`s, but most owners and operators a source
 * prints are not in the directory. They still need a stable id, or the same
 * firm printed in two tables becomes two nodes. So: a name the registry knows
 * resolves to that entity (by name, alias, or the name with its legal form
 * taken off); anything else gets a minted `company:<slug>` that the graph uses
 * as an endpoint and nothing more — no profile, no page, no claim beyond the
 * relations that cite it.
 *
 * Names that are not one organisation (private investors, "others", the free
 * float) resolve to nothing, and the caller counts them as skipped. "Government"
 * resolves to the country whose table printed it, because that is how the USGS
 * country chapters write it; any other public body is skipped rather than
 * guessed at.
 */
import { resolveEntity, resolveIn } from '@/lib/entities/registry';
import { aliasEntry } from './aliases';
import { entityId, type EntityId } from '@/lib/entities/types';

/** Legal forms and their abbreviations, as they appear before or after a firm's name. */
const LEGAL =
  'co|company|corp|corporation|inc|incorporated|ltd|limited|llc|llp|lp|plc|pllc|jsc|ojsc|pjsc|' +
  'sa|s\\.a|sas|s\\.a\\.s|sarl|s\\.a\\.r\\.l|sprl|spa|s\\.p\\.a|srl|gmbh|ag|kg|nv|n\\.v|bv|b\\.v|' +
  'pty|pte|bhd|sdn|tbk|pt|pao|oao|ao|ooo|zao|kk|k\\.k|asa|as|ab|oy|lda|ltda|scm|s\\.c\\.m|saa|' +
  's\\.a\\.a|sac|s\\.a\\.c|sab|s\\.a\\.b|de c\\.v|c\\.v|q\\.s\\.c|q\\.p\\.s\\.c|a\\.ş|t\\.a\\.ş|şti|' +
  'pvt|private|proprietary|jv|s\\.a\\.i\\.c|s\\.a\\.p';

const LEGAL_TOKEN = new RegExp(`(^|[\\s,(])(${LEGAL})\\.?(?=$|[\\s,)])`, 'i');

/** Words that make a name an organisation even without a legal form. */
const ORG_WORD =
  /\b(group|holdings?|enterprise|mining|minera|minero|mineração|minière|miniere|compañía|compania|companhia|compagnie|société|societe|sociedad|empresa|corporación|cooperativ[ae]|consortium|joint venture|venture|associates|fund|trust|bank|industries|madencilik|metals?|resources)\b/i;

/** Organisation by its legal form or an organisational word. */
export function looksLikeOrganisation(name: string): boolean {
  return LEGAL_TOKEN.test(name) || ORG_WORD.test(name);
}

/** Holders that are a category of investor, not one organisation. */
const NOT_ONE_PARTY =
  /^(the )?(private|public|others?|other\b.*|.*\binvestors?\b|.*\binverstors?\b|.*shareholders?\b|common shares|.*\bconsortium\b|foreign .*|domestic .*|institutional .*|minority .*|small miners\b.*|free float)$/i;

/** A public body that is not a whole country's government. */
const PUBLIC_BODY =
  /\b(government|ministry|department|office|administration|commission|presidential|state council|municipal|provincial)\b/i;

export type PartyResolution =
  | {
      id: EntityId;
      minted: boolean;
      /** A reviewed alias (config/entity-aliases.ts) moved it: the canonical spelling. */
      name?: string;
    }
  | { skip: 'not one party' | 'public body' | 'empty' };

export function slugOf(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/, '');
}

const TRAILING_LEGAL = new RegExp(`[\\s,]+(${LEGAL})\\.?$`, 'i');
const LEADING_LEGAL = new RegExp(`^(${LEGAL})\\.?\\s+`, 'i');

/** The name with its legal forms taken off both ends, repeatedly: "PAO Gazprom" → "Gazprom". */
export function bareName(name: string): string {
  let bare = name.trim();
  for (let i = 0; i < 4; i++) {
    const next = bare.replace(TRAILING_LEGAL, '').replace(LEADING_LEGAL, '').trim();
    if (next === bare) break;
    bare = next;
  }
  return bare;
}

function inRegistry(name: string): EntityId | undefined {
  for (const kind of ['company', 'capital'] as const) {
    const hit = resolveIn(kind, name);
    if (hit) return hit.id;
  }
  return undefined;
}

/**
 * Resolve a printed party. `iso2` is the country of the table it was printed
 * in (for "Government"); `abbr` is a short name printed beside it, tried
 * against the registry after the full name.
 */
export function resolveParty(
  printed: string,
  context: { iso2?: string; abbr?: string } = {},
): PartyResolution {
  const name = printed.replace(/\s+/g, ' ').trim();
  if (!name) return { skip: 'empty' };
  if (NOT_ONE_PARTY.test(name)) return { skip: 'not one party' };

  const government = name.match(/^(the )?government(?: of (.+))?$/i);
  if (government) {
    const country = government[2]
      ? resolveIn('country', government[2].replace(/^the /i, ''))?.id
      : context.iso2 && resolveEntity(entityId('country', context.iso2.toLowerCase()))?.id;
    return country ? { id: country, minted: false } : { skip: 'public body' };
  }
  if (PUBLIC_BODY.test(name) && !looksLikeOrganisation(name)) return { skip: 'public body' };

  const known =
    inRegistry(name) ??
    inRegistry(bareName(name)) ??
    (context.abbr ? inRegistry(context.abbr) : undefined);
  if (known) return { id: known, minted: false };
  const slug = slugOf(name);
  if (!slug) return { skip: 'empty' };
  const minted = entityId('company', slug);
  // Only a pair a person reviewed merges; the matcher only proposes.
  const alias = aliasEntry(minted);
  if (alias)
    return { id: alias.canonical, minted: !resolveEntity(alias.canonical), name: alias.name };
  return { id: minted, minted: true };
}
