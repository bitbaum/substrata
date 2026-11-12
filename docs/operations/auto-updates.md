# How the research updates itself

Substrata's corpus is git: nothing below writes to it. The automatic path finds
**leads** on the open web and files them in Postgres queues; a person reads a
lead at `/review` and accepts it, which is what makes it a finding. This page
says what runs, when, what it needs, where it leaves a trace, and how to tell
why it stopped.

## What runs

Every scheduled run is a `POST` to an `/api/cron/<name>` route, made by a
systemd timer on the box through `/opt/_appcron/run.sh` with
`Authorization: Bearer $CRON_SECRET`. A route refuses the call when the secret
is unset or wrong. Each route may run for 290 s (`maxDuration`); the wrapper
stops a call at 300 s.

| Run | Route | When | Leaves | Code |
| --- | --- | --- | --- | --- |
| Event sweep | `/api/cron/sweep` | timer hourly; runs when due per the sweep settings (default every 6 h, 4 bottlenecks a run) | `research_sweep_candidates`, `research_sweep_runs` | `lib/sweep.ts`, `lib/sweep-store.ts` |
| Producer sourcing | `/api/cron/source` | every 6 h | `research_source_candidates`, `research_source_runs` | `lib/source.ts`, `lib/source-store.ts` |
| Event drafts | `/api/cron/auto-updates` | hourly; only for readers who switched automatic updates on, each on their own key | `research_event_draft_runs` | `lib/auto-updates.ts` |
| SEC filings | `/api/cron/filings` | hourly | `research_filing_runs` | `app/api/cron/filings` |
| Science feeds | `/api/cron/science` | hourly | `research_science_runs` | `app/api/cron/science` |
| Job boards | `/api/cron/jobs` | daily | `research_job_runs` | `app/api/cron/jobs` |
| Official statistics | `/api/cron/series` | daily | `research_series_runs` | `app/api/cron/series` |
| Share prices, then company financials | `/api/cron/prices` | daily at 22:07 UTC | `research_price_runs`, `research_market_fact_runs` | `deploy/systemd/appcron-substrata-prices.*` |
| Data-quality checks | `/api/cron/quality` | every 6 h | `research_quality_runs` | `app/api/cron/quality` |

The cadences are declared once, in `config/substrata-freshness.ts`, and that is
what `/data/freshness` judges each run against. The prices timer's unit files
are in this repository (`deploy/systemd/`) and are installed by the deploy
(`docs/operations/data-layer.md`); the other timers are installed on the box by
the fleet's app-cron script in `bitbaum/loki`.

Readers can also start the event sweep themselves: opening the desk sweeps the
reader's stalest followed bottlenecks, and "Update news now" on a bottleneck,
company or desk page sweeps those bottlenecks. A bottleneck is swept at most
once per cooldown however many readers ask (`sweepStaleNow`,
`lib/sweep-store.ts`).

The sweep's cadence, batch size, pages per bottleneck, extra blocked hosts and
event words are reviewer settings at `/account/settings#sweep`, stored in
`research_sweep_settings`, so they change without touching the box.

## What the web runs need

The event sweep, producer sourcing and the Ask assistant's web answers all
search through the same package call, `webSearch` from `@bitbaum/ai-kit/web`,
and read pages through its `readPage`, which re-checks the address on every
redirect. `webSearch` walks the backends the environment configures, in order:
SearXNG (`SEARXNG_URL`, self-hosted on the box), then Brave
(`BRAVE_SEARCH_API_KEY`), then Tavily (`TAVILY_API_KEY`); `SEARXNG_TOKEN`, when
set, is sent to SearXNG as a bearer token. The manual workflow
`.github/workflows/share-search-backend.yml` copies any of those four names that
Substrata's runtime env lacks from Causius's runtime env on the same box, then
redeploys. Its one run so far (2026-10-22) added nothing: `SEARXNG_URL` was
already set for Substrata, and Causius's env had none of the other three. So
production has SearXNG and no paid fallback.

A search has three outcomes, and they are kept apart everywhere: `found`,
`nothing` (a backend answered and had nothing) and `could_not_look` (no backend
answered). A run in which every search could not look is a failed run; it is
never recorded as "no news".

## Where it leaves a trace

- **Each run** writes a row to its run table when it starts and completes it
  when it finishes: counts of what it looked at, found, and could not look at.
  The sweep and producer sourcing also record what their search backends did,
  in ai-kit's own words (`search_note`, e.g. `searxng unreachable`;
  `scripts/db/018-search-notes.sql`, `lib/search-note.ts`).
- **`/data/freshness`** and its machine face **`/api/health/freshness`** read
  every run table and say, per run: when it last succeeded, when it last
  failed, runs this week, and a state — fresh, late, stale, failing, on demand,
  or not scheduled. A failing run carries its reason: the rule that marked it
  failed, in words (`failedMeans`), what its search backends did where the run
  recorded it, or that the last run started and never finished.
- **`/api/health/web`** searches once for a fixed phrase and reports which
  backends are configured (names only) and what each did, at most once every
  ten minutes whoever asks. It answers "can this deployment search the web
  right now?" without waiting for the next timer.
- **Ask answers** carry how their web search went; when no page came back, the
  line under the answer says whether the search could not be reached or found
  nothing readable.
- **Leads** wait at `/review` and on the desk. An unreviewed lead expires from
  the queue after 30 days (`lib/lead-expiry.ts`) and is listed at
  `/data/freshness/expired`.

## When a run is failing

1. Open `/data/freshness`. The note beside the failing run says which kind of
   failure it is.
2. "No search reached a search backend": check `/api/health/web`. Its
   `attempts` names the backend and the failure kind (`unreachable`,
   `timeout`, `rate_limited`, `auth`, `bad_response`, `not_configured`).
   `backends: []` means no backend is configured: run
   `share-search-backend.yml`, or add a key to the app's env on the box and
   redeploy (or restart the app) so the running process reads it.
3. "Started and did not finish": the run hit the wrapper's 300 s limit or
   crashed. The route's own budget constants are the place to look.
4. To run a timer now, on the box: `sudo systemctl start
   appcron-substrata-<name>.service`.
