# Research service operations

Hosting and organisation facts: read `../../fleet/AGENTS.md` and its producers.

## Data ownership

- Research corpus: versioned config and `research/*.json`. Tests validate joins.
- Visuals/search/assistant: projections of that corpus, not independent records.
- Export: `/api/research/export`, schema version and digest; CSV available with
  `?format=csv`. Digest excludes generation time and includes the full data object.
- Analysis snapshots: `research_snapshots`, immutable derived JSONB keyed by digest.
  Run `scripts/capture-snapshot.ts` with the runtime DATABASE_URL after deployment.
  It verifies the public export digest before insertion; repeat runs deduplicate.
- Reader interests: `research_preferences`, keyed by the OrangeCat OIDC subject.
- Contributions: private `research_contributions` inbox, independent of AI output.
- Roadmap/vision/changelog: Loki's canonical profile, read with five-minute caching.

## Provisioning and migrations

`scripts/provision-service.py` runs on bitbaum as root, taking the versioned SQL
file as its argument. It provisions a dedicated PostgreSQL role/database,
registers an identity-only OrangeCat OAuth client, and writes credentials only
to the existing runtime environment. Existing secrets are retained; it refuses
to silently rotate an existing client. It backs up the environment before edits.

Migration: `scripts/db/001-research-service.sql`, additive and idempotent. The
provisioning script applies it once, as the app role, when it creates the role
and database; that is the only step that needs a root shell, and only on a new
box.

Every numbered file under `scripts/db/` (`001` to `017` so far) is applied by the
normal deploy, before the new release goes live: `scripts/ops/data-layer.ts
migrate` runs each pending file in one transaction, records it in
`public.schema_migrations`, and stops the deploy on a failure with the live
release untouched. `docs/operations/data-layer.md` is the chain, how to add a
migration, and how to roll one back. The files below describe what each is for.

