# ADR: the company universe — which companies are in, and why

Status: accepted, 2026-10-25. Read with `docs/architecture/2026-10-23-knowledge-system.md`
(the candidate pipeline) and `docs/architecture/2026-10-24-research-systems.md`
(adapters, dossiers, the work queue). The rule is code: `config/universe-themes.ts`
(themes, tests, floors, tiers, freshness), applied by `lib/universe/admit.ts`, printed
at `/data/companies` from the same constants.

The owner's complaint (2026-10-25): "Is there any reason why these companies are
on the list and others aren't? … Why is there Nvidia but there is no SpaceX, no
Tesla … no robotics companies … no small modular reactors … We want hundreds of
companies from all over the world … we need methodology. If I ask you why is
there Nvidia but no SpaceX, you should be able to answer."

## 0. Why the list was what it was

Verified in code on 2026-10-25:

- **138 profiled companies** = `lib/participants.ts` `MARKET_PARTICIPANTS`: the 101
  rows hand-written into `config/substrata-participants.ts` (each a producer,
  equipment maker or buyer at one step of a tracked chokepoint, graded
  chokepoint / concentrated / competitive) joined with 37 more that exist only
  because `config/substrata-coverage.ts` names them as makers of one of the
  tracked materials.
- **1,186 stubs** = `lib/entities/sources/company-stubs.ts`: every `company:`
  node the relation graph mints from an operator or owner string in a USGS
  Minerals Yearbook table (plus a few filings), with no profile.

There was no admission rule. A company was present if someone writing about a
chokepoint thought to list it, or if a yearbook table printed its name. So
NVIDIA and AMD were in (named under compute "deployment" and "systems"), and
SpaceX, Tesla, Figure, Unitree, NuScale, Oklo and X-energy were out — not
because anyone decided they should be, but because no tracked material row
names them as a maker. **Absence meant nothing**, and nothing could explain it.

## 1. The rule

A company is **in** when it passes all three tests, each on a cited row (source
URL actually opened, the literal row or sentence quoted, the date read, the date
the fact is for):

| Test | Passes when | Why this test |
| --- | --- | --- |
| **Theme** | A source places it in at least one theme (below): an issuer-published thematic fund holds it; its own SEC SIC code is a theme code; a Wikidata industry class lists it; a government programme list or filing names it. | Coverage follows the frontier-technology tree the site exists for, not the accident of which chokepoint was written up first. |
| **Materiality** | A cited figure clears one floor: a thematic fund holds ≥ US$5 million of it; SEC 10-K cover public float ≥ US$250 million; market cap ≥ US$500 million; revenue ≥ US$250 million; a private valuation ≥ US$1 billion; a private round ≥ US$100 million. Or its chokepoint role is hand-verified (tier A). | A theme alone admits every shell company with "robotics" in its name. The floors are figures a source prints; we never compute one (no paid market-data feed). |
| **Identity** | It resolves to at least one registry id: exchange ticker, SEC CIK, LEI, Wikidata QID, or a company-registry number. | A reader (or the market-data workstream) must be able to look it up. A name is not an identity. |

### 1.1 Themes — twelve, small, extensible in config

`THEMES` in `config/universe-themes.ts`: compute & semiconductors · AI labs,
cloud & data centres · robotics & autonomy · space & launch · nuclear (SMRs and
the fuel cycle) · energy storage, batteries & grid · electric mobility ·
advanced materials & critical minerals · quantum · photonics · biotech tools ·
defence & aerospace (added 2026-10-27, see §6).

Chosen as the branches whose bottlenecks the site already tracks or which
consume them: compute is the root; AI and data centres are its demand;
robotics, mobility and storage consume the magnet, battery and grid
chokepoints; nuclear and grid decide whether compute is energised; materials is
where most tracked chokepoints sit; space, quantum, photonics and biotech tools
are frontier branches with their own single-source steps; defence competes
for the same magnets, gallium, germanium, tungsten and chips as the civilian
branches and is held by a few prime contractors. Adding a theme is one
row plus at least one source (a fund, a SIC code or an industry class) in
`config/universe-sources.ts`; `test/universe.test.ts` fails a source naming a
theme that does not exist, and an admitted universe with an empty theme.

### 1.2 Tiers

