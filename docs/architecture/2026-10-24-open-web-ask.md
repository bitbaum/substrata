# The Ask reads the web: open-world questions search it up front

Decided 2026-10-24. Extends [the research systems note](./2026-10-24-research-systems.md),
which this does not edit: its ladder still holds for corpus facts; what changes is
*when* the web is read and *how* its passages are used.

## Why

The owner, after reading the recent chats: "once again the chat is trying for the
website's knowledge base, and it's not looking anything online, and it's not acting
like a large language model. It's acting like a search machine going through only
information that we have in the database, ignoring the information that exists out
in the open."

Reproduced live the same day:

- "What did Kazatomprom say about 2026 production guidance?" opened with "The
  Substrata corpus does not track Kazatomprom's forward-looking volumetric
  guidance…", then paraphrased search snippets under "Unchecked web results" and never
  gave the figure — the figure was on a page nobody read.
- "Who are Kazatomprom's main competitors and how have their share prices moved this
  month?" gave corpus country shares, then "Substrata does not record real-time or
  monthly equity market movements", with eight web leads unused.

The cause was structural: the web was the fifth rung of the ladder, opened only when a
corpus lookup came back empty or a missing link (facilities, owners, buyers, finance)
was detected; it passed the model two pages' worth of 700-character excerpts and the
rest as snippets; and the guards treated anything not from the corpus as suspect.

## The policy

1. **Routing** (`lib/chat-agent/route.ts`). Each question is routed before anything is
   looked up. Open-world signals — news, "latest", "today", "this month", prices and
   share prices, "what did X say", guidance, announcements, earnings, competitors,
   people, deals, "why/how/explain" — and, by default, anything else send the web
   search **in parallel with** the corpus lookups (`lookups.ts runPlan`). Only questions
   about Substrata itself (its method, scores, a page's record) and off-topic chat stay
   corpus-only. When unsure, search: SearXNG on the box is free; provider search stays an
   option on a reader's own key, and no paid search API is required. "This month",
   "today" and "latest" are turned into the month and year in the query. A missing link
   the first search did not target still gets its own search.
2. **Pages are read, not snippets** (`lib/chat-web.ts`, `lib/chat-web-passages.ts`). The
   top four results are read in parallel (6 s each, 1.5 MB cap, `readPage`'s SSRF check
   on every redirect hop); from each, the two windows of sentences that match the
   question are passed verbatim as `[W#]` with title, URL and date (the engine's, or one
   the page prints near its top; otherwise "undated"). A page that will not open keeps
   its snippet, marked as such. A PDF (annual reports, trading updates) is read as its text with `unpdf` behind
   `readPage`'s own address checks (`lib/chat-web-pdf.ts`, 8 MB cap).
3. **The model answers.** It answers first and directly, combining corpus rows
   (authoritative, linked to site pages, with their evidence states), web passages
   (cited `[W#]` claim by claim, with the page's date for anything time-sensitive) and
   general knowledge for established background, marked "From general knowledge, not
   checked:". Figures come only from a corpus row or a dated web passage, copied as
   printed; never from memory. No answer opens with what the corpus lacks; a corpus gap
   is at most one trailing line and is still filed as demand (`gaps.ts`). Supplier,
   customer, owner and financier links still need a row or a page.
4. **Guards.** Corpus guarantees are unchanged (computed facility tables and summaries,
   unit and printed-form checks, the wall check). Added: a figure in a sentence citing
   `[W#]` must appear in that passage (`web-figures.ts`) — sent back once, then dropped;
   labelled background survives default deny when it has no figure and no link claim,
   and is no longer exempt from the figure check; an opening made of corpus-gap
   sentences moves to the end, and a heading that fences the web off ("Unchecked web
   results") goes (`open-first.ts`).
5. **On screen.** A `[W#]` in the answer is a source chip linked to the page, naming its
   site, date and "web page, not checked by Substrata" (`lib/chat/web-citations.ts`);
   corpus claims keep their site-page links. Under the answer, "Web pages read · not
   checked by Substrata" lists every page read with its date. While it works the reader
   sees "Searching the web for …" and "Reading <domain>…".