`004-source-sweep.sql`
backs the scheduled producer-sourcing run (`POST /api/cron/source`,
`lib/source-store.ts`); it also needs `/api/cron/source` added to whatever
schedule `/opt/_appcron/run.sh` already drives `/api/cron/sweep` on.
`005-desk.sql` (desk marks and `research_sweep_settings`) is applied.
`007-ai-keys.sql` (`research_ai_keys`) backs readers' saved AI keys; they are
sealed with `SUBSTRATA_BYOK_SECRET` from the runtime env, and without that
secret Ask offers browser-only keys.
`008-ai-spend.sql` (`research_ai_spend`) is the ledger of the site's free AI
(`lib/ai-budget.ts`). Since 2026-09-25 only readers spend it — Ask and
fact-checks; no background job calls the free models (see "From lead to
event" below). The `background` class stays so earlier days still read
correctly on `/data`.
`012-ask-timing.sql` (`research_ask_timing`, applied 2026-09-25) holds Ask's
per-question latency — durations and call counts only, no question text — for
the p50/p90 on /data#ask-latency; the same line goes to the journal as
`substrata ask-timing {…}`.
`017-accounts.sql` holds the account tables; see "Authentication and
contributions" below.

### Chat review

`015-chat-review.sql` (`chat_turns`, `chat_feedback`) backs the fleet's
chat-review loop. `/api/chat` logs every Ask turn — the question, the answer,
the status and tool labels the reader watched, the page it was asked from and
whether it failed — under random ids the browser mints per thread
(`lib/chat-review/log.ts`); the thumbs chatkit draws under every answer land
in `chat_feedback` through `POST /api/chat/feedback`, same-origin and rate
limited like Ask itself. Nothing in either table names a reader. Loki's
nightly judge reads a day of conversations from
`GET /api/chat/review-export?since=<ISO>&limit=50` with
`Authorization: Bearer $CHAT_REVIEW_TOKEN` — the one value shared by every
app on the box, written into this env by Loki's `share-chat-review-token`
workflow; while it is unset the route answers 503 — and files what Substrata
should have answered into its feedback inbox. The export's `scope` is built
from the system prompt and the tool registry (`assistantScope` in
`lib/chat-agent/prompt.ts`), so it says what the assistant can actually do on
this deployment.

The sweep's cadence lives in the database, not on the box. The box timer
`appcron-substrata-sweep.timer` fires hourly at :17, and `/api/cron/sweep`
decides whether a run is due from `research_sweep_settings.everyHours`
(`lib/sweep-store.ts`), which a reviewer edits at `/account/settings#sweep`.
An hourly call that is not due returns `skipped: 'not due'` and does nothing.

Each engine has one queue, and it is in this database: the sweep's is
`research_sweep_candidates`, producer sourcing's is `research_source_candidates`
(timer `appcron-substrata-source`, every six hours). The hand-run CLIs were
removed on 2026-09-25, and so were `research/events.json` and `research/evidence.json`,
their committed worklists, after their unreviewed rows were copied into these tables
(25 sweep leads, 2 source pages; the rest were already present or belonged to
rows since sourced). A test fails if either file comes back.

Backups must include the new `substrata` database with the host's PostgreSQL
backup service. Verify the service's database-discovery rule after provisioning.
Research corpus changes remain reconstructable from git.

An example reproducible analysis, choosing a specific snapshot digest:

```sql
SELECT b->>'stage' AS stage, count(*) AS mapped_bottlenecks
FROM research_snapshots,
     jsonb_array_elements(data->'bottlenecks') b
WHERE sha256 = '<recorded snapshot digest>'
GROUP BY b->>'stage' ORDER BY stage;
```

Analysis outputs must name that digest and distinguish corpus counts from
claims about the entire market. Do not mutate a captured snapshot to correct
research; correct the source corpus, redeploy, and capture a new digest.

## Market data

`lib/market-data/` holds share prices, reported financials and holders for the
listed companies in its seed (`lib/market-data/identity.ts`, keyed by
`{exchange, symbol}` and CIK — the seam the company universe will replace).
`016-market-data.sql` creates `research_price_points` / `research_price_runs`
(daily closes) and `research_market_snapshots` / `research_market_fact_runs`
(SEC EDGAR fundamentals and holders per CIK). The deploy applies it like every
other numbered file, then runs `pnpm exec tsx scripts/research/market-data.ts
--backfill` once from the CI runner (through an ssh tunnel), records it in
`public.schema_oneshots` as `market-data-backfill`, and never runs it again;
`docs/operations/data-layer.md` says how.

`POST /api/cron/prices` (same `CRON_SECRET` gate as `/api/cron/series`) fetches
every seed listing's closes, then refreshes the EDGAR snapshots in the time
left. Its timer is a file in this repo, installed by the deploy:

```
deploy/systemd/appcron-substrata-prices.timer   OnCalendar=*-*-* 22:07:00 UTC   → POST /api/cron/prices
```

Until a deploy has installed it, `/data/freshness` shows "Share prices" and
"Company financials and holders" as not installed, and the Ask reads prices and
filings live, cached in process.

Prices come from Yahoo Finance's chart endpoint under its personal-use terms:
end-of-day, split-adjusted closes, labelled delayed, never exported. Why that
source, what was rejected and its failure modes: `lib/market-data/prices/chain.ts`.

## From lead to event

`010-event-drafts.sql` backs the drafter. It reads a lead's page and asks a
model for a draft CoverageEvent plus an "event / not an event" suggestion
(`lib/event-draft.ts`, `lib/event-draft-run.ts`). A draft whose quote is not
on the fetched page word for word is refused after one retry; names are cut
to the directory's. Nothing is published by this.

**No background job spends the free AI** (George, 2026-09-25: "background jobs
should not exist if there is a free tier only"). The free chain is kept for
readers' questions (Ask, fact-checks). Drafting calls a model only through
`lib/byok-ask.ts`, on a reader's own key, in two ways:

- **Update news now** (bottleneck pages, company pages, the desk;
  `components/updates/UpdateNews.tsx`). Step one, `POST /api/updates`, sweeps
  the page's bottlenecks with the self-hosted SearXNG sweep (`sweepStaleNow`,
  15-minute cooldown per bottleneck, `update-now` rate lane per visitor) and
  returns the open leads — no AI, signed out too. Step two, `POST
  /api/updates/draft`, "Summarise with AI", drafts up to three of them on the
  key the reader sends (browser) or has sealed on their account; without one
  it answers 402 and the page offers the key panel.
- **Automatic AI updates** (`/account/settings#auto-updates`, `lib/auto-updates.ts`).
  A reader with a key sealed on their account may switch it on and pick a
  daily cap. `POST /api/cron/auto-updates` (box timer
  `appcron-substrata-auto-updates`, hourly at :32) drafts up to five new leads
  per opted-in reader per run, on that reader's rails and key, counted per UTC
  day in `research_auto_draft_days` (`013-auto-updates.sql`). Nobody opted in
  means no model call.

`test/no-free-background-ai.test.ts` walks the import graph from every
`app/api/cron/**` route and the background modules and fails on any path to
`freeChain`/`usableChain`, the Ask turn, the free ledger, or a model call
outside `lib/byok-ask.ts`. The old `/api/cron/drafts` timer is gone (loki#890).
`/data/freshness` reports drafting as "on demand", never late.

At `/review` each lead shows its draft as an editable form beside the page
text around the quote. Accept re-checks the edited row with `lib/event-rules.ts`
(the quote against the stored page text) and parks it in
`research_event_drafts.accepted_event`; the lead leaves the queue.

The box has no checkout and no GitHub token, so accepted rows reach git by
hand: download `/review/accepted` (reviewer only), then in a checkout run
`pnpm run research:accept-events <file>` — or run it with `DATABASE_URL`
through an ssh tunnel. It appends to `config/substrata-events-accepted.json`,
which `EVENTS` includes; commit that on a branch and let `pnpm test` check it.
Once the commit is deployed a row drops off the "awaiting commit" count by
itself. `/data`, the desk and `/review` show the queue: waiting, oldest, drafts
ready (`reviewQueue()` in `lib/event-draft-store.ts`).

## Authentication and contributions

Accounts are the fleet's account package, `@bitbaum/accountkit` (`lib/auth.ts`):
an email and a password, a passkey, two-step codes, or "Continue with OrangeCat"
(OIDC with PKCE, client-secret-post, only openid/profile/email scopes). Screens
are `/sign-in`, `/sign-up` and `/account/settings#account`. The tables are
`017-accounts.sql` (`users`, `accounts`, `sessions`, `verifications`,
`passkeys`, `two_factors`); passwords are stored only as slow salted hashes.
No mail is sent yet, so the sign-in link and address confirmation stay hidden.
A person whose first way in was OrangeCat keeps their OrangeCat actor id as
the id desks, follows and saved keys use (`legacyIdentityProvider`), so rows
from before accounts stay theirs. OrangeCat's client must list
`https://substrata.orangecat.ch/api/auth/oauth2/callback/orangecat` as a
redirect URI (`scripts/provision-service.py` registers it). An account is
required for saved interests; reading, questions and contributions are public.
`SUBSTRATA_REVIEWER_ACTOR_IDS` grants private inbox access at `/review`.
Reviewer identities are resolved from the existing owner identity during setup.

Only explicit contribution submissions are stored. Questions go to the AI
provider with retrieved public context, and are not written to the inbox.
Receipts are issued after a successful insert. AI has no tools to write records.
The app accepts no arbitrary fetch URL supplied by a visitor. Same-origin checks,
bounded bodies and PostgreSQL-backed hourly throttles protect both write paths.
The reverse proxy must overwrite/append the actual client IP in X-Forwarded-For.

## Review and retention

Read the private inbox at `/review`. Check sources before changing the corpus;
record accepted corrections in a commit and public changelog. Never publish
optional reply addresses. Credit only the supplied credit name. A removal
request quotes its receipt; the operator deletes only that identified record.
Prune expired rate-limit rows older than seven days; retain research submissions
only while needed for review and correspondence. No automatic emails are sent.

## Deployment verification

Run `pnpm run verify` and `pnpm run build`. Deploy via the shared workflow and
check the public `/api/health`, atlas, search, article and export. Exercise an
actual AI request and an explicitly labelled operational contribution; verify
the receipt in storage, then remove that one test record. Check `/review` is
unavailable without reviewer identity and account endpoints do not expose
another user's preferences. Complete OrangeCat login in a browser when a
real account session is available; do not claim callback success from a redirect.