| Tier | Name | Means | Page may claim |
| --- | --- | --- | --- |
| A | Profiled | Hand-verified role in a tracked chokepoint, cited (today's directory, 133 of the 138). | Role, grade (as judgement), everything the profile shows. |
| B | Identified | Theme, materiality and identity each cited. | Identity, themes, the evidence list. **No chain role, ever.** |
| C | Named | Named by a published relation (a stub). | Only what the relation says. |

Promotion: C → B the day all three tests pass (same slug: the stub is promoted
in place and keeps its relations, `lib/entities/sources/company-universe.ts`);
B → A when a person adds a sourced participants or producers row. A tier A row
whose role source is withdrawn falls back to B or out by the same tests. The 5
directory rows with no sourced role today (Baosteel Gases, China Rare Earth
Group, Nyrstar, Solvay, MetOx — unverified producer leads only) are not tier A;
their pages stay, and `/data/companies` reports them as not admitted.

### 1.3 Evidence: `admittedBy`

Every admitted company carries `admittedBy: Admission[]`
(`lib/universe/types.ts`): `{test, theme?, basis, detail, source, quote,
readOn, asOf}`. The evidence rows live in two files of one shape
(`UniverseRow`): `research/universe.json` (written by the adapters, below) and
`config/candidates/universe.json` (written by a data agent through
`scripts/research/add.ts universe`, which re-reads the page and finds the
quote).

**Fund and index membership proves theme interest, not a chain role.** ARKQ
holding Cameco says ARK thinks Cameco belongs in an autonomy-and-robotics fund;
it says nothing about what Cameco supplies to whom. So tier B pages and the
Ask's tool say "held by X", never "supplier", "producer" or "part of the
chain", and `company_membership` returns that instruction with every answer.

### 1.4 Freshness, refresh, leaving

`MAX_AGE_DAYS`: a fund file counts for 120 days, a filing 550, a registry
record 730, a company statement 730. `admit()` sets older rows aside **before**
the tests run, with the reason ("as of 2026-01-02, 296 days old; a fund source
counts for 120 days"). So a company leaves on the day its last fresh evidence
for a test goes stale — the fund sold it, the float fell under the floor, the
file stopped updating — and is then listed as considered, with the failed test.
`research/universe.json` is a declared dataset (`config/substrata-freshness.ts`,
45 days), refreshed monthly with `pnpm exec tsx scripts/research/universe.ts`.

### 1.5 Exclusions, and what absence means now

`whyCompany(name)` (`lib/universe/why.ts`) answers for ANY name, one of five:

1. **in** — tier, themes, the evidence;
2. **out** — considered, and exactly which test failed, with the reason;
3. **considered** — looked for on purpose and not admitted, with where we
   looked (`config/universe-considered.ts`; a test fails if one is admitted);
4. **named** — tier C, a relation names it;
5. **queued** — never considered: a `GapTask` (`company:<slug>#universe`, box
   `universe`, written to `config/candidates/universe.json`) is returned and the
   demand recorded through `lib/dossier/demand.ts`, so asking about a missing
   company is what puts it in the work queue.

Nothing is excluded by kind. A conglomerate (Siemens, Honeywell) is in if a
thematic fund holds it over the floor; the page says which fund and nothing more.

## 2. Worked answer: NVIDIA, SpaceX, Tesla, Figure, Unitree, NuScale, Oklo, X-energy, TerraPower

**Under the old rule**, NVIDIA (and AMD) were in because a chain row names them;
every other name was absent because no tracked material lists it as a maker.
There was no answer beyond that.

**Under the new rule** (computed from the committed evidence; `/data/companies`
recomputes it on every render):

| Name | Result | On the strength of |
| --- | --- | --- |
| NVIDIA | in, tier A | a hand-verified chain role; also held by ARKQ, AIQ, BOTZ, DRIV, DTCR, QTUM, GRID and XSD, and files under SIC 3674 |
| SpaceX | in, tier B | listed as Space Exploration Technologies (SPCX): ARKQ and AIQ holdings rows (fund position over the floor), EDGAR ticker → CIK, GLEIF LEI, Wikidata QID; theme space via Wikidata industry class and the funds |
| Tesla | in, tier B | ARKQ, AIQ, BOTZ, DRIV, LIT and GRID holdings; SEC public float; CIK, LEI, QID |
| NuScale, Oklo, X-energy, NANO Nuclear | in, tier B | Global X Uranium ETF (URA) holdings rows over the floor (Oklo and X-energy also in ARKQ); EDGAR CIK; NuScale and Oklo also by SEC public float |
| Figure AI | considered, not admitted | private; identity and theme are easy to state, but no stated round or valuation was opened and quoted from the sandbox |
| Unitree | considered, not admitted | no fund read here holds it; no size figure opened and quoted |
| TerraPower | considered, not admitted | the DOE ARDP and NRC pages that name it render by script (no text to quote); no stated round quoted |

Honestly: a **private** company can only be admitted on a public source that
states its size — its own or a lead investor's release of a round or valuation,
or a filing (an S-1, a Form D with an amount). A news story repeating a figure is
not enough, and Wikidata never counts for size. Where this sandbox could not
open such a page, the name sits in `considered` with where we looked, and a
data agent closes it through `add.ts universe`.

## 3. Sources (adapters, all free; `lib/sources/HOSTS.md` lists the hosts and terms)

| Adapter | Reads | Establishes |
| --- | --- | --- |
| `etf-holdings.ts` (+ `etf-parse.ts`, `xlsx.ts`) | 22 issuer holdings files: ARK ARKQ, ARKX, ARKG; Global X BOTZ, AIQ, DTCR, DRIV, LIT, URA, COPX, SHLD, CLOU, GNOM; First Trust GRID, ROBT, FTXL, SKYY; Defiance QTUM; State Street ROKT, XSD, XAR, HAIL | theme (the fund's), identity (ticker+venue, CUSIP/SEDOL → ISIN), size (`fund-position`, where the file prints a market value) |
| `edgar-universe.ts` | `company_tickers_exchange.json`; XBRL frames `dei:EntityPublicFloat` (four instants of 2025); `browse-edgar` by 20 SIC codes (`SIC_THEMES`; 2026-10-27 added 3559, 3571, 3572, 3576, 3569, 3711, 3612, 3613, 3621, 1000, 3812, 3480, 3721, 3728) | identity (CIK), size (`public-float`), theme (`sic`) |
| `edgar-revenue.ts` | SEC XBRL company facts, annual revenue in USD, for a candidate with a CIK and no cleared size | size (`revenue`), dollars only |
| `registry-ids.ts` | GLEIF `lei-records?filter[isin]`; Wikidata SPARQL by ISIN (P946) | LEI with legal-address country; QID with the English label |
| `wikidata-universe.ts` | SPARQL by industry class (P452) for each `WIKIDATA_INDUSTRIES` row | theme + QID only |

Not readable from the sandbox on 2026-10-25, recorded in `FUNDS_NOT_READ`:
iShares (HTML instead of CSV), Invesco (406), VanEck (consent redirect), Range
NUKZ (script-rendered), S&P index methodologies (403). ARKX's file is dated
2026-01-02 and is refused by the freshness rule — kept so the refusal shows.

Joining: `lib/universe/identity.ts` joins rows by ISIN/CUSIP, then CIK, then
QID, then ticker on its venue, then the normalised name; a stub's slug is reused
when the name matches, so a stub is promoted rather than duplicated.

## 4. First wave (2026-10-25)

594 admitted: tier A 133, tier B 461; 137 considered and not admitted
(materiality 134, theme 12, identity 8 — one company may fail several).

Tier B by theme (overlapping): compute 51 · AI & data centres 89 · robotics 73 ·
space 34 · nuclear 40 · storage & grid 111 · electric mobility 41 · materials 37 ·
quantum 48 · photonics 0 · biotech tools 41. Tier B by country (legal address
where GLEIF says, else listing venue), 24 countries: US 274, CA 30, HK 28, JP 27,
KR 21, AU 14, TW 11, GB 9, BR 8, DE 5, FR 5, ES 3, IT 3, CH 2, FI 2, KY 2, and one
each in AT, BE, NL, NO, PL, SA, SE, SG; 9 with no country stated.

The known holes, each a next adapter rather than a rule change:

- **Photonics** has no tier B company: no thematic fund publishes a file, the
  photonics firms file under SIC 3674/3669/3661, and Wikidata's photonics class
  returned no listed members. Admitted photonics today is tier A (Coherent) and
  SIC 3827 only.
- **Large non-US companies held only by funds that print no market value**
  (State Street, Defiance) fail materiality: STMicroelectronics, MediaTek,
  Volkswagen, Stellantis. They are "out — materiality", which is true of the
  evidence, not of the companies. The fix is a free market-cap source per
  venue, or index-methodology floors once S&P's PDFs can be read.
- **47 tier A companies have no registry id** (private or subsidiaries without a
  listing of their own: Sibelco, The Quartz Corp, Hemlock, Heraeus …): reported,
  never a reason to drop a sourced role; an LEI search by a person closes them.

## 5. Seams

- **Market data**: `lib/universe/market-data-seam.ts` — `marketDataKey(entry)`
  (ticker, venue, CIK, LEI, ISIN) and `MARKET_DATA_SECTIONS`, empty here. The
  market-data workstream registers its financials, ownership and relations
  sections there; the tier B page renders whatever is registered.
- **Registry**: tier B companies are a derived entity source (evidence word
  `identified; not profiled`), built before the stubs, excluded from the graph's
  directory resolution (so the graph reads the same whichever pass ran),
  weighted 0.8 in search and retrieval (stubs 0.6), and not dossier subjects.
- **The Ask**: `company_membership` in `lib/chat-tools/universe.ts`.
- **Data agents**: facet `universe` in `scripts/research/add.ts`;
  `prompts/data-entry.md` § "Company universe evidence".

## 6. Second wave (2026-10-27): breadth, and what was left out on purpose

The first wave was 594 admitted from 731 candidates. The second wave read 22
holdings files instead of 14 and 20 SEC industry codes instead of 6, added the
twelfth theme, **defence & aerospace** (State Street XAR, Global X SHLD, SEC
SICs 3812, 3480, 3721, 3728, Wikidata "weapons industry"), and added one
materiality source (`lib/sources/edgar-revenue.ts`): a filer that states no
public float because it files no 10-K cover (a 20-F or 40-F filer such as Arm)
can clear the `revenue` floor on its own tagged annual revenue **in US dollars
only** — a filer reporting in euros or yen is left to a source that states a
dollar figure, because no exchange rate is ever invented. The same rule re-ran:
**793 admitted (tier A 133, tier B 660) from 1,013 candidates; 220 considered
and not admitted** (materiality 219, theme 8, identity 6; one name may fail
several). Evidence rows: 1,784 → 3,091; a dollar revenue was read for 34 filers, which
admitted 12 of them.

Admitted by theme (overlapping, tier A included): compute 109 · AI & data
centres 162 · robotics 155 · space 36 · nuclear 40 · storage & grid 126 ·
electric mobility 95 · materials 121 · quantum 68 · photonics 2 · biotech tools
65 · defence 86. By country, 34: US 474, JP 54, CA 35, KR 32, HK 28, DE 22, GB
20, AU 17, TW 16, CN 12, BR 9, FR 9, and 22 more with 5 or fewer; 11 with none
stated.

**Funds read and then not used, because their subject is not a theme.** A
holdings row proves interest in the FUND's theme, so a fund is only a source for
a theme its name states. Read on 2026-10-27 and dropped: State Street KOMP
("new economies", 500 holdings across fintech, genomics, mobility and more),
XME (metals and mining incl. steel and coal, not critical minerals), Global X
PAVE (US infrastructure construction), HYDR, CTEC, RNRG, First Trust QCLN and
FAN (renewable generation is not storage or grid). Using them admitted 1,063
companies and made "theme" mean nothing. Not read at all: iShares, Invesco,
VanEck, Range (see `FUNDS_NOT_READ`). State Street's files print weights, not
market values, so XAR, HAIL, ROKT and XSD place a company in a theme and give
it an identifier but cannot clear the size floor alone.

**What stays out, and why** (published at `/data/companies`): a name is out when
its only evidence is a fund that prints no market value or a position under the
US$5 million floor, a private company with no stated round or valuation, or a
company whose identifiers resolve to no registry. Airbus, ABB and most large
non-US names held only through State Street files are out today for exactly
that reason. This is a statement about the evidence read, not the company: the
fix is a cited size figure, not a lower floor.

Still holes, each a next adapter: **photonics** (2: no thematic fund file and
no SIC code isolates it); **non-US companies held only by funds that print no
market value** (a free per-venue market-cap source, or index methodology
floors, would fix it); **US filers outside the SIC codes read**, which are
found only if a fund holds them or their SIC is added; **private companies**
(Figure, Unitree and TerraPower stay in `CONSIDERED`; SpaceX is admitted
because the SEC ticker file and two fund files list it as Space Exploration
Technologies, SPCX, with its own CIK and LEI — if that is wrong, the evidence
rows on its page are the place to say so).
