/**
 * The languages Substrata intends to serve.
 *
 * Declared before the translations exist, on purpose: the expensive part of
 * localisation is not the translating, it is discovering afterwards that the
 * code assumed one language — strings welded into components, dates formatted
 * by hand, and a layout that only goes left to right. Those assumptions are
 * cheap to remove now and painful to remove at scale.
 */
export const LOCALES = ['en', 'de', 'fr', 'it', 'ru', 'ja', 'zh', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Endonyms: a language picker should name each language in that language. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  ru: 'Русский',
  ja: '日本語',
  zh: '中文',
  ar: 'العربية',
};

/**
 * Arabic is read right to left, which is a layout fact and not a text fact.
 * It has to reach the document element, so every margin, border and icon that
 * assumes a side flips with it.
 */
export const LOCALE_DIR: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  de: 'ltr',
  fr: 'ltr',
  it: 'ltr',
  ru: 'ltr',
  ja: 'ltr',
  zh: 'ltr',
  ar: 'rtl',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return LOCALE_DIR[locale];
}

/**
 * Dates and numbers are content too.
 *
 * The corpus writes dates as ISO strings because that is unambiguous to store;
 * it is not what a reader in Tokyo or Paris expects to read.
 */
export function formatDate(iso: string, locale: Locale): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}
