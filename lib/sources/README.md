# lib/sources — source adapters

Free public registries and filings, turned into **candidate rows with
quotes**. An adapter never writes curated data, never guesses an identity and
never infers: it proposes rows, and `scripts/research/add.ts` decides.
Design: `docs/architecture/2026-10-24-research-systems.md` §4, §6.

| file | job |
| --- | --- |
| `hosts.ts`, `HOSTS.md` | the allow-list: agent string, pace, size cap per host |
| `http.ts` | `sourceFetch`: allow-listed GET, 429 back-off, cache in `.tmp/sources/` |
| `document.ts` | `readDocument`: PDF page by page, JSON as served, HTML as text — the same reader add.ts uses |
| `pdf.ts` | `pdfPages` (unpdf), `findQuoteInPages` (line breaks and end-of-line hyphens forgiven, words not) |
| `text.ts` | cut a quote out of fetched text: a sentence, or a JSON span (20–400 chars; one whole record up to 800) |
| `endpoints.ts` | a name to an entity id, or "unresolved" with the reason |
| `proposal.ts` | `finalise`: quote found in the fetched text, grade ceiling, relations schema, provenance |
| `comtrade.ts` | UN Comtrade exports → `country ships_to country` with net weight (the goods' mass, said in `note`) |
| `kazatomprom.ts` | newest annual report and trading update PDFs → `ships_to` sentences |
| `gleif.ts` | LEI relationship records → `parent owns child` |
| `wikidata.ts` | owned by / parent / operator → `lead` unless a second source agrees |
| `edgar.ts`, `edgar-text.ts` | 10-K customers → `supplies`; DEF 14A 5% holders → `owns` with share |
| `registry.ts` | which adapter serves which dossier task; runs them in order |

**The rule**: a row's quote must stand in the text the adapter fetched from
that URL (`finalise`), or the row is dropped and listed as skipped. Every row
carries `provenance: { adapter, fetchedAt, url }` and, for a PDF,
`source.locator: "page N"`, and `submittedBy.model: "deterministic-adapter"`.
Wikidata alone is capped at `lead`. A lead or a figure that needs reading
carries a `note` saying why.

**Run one**: `pnpm exec tsx scripts/research/run-task.ts country:kz#trade`
(dry run; `--write` sends the rows through add.ts, leads only with
`--include-leads`; it ends with a plain list to paste into the PR). Identity is the caller's:
`--lei`, `--qid`, `--cik` (`--find-lei "Name"` / `--find-qid "Name"` list
candidates). Tests: `test/sources*.test.ts` on recorded responses in
`test/fixtures/sources/` (`manifest.json` maps each URL to its file).
