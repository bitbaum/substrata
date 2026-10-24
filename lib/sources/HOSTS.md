# Source hosts — the allow-list

An adapter may call these hosts and no others (`lib/sources/hosts.ts`, which
`test/sources.test.ts` keeps in step with this page). Every request carries a
descriptive user agent naming the repository and a contact; responses are
cached under `.tmp/sources/` for a day so a re-run, and add.ts's check right
after it, read the same bytes. Checked from the build sandbox on 2026-10-24.

| Host | Adapter | What it is | Terms we keep | Pace |
| --- | --- | --- | --- | --- |
| `www.sec.gov` | edgar | company tickers, filing documents | SEC fair access: name + e-mail in the agent, ≤ 10 req/s. SEC answers 403 to an agent carrying a URL, so EDGAR's agent is `Substrata-research bitbaum cato@orangecat.ch` | 200 ms |
| `data.sec.gov` | edgar | submissions (filing lists) | as above | 200 ms |
| `api.gleif.org` | gleif | LEI records, Level 2 relationship records | free, no key, CC0 data; 60 req/min | 1.1 s |
| `query.wikidata.org` | wikidata | SPARQL | descriptive agent, no parallel bursts; CC0 | 1 s |
| `www.wikidata.org` | wikidata | entity JSON (`Special:EntityData`) | as above | 1 s |
| `comtradeapi.un.org` | comtrade | public preview API and reference files | no key for `/public/v1/preview` (500 rows a call); a 429 is waited out | 4 s |
| `www.kazatomprom.kz` | kazatomprom | investor-relations pages and report PDFs | public company disclosures; PDFs up to 64 MB | 2 s |

Not on the list, and why:

- **Companies House** needs a (free) key; add it with the key in the
  environment, never in the repository.
- **Exchange feeds** (ASX, SEDAR+, KASE, LSE RNS) and **national cadastres**
  have no adapter yet; a data agent quotes their pages through `add.ts`, which
  reads any public page with its SSRF guard.

To add a host: its row in `ALLOWED_HOSTS` (agent, pace, size cap), a row here
with the terms you read, and a recorded fixture for its adapter's test.
