# The company directory

`/markets/directory` lists every company in the universe (tiers A and B), and
`/data/companies` explains why each is there. Linked from `/markets` ("Every
company in the universe") and from `/data/companies`.

## What it answers

Which companies are covered, in which theme and country, and what each page can
show. It is a filter over the same rows `admit()` produces
(`lib/universe/directory.ts`), so a count here is the count of the rule, not of
a separate list.

- **Search** is `@bitbaum/searchkit` (`createSearch`, `relax: false`, every typed
  word must match): name, aliases, ticker, country and theme. A slip is
  forgiven ("nvidai" finds NVIDIA). There is no ranker of ours.
- **Filters** are a theme, a country, a tier and a page kind, in one GET form
  (`AutoSubmitForm`), so the URL is the state and the back button works. The
  count beside each option says how many rows that option would give with every
  other filter kept (its own selection lifted), so an option never reads zero
  because it is the one chosen.
- **Phone**: one column of stacked rows (name and ticker; themes; tier, country
  and page kind), sixty at a time with "Show more", no table, no sideways scroll.
- **Honest counts**: "N companies" when nothing filters, "M of N companies match"
  when something does, and an empty result says what to do next.

## What a page can show

Three kinds, decided from identifiers alone (`lib/universe/page-kinds.ts`), the
same count wherever it is printed (`/data/companies`, the directory header,
`scripts/research/coverage.ts`):

| Kind | Means |
| --- | --- |
| Quote and SEC filings | a listing the price source serves and an SEC CIK: price history, XBRL statements, holders from proxies and Schedules 13G/13D |
| Quote only | a listing, no SEC filings: price history; statements and holders say why they are missing and queue a task |
| Identity only | admitted, no listing the price source can serve (private, a subsidiary, or a venue code it cannot be told apart on) |

The counts move with the evidence, so none is written here:
`pnpm exec tsx scripts/research/coverage.ts` prints today's, with the themes,
the countries and the tests that kept the rest out.
