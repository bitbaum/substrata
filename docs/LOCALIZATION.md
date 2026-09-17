# Localization

Substrata is intended to read in English, German, French, Italian, Russian, Japanese, Chinese and
Arabic. This document says what is already true, what is not, and the rules that must not be broken
when the translations arrive.

## The three kinds of text, which do not share a mechanism

**1. Interface strings** — section titles, buttons, evidence labels, empty states.

These live in `lib/i18n/messages.ts`, keyed. English is the source and defines the key set, so a
missing key is a type error rather than a blank on a page. Other locales are `Partial`: an
untranslated string falls back to English, and `gapsIn(locale)` and `coverageOf(locale)` report
exactly what fell back. A fallback that cannot be measured is how a half-translated product ships
without anyone noticing.

A test fails the build if a profile module writes a title into the component instead of using a key
— a string welded into a component is one no translator can reach.

**2. Research prose** — what a bottleneck is, why it binds, what a readiness judgement rests on.
About **5,500 words** today.

This is Substrata's own writing, so it is translatable, and a translation is a claim like any other:
`lib/i18n/text.ts` models it with provenance — who translated it and when. `readProse()` returns
whether the text is actually in the requested language, so the interface can mark prose that is
still English.

**Machine translation may exist in the data as a draft and may never be presented as checked.**
`isReviewed()` is false for it. Prose that reads fluently but was never verified is
indistinguishable, to a reader, from prose that was — which is the failure this whole project exists
to avoid.

**3. Quotations from sources** — about **1,000 words** today.

**These are never translated.** The entire evidentiary value of a quote is that these are the words
the source actually published. Rendering a translation of the EIB's mandate sentence as though the
EIB wrote it would be inventing evidence. `Quotation` in `lib/i18n/text.ts` has no `translations`
field, so the type makes the rule unbreakable rather than trusting a convention.

A translation may *accompany* a quote, clearly marked and attributed to us. The original is always
what is shown as the quote.

## What is done

- The eight locales, their endonyms, and their direction (`lib/i18n/locales.ts`).
- `lang` and `dir` on the document, so Arabic flips the layout and not only the text.
- Locale-aware date and number formatting helpers. The corpus stores ISO dates because that is
  unambiguous; it is not what a reader in Tokyo or Paris expects to read.
- All 20 profile-module titles, plus the evidence vocabulary, in the catalogue.
- Tests: every locale has a name and a direction; English is complete; a fallback reports itself; no
  module hardcodes a title; a machine translation is never counted as checked.

## What is not done, and is deliberately not faked

- **No translations exist yet.** Every non-English locale is at 0% coverage, and the code says so
  rather than pretending. Nothing here was machine-translated to make the numbers look better.
- **Locale routing.** There is no `/de/...`. Adding it is cheap once strings are externalised, and
  pointless before translations exist — it would ship seven locales that silently serve English.
- **The rest of the interface strings.** The profile modules and evidence vocabulary are migrated;
  page-level copy is not yet.
- **The corpus itself.** Translating 5,500 words of research into seven languages is a content
  operation with a review step, not a code change.

## Rules

1. A new user-visible string goes in the catalogue, not in a component.
2. A quotation is never translated. Ever.
3. A translation carries who made it and when.
4. A machine translation is a draft until a person reviews it, and is labelled as such.
5. Dates and numbers go through `formatDate` / `formatNumber`, never string concatenation.
6. Anything that assumes a side — margins, borders, icons — must survive `dir="rtl"`.
