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
| 10 | What we do not know yet | Which of the above could not be filled, why, and from which documents? | `lib/company-page/unknowns.ts`, `components/company/Unknowns.tsx` |

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

- **What we do not know yet.** One row per gap, in one anatomy: what is
  missing, why (the typed reason a read returned, or the identifier that is
  absent), the documents that would fill it, and "Send evidence". Every row is
  also a work-queue task, `company:<slug>#<box>` (boxes: `listing`, `prices`,
  `financials`, `holders`, `relations`, `identity`, `country`), so a gap is a
  request. The static half (no listing, no SEC id, no LEI, no relation) needs
  no network read: `pnpm exec tsx scripts/research/company-gaps.ts` lists it
  for the whole universe. A company with nothing missing says so in one line.
  Nothing missing is estimated: a company that files nothing with the SEC shows
  no revenue, margin, cash, debt or share count, and says where an annual
  report would supply them.

## Which prices the daily run keeps

`/api/cron/prices` walks `trackedListings()` (`lib/market-data/company.ts`):
the hand-checked seed first, every day, then each admitted universe company
whose identifiers resolve to a line the price source serves, stalest first,
until its time is up. A line that is not a seed line is stored, and drawn, only
if the price source's own name for the symbol agrees with the company's
(`lib/market-data/prices/line-name.ts`): a ticker can be another company's on
another exchange, and a mismatch is refused with both names rather than
drawn. A Bloomberg venue code that names several exchanges is read by the
symbol where the symbol decides it (mainland China: 6xxxxx and 9xxxxx are
Shanghai, 0xxxxx and 3xxxxx Shenzhen) and tried TSX then TSX Venture for the
Canadian composite; any other is refused. While `research_price_points` is
empty for a line, the page reads the source live (cached six hours in the
process); when that fails it says so under Share price and lists the gap.

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
