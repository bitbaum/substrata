/**
 * Interface strings, keyed rather than written into components.
 *
 * English is the source: its shape defines the key set, so a key that does not
 * exist here is a type error at the call site rather than a blank on the page.
 *
 * Every other locale is deliberately `Partial`. An untranslated string falls
 * back to English — but the system KNOWS it fell back, because `gapsIn()` can
 * list exactly what is missing. A fallback that cannot be measured is how a
 * half-translated product ships and nobody finds out until a reader does.
 *
 * This catalogue is for the interface only. The research prose is authored
 * content and lives with the corpus; see `lib/i18n/text.ts` for why the two
 * cannot share a mechanism.
 */
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales';

export const EN = {
  // Profile sections. The title a module shows is interface, not research.
  'profile.products.title': 'What it makes',
  'profile.topics.title': 'Where this matters',
  'profile.relief.title': 'What could change its position',
  'profile.gaps.title': 'Questions the profile does not yet answer',
  'profile.timeline.title': 'What has happened',
  'profile.related.title': 'What this connects to',
  'profile.discussion.title': 'Discussion',
  'profile.why.title': 'Why it holds things up',
  'profile.severity.title': 'Severity',
  'profile.producers.title': 'Who makes it',
  'profile.rules.title': 'Rules that govern it',
  'profile.removes.title': 'What would remove it',
  'profile.calls.title': 'What we have predicted',
  'profile.funding.title': 'Who could fund relief',
  'profile.role.title': 'What this holds up',
  'profile.relieves.title': 'What it would relieve',
  'profile.readiness.title': 'How far off it is',
  'profile.milestone.title': 'What to watch for',
  'profile.mandate.title': 'What this kind of money does',
  'profile.canMove.title': 'What it could move',
  'profile.sourceSentence.title': 'The sentence this is built on',

  // Evidence vocabulary, which appears beside almost every row on the site.
  'evidence.sourced': 'sourced',
  'evidence.candidate': 'candidate source, unchecked',
  'evidence.unverified': 'unverified',
  'evidence.directoryJoin': 'directory join, not a sourced finding',
  'evidence.joinsCarryOwn': 'each join carries its own evidence',

  // Shared actions and states.
  'action.allEvents': 'All events →',
  'action.allPolicy': 'All policy →',
  'action.allScience': 'All science →',
  'action.allCalls': 'All calls →',
  'action.reportError': 'Report an error on GitHub',
} as const;

export type MessageKey = keyof typeof EN;

/**
 * Translations, by locale. English is complete by construction; the rest fill
 * in as real translations arrive. Nothing here is machine-translated: research
 * prose that reads fluently but was never checked is indistinguishable from
 * research that was, which is the failure this project exists to avoid.
 */
export const MESSAGES: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en: EN,
  de: {},
  fr: {},
  it: {},
  ru: {},
  ja: {},
  zh: {},
  ar: {},
};

export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return MESSAGES[locale][key] ?? EN[key];
}

/** Whether this locale actually has the string, or is being served English. */
export function isTranslated(key: MessageKey, locale: Locale): boolean {
  return locale === DEFAULT_LOCALE || MESSAGES[locale][key] !== undefined;
}

/** Exactly what a locale is missing — the measurement the fallback would hide. */
export function gapsIn(locale: Locale): MessageKey[] {
  return (Object.keys(EN) as MessageKey[]).filter((key) => !isTranslated(key, locale));
}

export function coverageOf(locale: Locale): number {
  const total = Object.keys(EN).length;
  return total === 0 ? 1 : (total - gapsIn(locale).length) / total;
}

/** Translation status for every locale, for an honest status page. */
export function coverageReport(): { locale: Locale; coverage: number; missing: number }[] {
  return LOCALES.map((locale) => ({
    locale,
    coverage: coverageOf(locale),
    missing: gapsIn(locale).length,
  }));
}
