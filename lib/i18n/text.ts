/**
 * Authored content, and the one kind of text that must never be translated.
 *
 * The corpus holds roughly 5,500 words of research prose — what a bottleneck
 * is, why it binds, what a readiness score rests on — and about 1,000 words of
 * quotations taken from other people's pages. Those are not the same material
 * and they cannot share a mechanism.
 *
 * **Research prose is translatable.** It is Substrata's own writing, so a
 * German reader should get it in German, and the translation is a claim like
 * any other: it carries who made it and when, so a reader can see whether the
 * sentence they are reading was checked by a person.
 *
 * **A quotation is not translatable.** Its entire evidentiary value is that
 * these are the words the source actually published. Rendering a translation of
 * the EIB's mandate sentence as though the EIB wrote it would be inventing
 * evidence — the exact failure `test/truth.test.ts` exists to prevent. A quote
 * may be *accompanied* by a translation, clearly marked and attributed to us,
 * but the original is always what is shown as the quote.
 *
 * Neither type permits machine translation to be passed off as checked. Prose
 * that reads fluently but was never verified is indistinguishable, to a reader,
 * from prose that was.
 */
import type { Locale } from './locales';

/** How a translation came to exist. An unattributed translation is a rumour. */
export type TranslationSource =
  | { kind: 'authored'; by: string; on: string }
  | { kind: 'human'; by: string; on: string }
  | { kind: 'machine'; engine: string; on: string; reviewed: false };

export interface Translation {
  text: string;
  provenance: TranslationSource;
}

/**
 * A piece of Substrata's own prose, in the language it was written in, plus
 * whatever translations exist for it.
 */
export interface Prose {
  lang: Locale;
  text: string;
  translations?: Partial<Record<Locale, Translation>>;
}

/**
 * Somebody else's words. There is no `translations` field, and that is the
 * point: the type makes the rule unbreakable rather than trusting a convention.
 */
export interface Quotation {
  lang: Locale;
  text: string;
  /** Where these words were published, so the original can be checked. */
  source: string;
  /** The date the source was read. */
  readOn: string;
}

/**
 * The prose to show, and whether it is actually in the requested language.
 *
 * Returning the fallback silently is what produces a page that looks translated
 * and is not. Callers get told, so the interface can say so.
 */
export function readProse(
  prose: Prose,
  locale: Locale,
): { text: string; lang: Locale; translated: boolean; provenance?: TranslationSource } {
  if (prose.lang === locale) return { text: prose.text, lang: prose.lang, translated: true };
  const translation = prose.translations?.[locale];
  if (!translation) return { text: prose.text, lang: prose.lang, translated: false };
  return {
    text: translation.text,
    lang: locale,
    translated: true,
    provenance: translation.provenance,
  };
}

/**
 * Whether a translation has been checked by a person.
 *
 * A machine translation is allowed to exist in the data — it is a useful draft
 * — but it must never be presented as the research's own settled words.
 */
export function isReviewed(translation: Translation): boolean {
  return translation.provenance.kind !== 'machine';
}

/** English prose, which is what every current record is. */
export function english(text: string): Prose {
  return { lang: 'en', text };
}
