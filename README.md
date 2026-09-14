# Substrata

Open-source research on the physical chokepoints between here and a
technological singularity.

Live at **https://substrata.orangecat.ch** — that is an address, not an
affiliation. Substrata is its own firm, its own repository and its own
deployment, the same as every other site in the studio. The subdomain is used
because that apex domain is already owned; it moves to its own domain the day
one is bought, and nothing in this repository changes when it does.

## Shape

```
config/     the research corpus and the site, as data — the SSOT
            substrata.ts               identity, mandate, phases, disclosure
            substrata-coverage.ts      15 chokepoint materials, 92 producer rows
            substrata-participants.ts  101 organisations across 10 chain layers
            substrata-acting.ts        thesis, action routes, readiness ledger
            site-substrata.ts          those objects, rendered as pages
            site-content.ts            the closed set of section shapes
lib/        the site's identity and link helper. The renderers themselves come
            from the shared sitekit package; presentational only, never fetch.
app/        one catch-all route. Pages are data, so adding one is a config entry.
app/globals.css   every design token, and the only place a colour is defined.
```

Nothing on the site is authored twice: the mandate, the coverage universe and
the directory exist once, and the pages are those objects rendered.

Every producer row starts unsourced and renders as "unverified lead", never as
a finding. There is no trading desk and nothing here implies one.

## The portal

The front of the site is a board, not a document: four numbers, then every
bottleneck as one row, grouped by the curve it gates and narrowed by links
(`listkit` owns the URL query). Each row is a page — why it gates, who makes
it, and the evidence — and the research programme is drawn as a ladder of loop
layers to scale. The long-form pages (mandate, thesis, participants, acting,
disclosure) still render from the same config and live in the footer.

```
app/page.tsx                    the board (/)
app/bottlenecks/[slug]/page.tsx one page per bottleneck
app/research/page.tsx           the programme, as a ladder
app/[...path]/page.tsx          the document pages, via sitekit
components/portal/              shell, board, ladder, status — portal-only markup
lib/bottlenecks.ts              materials + chokepoints as one list, and the list spec
```

## Research engine

`research/evidence.json` is what the engine has found; `config/substrata-coverage.ts`
is what the firm asserts. They are kept apart on purpose. A row reads one of
three ways — unverified lead, candidate source, sourced — and only the last is
a finding.

```bash
# The fleet's SearXNG listens on the box's loopback only. From a laptop, tunnel it.
ssh -N -L 8899:127.0.0.1:8899 ubuntu@167.233.22.31 &
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:source            # rows not yet examined
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:source --all      # re-examine everything
SEARXNG_URL=http://127.0.0.1:8899 pnpm research:source --limit 5  # a quick run
```

For each unverified producer row it searches for the company with the
material's keywords, reads the top pages through ai-kit's SSRF-checked reader,
and files a page as a candidate only if it names the company AND a material
term, with the matching excerpt. Promotion to "sourced" is a deliberate edit
to the coverage file by someone who read the excerpt. Commit the evidence file
after a run: git is the timestamp.

## Programmes

`config/substrata-programmes.ts` holds the questions the firm has been
commissioned to answer, each layer of a question cross-referenced to rows in
the coverage universe (a test enforces that every cited row exists), and an
open question is only open if it names what would settle it.

## API

- `GET /api/health` — liveness plus the coverage meter.
- `GET /api/map` — the whole map as one JSON document: materials, producers with
  their three-valued verification and candidate URLs, chokepoints, participants,
  thesis, programmes, readiness. Built from the same config the pages render.

## Development

```bash
pnpm install
pnpm run dev        # http://localhost:3000
pnpm run verify     # format check + type-check + lint + tests
```

## Deployment

Push to `main`. CD is the shared self-host pipeline
(`bitbaum/loki/.github/workflows/selfhost-deploy.yml`), which waits
for this commit's CI, builds, rsyncs to bitbaum and health-checks before
declaring done. Port and hostname come from `scripts/hetzner/apps.conf` in
loki — the SSOT for what runs on the box.
