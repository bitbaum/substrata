# The company page

`/markets/<slug>`, for every company in the universe (tier A profiled, tier B
identified, tier C named). The owner, 2026-10-25: "think Bloomberg, think Yahoo
Finance … as much information on those companies as possible, including how
and with whom they do business." The answer is a single frame: every company
has the same sections in the same order. A section with nothing in it shows
an empty state instead of disappearing. That state names the source that
would fill it and links to "Send evidence", so the reader learns what is
missing and where it would come from.

## The frame, in reading order

Each section answers one question. Its heading says what it holds.

| # | Section | The one question | Source (code) |
|---|---|---|---|
| — | Header | Which company and line is this, and what did it last close at? | `lib/company-page/price-view.ts` over `priceHistory` |
| 1 | Share price | How has the share done? | `prices/{store,compute}` |
| 2 | Key statistics | How big is it, and is it growing? | `fundamentals` + `present.marketCap` |
| 2a | Role in the chain (listed only) | What is it to the chain: bottlenecks held, grade, cited role? | `lib/company-profile`, `app/markets/[slug]/_sections/AtAGlance.tsx` |
| 3 | Financials | Revenue and net income, year by year | `fundamentals` (annual XBRL) |
| 4 | What it holds (tier A) | Which chokepoints does it control? | existing module |
| 5 | Who owns it | Who holds the shares, and what is "the rest"? | `holders` (13G/13D, proxy, Form 4) |
| 6 | How it does business | Customers, suppliers, competitors, stakes, sites | `lib/graph` relations |
| 7 | Peers | How do comparable companies' shares compare? | same chain layer (A) or theme (B) |
| 8 | What has happened / filings | Events and SEC filings on one axis | existing |
| 9 | Take part, hiring | How to work there, own part of it, buy from it | existing |

- **Header.** A listed company reads like a quote page: the name, the quote,
  and straight under it the share price's range row and chart. Its role in
  the chain (the lede, the five tiles at a glance, why it is graded so and
  where the role is cited) is a section of its own, **Role in the chain**,
  after Key statistics (`ChainRole` in
  `app/markets/[slug]/_sections/CompanyHeader.tsx`; its place is `chain-role` in
  `lib/company-sections.ts`). A company with no listed share keeps all of it
  in the header, where it is the most there is to say. The header shows the name, `ticker · exchange · currency`, the last close
  with its 1-day change and date, and the label "Delayed end-of-day · Yahoo
  Finance" with a link. Themes appear as links. The quote streams in its own
  Suspense boundary, so a slow price source never holds up the name.
- **Share price.** A line chart (chartkit `LineChart` with `markers="auto"`
  and `area`: a range of more than 60 closes is a clean line over a light
  fill, with each close's value on hover and keyboard focus; a short range
  keeps a dot per close) with one row of equal cells for the range:
  `1M · 3M · 6M · YTD · 1Y · 5Y`. This is the only client island on the page.
  Under it, three figures for the chosen range: return, high to low, and max
  drawdown. Then the 52-week range of closes and a returns table for every
  range. All of these are computed in code (`prices/compute.ts`). A moving-
  average toggle is left out on purpose: a seventh cell would break the
  one-row rule at 320px, and the 50- and 200-day averages are figures in
  the table instead.
- **Key statistics.** One grid of eight equal cells (two rows of four, or
  four of two, so no cell is left hanging): market cap, revenue, operating
  income, net income, R&D, capex, cash and long-term debt. Each cell shows the latest
  annual figure, its fiscal year and its growth, and links to the filing it
  was read from. Market cap is shown only where close × cover-page shares
  really is the market value. Otherwise the cell reads "Not computed" and
  gives the reason (ADR ratio, share classes, not checked).
- **Financials.** Columns for annual revenue and net income over the last
  five fiscal years, plus a row per year with growth and margin computed in
  code. A filer with no XBRL gets the typed "unavailable" reason.
- **Who owns it.** A share bar of the holders named in filings. The rest is
  labelled in the legend as "Others, each below 5%", never a bare "Other".
  The explanation sits under the bar. A table follows with one anatomy per
  row: name, percent, shares, as-of date and filing.
- **How it does business.** Groups are always shown in this order: Customers,
  Suppliers, Competitors. When the graph has rows, Stakes it holds and Sites
  it operates follow. Every row has one anatomy: the other party (linked),
  the relation, the amount where stated, the evidence grade, the date and
  the source. An empty group names the filings that would fill it, using the
  dossier box's `allowedSources`.
- **Peers.** A table with name, ticker, last close, 1-year return and a
  1-year sparkline. On a phone each row becomes stacked rows with the same
  anatomy.

## The four kinds

| | Listed tier A (NVIDIA) | Listed tier B (Oklo) | Private / no listing | Stub (named only) |
|---|---|---|---|---|
| Header quote | yes | yes, via the universe ticker | "No listed share" + why | same |
| Price, key stats, financials | yes | yes (SEC filer) | empty state: no ticker in any source read | empty state |
| Who owns it | filings | filings | committed ownership rows or empty state | empty state |
| Business, peers | graph / layer | graph / theme | graph / layer | graph / none |

A tier B company gets market data when its universe identifiers resolve to
a listing. `lib/market-data/company.ts` joins it this way: the market seed
by slug, then the seed by ticker and venue, then a listing synthesised from
`UniverseEntry.ids` on the venues the price source serves.

## Rules

- No section heading is an icon alone, and every label says what it holds.
- Every figure comes with its date and source. "Unavailable" always comes
  with the reason. A box is never left empty.
- Mobile first. At 390px there is no sideways scroll, every target is 44px,
  the range row is one row, and tables become stacked rows with one anatomy.
- Nothing sits under a floating control. From 768px the page column keeps
  a right gutter as wide as the Ask pill (`app/styles/ask.css`); on a phone
  Ask is the top-bar button and the pill is not drawn. The Loki feedback
  launcher is not Substrata's: it picks its own free spot, and the footer
  keeps room for it on a phone.
- Monochrome. Status colours are used only for gains and losses (`--ck-up`,
  `--ck-down`). Nothing is orange.
