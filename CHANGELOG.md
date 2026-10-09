# Changelog

What changed on substrata.orangecat.ch, newest first, in the words of someone using it. Every entry corresponds to a merged pull request and the numbers are the ones in the commits; fixes are listed with the same weight as features. This file is what the fleet map (`loki.orangecat.ch/api/fleet/map`) reads, and `/changelog` on the site renders from the map.

## 2026-10-09

### Added
- **Answer Ask in one tap.** When an answer asks you something back, or the next step is obvious, two to four replies appear under it; tapping one sends it as your next question. (#167)
### Changed
- **The front page says what it is, then shows it.** One line, one sentence, one button; the three worst constraints right now; five doors as rows; the three newest checked events; the counts; a line for anyone who can fix a row; how live the sweep is. On a phone it was twenty screens (18,686px) — thirteen problem cards, two chip clouds, two event lists, the latest rule — every piece true and nothing said first. What left it is still on the site: the chips are the filters on Bottlenecks, the latest rule tops Policy, unchecked finds lead News, and the problem cards' copy stays for the role views.
- **One row of buttons under an answer.** The suggested replies and the questions built from the records Ask read now sit in a single row, replies first, nothing offered twice, at most five — instead of two rows under the same answer.
### Fixed
- **A short reply is a question.** "No" or "OK" used to vanish from the Ask box without being sent; two characters now send, and anything not sent stays in the box. (#167)

## 2026-10-06

### Added
- **News leads with what was just found.** `/events` is now News: the newest sweep finds of the last 14 days first, each marked not yet checked, then the checked events grouped by month with their source named. (#153)
- **Anyone can pull fresh news.** "Update news now" on News searches the web for the bottlenecks searched longest ago — signed out, no AI — and says plainly when the last search is more than a day old. (#153)
- **"On this page" for long pages.** A list of the page's own sections beside the content, or a strip under the top bar on a phone, marking where you are. (#153)
### Fixed
- **No more tenders or kitchen worktops in the news.** A government scanner contract and "quartz surface products" no longer pass as news about high-purity quartz. (#153, #154)
- **Ask no longer rewrites a correct answer.** A figure written into a field name (`net_pressure_90d`) counts as evidence, saving a model call. The chat components now come from npm. (#150)

## 2026-10-02

### Added
- **Ask has a tool behind every section** — technologies and their readiness, research papers, policy rules and who asked for them, SEC filings, price series, reserves and Substrata's own notes — so it no longer says the site does not hold what the page it is on shows. (#145, #146)
- **Update now reaches research too.** On a bottleneck page it also searches the open research databases, with no AI. (#145)
### Fixed
- **Ask is faster and finishes its answers.** On the same twelve questions: 29 → 20 model calls, about 30% fewer tokens, 121 s → 54 s; an answer cut off at the length limit is completed once. (#145, #146)
- **One article is one lead.** A search engine's tracking parameter no longer turns the same page into a new lead every day. (#145)
- **Ask answers in words, not tool calls.** It no longer replies with a raw tool call, reads the site's own numbers, production tables and open roles, converts units correctly, answers in the language of the question, gives links you can copy, loosens a job search instead of returning nothing, and says whether a change went up or down in words. (#136, #137, #138)

## 2026-10-01

### Added
- **The front page is live.** Checked events first, then up to four recent sweep finds that report a change and are not yet filed, each labelled as not yet checked with a way to check it. (#134)
- **Accepting an event publishes it at once.** An event accepted at `/review` is on the site immediately, with its quote checked against the page at the moment of acceptance. (#135)

## 2026-09-30

### Fixed
- **The world map loads only when you open it**, from a manifest that records each dataset's source and licence; a failed load offers a retry instead of a stuck globe. (#126, #127)

## 2026-09-28

### Fixed
- **`/roadmap` renders again.** It had returned an error since the roadmap started coming from the fleet map. (#125)

## 2026-09-26

### Added
- **The world view is a globe.** The atlas opens on a globe you can turn, painted by the same USGS data as the flat map. (#120)
- **Task-flow criteria, measured.** Every tool page now answers first, has one header and one empty state, and the flows a reader actually runs are measured after each deploy — 20 of 20 task runs completed with no dead ends. (#117, #121)
- **Quality scores for every dataset.** `/data/quality` holds each dataset to six written criteria — completeness, correctness, provenance, freshness, link health, consistency — with pure checks in the build and network checks every six hours. Fixed what the first run found. (#116)
### Fixed
- **Every producer capacity names its own unit.** A capacity figure no longer inherits a unit from its neighbour. (#122)
- **Touch targets and an early paste.** Breadcrumbs and reader tabs are 44px on a phone; the careers sidebar sits above Ask; the X-ray keeps a portfolio you pasted before the page finished loading. (#119)
- **Shin-Etsu Quartz and MetOx are back to unverified.** Two producer rows had been marked sourced without a page that names the company and the material. (#118)
- **An accepted lead says so.** The desk no longer shows "not yet reviewed" on a lead that was accepted. (#115)

## 2026-09-25

### Added
- **Check a pasted key with its vendor.** Bring your own API key: Substrata asks the vendor which models the key can use and lets you pick from them, instead of guessing. (#114)
- **Unreviewed leads expire.** A sweep lead nobody reviews within 30 days leaves the queue at read time and is listed at `/data/freshness/expired`, so a stale queue means the expiry is broken, not that nobody looked. (#113)
- **The country panel has numbers.** Measured resources, producers, export restrictions, sanctions and ranked peers for every country the map draws. (#107)
- **One canvas, one bar, one panel.** The atlas became a 50m vector map painted by USGS data, with supply chains drawn as a flow. (#106)
- **USGS world production and reserves per country**, and a choropleth API the map paints from. (#105)
- **One shell for every page.** A grouped sidebar, an icon rail on tablets, four tabs and "More" on phones, and a ⌘K palette — signed in or not. (#103)
### Fixed
- **No orphan role label**, and the figures table lays out by the panel's width. (#112)
- **One queue per engine.** The research engines each have exactly one Postgres queue; the model picker in Ask is usable on a phone. (#111)
- **The world is framed in what the sheet leaves visible**, and the feedback launcher stays off the panel. (#110)
- **Empty blocks are omitted**; a resource states its absence once, not per block. (#109)
- **The unreadable country diagram is gone**; the map counts the countries it actually draws. (#108)
- **Ask sits in the phone top bar**, and "Sign in" replaced a dot. A structural test now fails on overlapping chrome. (#104)

## 2026-09-24

### Added
- **Reader-initiated news updates.** You can ask for the news on a bottleneck to be refreshed; AI drafting happens only on your own key. (#102)
- **Reader views.** Five doors — for equity investors, policy, science, careers, learning — each collecting the existing screens, plus a freshness page that breaks the build on stale data and a shared page header. (#96)
- **Dependency rows as graph edges.** 26 sourced dependency rows, pinned home listings, and a minimum move on every series. (#94)
- **Dated, sourced number series per bottleneck.** Lead times, prices, capacity, output, backlogs and trade volumes at `/data/series`, as CSV, with desk alerts on a move. (#92)
- **Open roles from public job boards**, with the skills and training each bottleneck asks for. (#91)
- **Portfolio X-ray and scenarios** over a sourced dependency layer. (#88)
- **Ask on any AI, fast**, with one-click verification of a claim. (#89)
- **The science pipeline**: stages, live paper and grant feeds, and who is doing the work. (#87)
- **AI-drafted events from sweep leads**, reviewed in one click, accepted straight into git. (#85)
- **Exposure screen**, tickers from SEC and OpenFIGI, and SEC filings on the desk. (#84)
- **A desk you control**: filters, read/save/hide, rails and sweep settings. (#81)
- **Search**: one grouped index with instant results, typo tolerance and highlights. (#79)
- **Company profiles** that say what the company holds and why it matters. (#78)
- **A context-aware assistant** with tool calling over the corpus, streamed. (#77)
- **Figure**: every number links its source or explains its computation. (#76)
- **A live news feed on your rails**, with a way to refresh it. (#75)
- **SUSS Karlsruhe Advanced Packaging center**, accepted as an event at `/review`. (#90)
### Changed
- **Readers first.** Background jobs draw from a capped, reserved slice of the free AI budget so a reader is never queued behind a cron. (#93)
- **Ask plans the obvious lookups before the model** and makes one call for a page question; it walks on from a free link that shows nothing in 9 seconds. (#98, #100)
- **News stays fresh on a smaller footprint**; producer sourcing runs every six hours. (#97, #101)
- **No solo framing.** Judgements are Substrata's and open to challenge. (#82)
### Fixed
- **Every number on the public pages opens to its source**, rule or estimate. (#80)
- **A plan outranks the page-only shortcut**, and half-converted citation markers are mended. (#99)
- **Dependency rows are labelled "sourced", not "filing"** — the rows include annual reports and company blogs. (#95)
- **One drafting run at a time**, and a draft that looks like an already-accepted event is flagged. (#86)

## 2026-09-21

### Fixed
- **Retrieval quality in chat**: word-boundary scoring, IDF weighting and a relevance floor. (#73)
- **The assistant answers the question asked**, and the header is a menu again. (#72)

## 2026-09-18

### Added
- **The research sweep runs on a timer**, into a queue rather than the corpus; the leads have a reader, and freshness stops being a guess. (#68, #69)
- **Relief for the two worst science rows**, and the prompt no longer claims it has no tools. (#67)
### Fixed
- **A timestamp column is a Date.** Asserting otherwise shipped green. (#70)

## 2026-09-17

### Added
- **Five more materials with figures**, and the actual places named. (#66)
- **Numbers with a year and a source**, and the difference between a law and a schedule. (#65)
- **The assistant can look things up**, without letting the web pretend to be research. (#64)
- **The assistant knows what you are reading.** A kind is one file; loops became entities. (#63)
- **The web as a schema**, and the seams for eight languages. (#61)
### Changed
- **Every entity page is modules on one shared order**; the company page and one entity registry came first. (#58, #59, #60)
- **The corpus is indexed**, and every entity has a path to the KPI. (#62)

## 2026-09-16

### Added
- **A dossier for every country**, a resource directory and a derived graph — not a demo for one. (#51, #53)
- **Equal Earth map, comments, AI fact-check.** (#54)
- **Readable atlas chains, a mobile menu, follow companies.** (#55)
- **Ask as a thread**, grounded on ai-kit. (#52)
- **Desk, world map, a visible changelog, dark/light/auto.** (#48)
- **Mark, one header, and a chain figure on the front page.** (#47)
### Fixed
- **An unknown model id or an anonymous fact-check no longer spends the budget.** (#57)
- **Menus close outside**, Auto model, dictate, attach. (#56)
- **The research is back in the chrome**; two shells, one map, inquire on gaps. (#49, #50)
- **Wafer producer coverage is distinguished from market claims.** (#46)

## 2026-09-15

### Added
- **A checkable research atlas and the Substrata companion.** (#43)
- **Capital, Learn, and one module that owns every internal URL.** (#41)
- **Every readiness score cited**, nine events accepted, part of the directory sourced. (#40)
- **The track record started**, and the engine no longer mistakes blindness for absence. (#39)
- **A grouped megamenu, notes, and an invitation to contribute.** (#38)
- **Sections for policy, markets and science**, in plain language, with a test that fails the build on untrue copy. (#37)
### Fixed
- **Coverage claims constrained**, and production verification recorded. (#45)
- **Research service readiness and account identity verified.** (#44)

## 2026-09-14

### Added
- **The loop in nine stages**, an assessment per bottleneck, dated events, and Today as the front page. (#35)
- **The board**: bottlenecks as one scannable list, a page per bottleneck, the programme as a ladder. (#32)
- **The substrate-of-recursion programme**, a research engine, a JSON map and a correction intake. (#31)
- **48 of 92 producer rows sourced** from the engine's candidates. (#33)
- **MIT licence.** (#34)

## 2026-09-13

- FleetCrown was renamed to Loki throughout. (#30)

## 2026-09-07

- CI caches Next's build output, and the auto-merge sweep holds a token so workflow PRs stop stalling. (#24, #25, #26)

## 2026-09-04

- Green PRs merge themselves through the fleet auto-merge sweep, and the sweep reconciles deployment so a merged commit is never stranded. (#20, #22)
- Docs synced with the actual stack; the fleet's one package manager, pnpm. (#17, #19)

## 2026-08-31

- TypeScript 6, ESLint 10, Node 24 in CI and on the box, a formatter, and sitekit 0.3.0 for a fix this repo could not make. (#11, #12, #13, #15, #16)

## 2026-08-29

- Link previews render for real. (#10)

## 2026-08-27

- Substrata starts as its own firm: the site, the feedback widget so it stays maintainable without a developer, CI, and sitekit as the site model and renderer. (#1)
