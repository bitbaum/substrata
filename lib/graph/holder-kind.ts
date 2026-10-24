/**
 * Is an ownership holder one organisation a company node may stand for?
 *
 * Ownership rows (config/substrata-ownership.ts) name holders as a person read
 * them off a filing, and every holder that resolves becomes an endpoint — a
 * minted `company:<slug>`, and so a stub company with a page. A founder named
 * by their own name ("Jensen Huang") is a person; "Founding families" and
 * "ADR holders (Citibank as depositary)" are groups of holders. None of them
 * is a company, and none may become one.
 *
 * Conservative on purpose: a holder is refused only when the row itself says
 * so — the row's `kind` and the shape of the name together. Anything else is
 * left as it was and listed by `holderDoubts` for a person to read, never
 * guessed at. A `person` kind is a separate decision (knowledge-system ADR §5).
 */
import type { Holder } from '@/config/substrata-ownership';
import { looksLikeOrganisation } from './parties';

/** A group of holders, never one party: a family, heirs, the holders of a security ("ADR holders"). */
const GROUP = /\b(famil(y|ies)|heirs)\b|^\S+ holders\b/i;

/**
 * A personal name as a filing prints one: two or three capitalised words of
 * letters, a hyphenated given name allowed ("Lee Jae-yong"). No digits, no
 * punctuation, no organisational word.
 */
const PERSONAL_NAME = /^\p{Lu}\p{Ll}+(?:[ -]\p{L}\p{Ll}+){1,2}$/u;

/** Words that make a one- to three-word name an organisation even without a legal form. */
const ORGANISATION_WORD =
  /\b(stiftung|foundation|fund|capital|bank|insurance|life|pension|service|management|prospecting|square|partners|investments?|asset|vanguard|group)\b/i;

export type HolderVerdict =
  { party: true } | { party: false; reason: 'a person' | 'a group of holders' };

export function holderVerdict(h: Pick<Holder, 'name' | 'kind'>): HolderVerdict {
  const name = h.name.trim();
  if (GROUP.test(name)) return { party: false, reason: 'a group of holders' };
  if (
    h.kind === 'founder' &&
    PERSONAL_NAME.test(name) &&
    !looksLikeOrganisation(name) &&
    !ORGANISATION_WORD.test(name)
  )
    return { party: false, reason: 'a person' };
  return { party: true };
}

/**
 * Holders the rule above lets through but a reader might doubt: a founder or
 * strategic holder printed with no legal form and no organisational word.
 * Listed, never refused.
 */
export function holderDoubt(h: Pick<Holder, 'name' | 'kind'>): boolean {
  return (
    holderVerdict(h).party &&
    (h.kind === 'founder' || h.kind === 'strategic') &&
    !looksLikeOrganisation(h.name) &&
    !ORGANISATION_WORD.test(h.name)
  );
}
