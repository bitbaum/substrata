# Substrata implementation ledger

Started 2026-09-16. Status: Substrata beta deployed and production journeys verified;
final evidence-boundary prompt and documentation follow-up in validation.

## Requested outcome

A useful research service with checkable visual explanations, reliable data,
clear navigation and search, rich company and talent context, a Substrata
assistant that accepts contributions, personalisation, and current public
development records. Deployment is explicitly authorised by the user.

## Plan and acceptance checks

- [x] Recover current code, instructions, shared capabilities and production configuration.
- [x] Establish evidence and data contracts: provenance, dates, uncertainty,
  validation, reproducible exports and analysis. No invented measurements.
- [x] Build visual chain exploration with accessible explanations, linked evidence,
  useful filters and readable mobile layouts.
- [x] Improve search, navigation, company detail, Learn and Science; add talent
  and concrete contribution paths without inventing vacancies or affiliations.
- [x] Integrate reusable AI infrastructure as Substrata chat, with cited context,
  durable content contributions and truthful delivery receipts.
- [x] Add accounts and saved interests using existing shared authentication where
  practical; distinguish device-only preferences from account persistence.
- [x] Publish development articles and render canonical roadmap, changelog and
  vision; update the OrangeCat and Loki (formerly FleetCrown) profiles.
- [x] Run required gates, browser checks on mobile and desktop, deploy through
  the supported pipeline and verify the deployed revision and user journeys.
- [x] Record completed work, evidence, limitations and exact continuation steps.

## Recovered context

The local checkout originally lagged GitHub. Current work starts from Substrata
main `359bfb1`, on `feat/public-development-surfaces`; no implementation edits
preceded this ledger. Claude had shipped the research portal, Notes, Learn,
Capital, source-backed readiness assessments and a central URL module.

Read `../../fleet/AGENTS.md` and its registers for the canonical identity and
hosting contracts. Roadmaps come from Loki goals; changelogs from project
dev-log entries. Product sites should render them, not maintain competing data.

The public identity audit on 2026-09-15 found 17 served projects, 15 missing
roadmaps, five missing changelogs and 65 total identity/profile gaps. Substrata
had empty identity fields and no linked OrangeCat profile. Re-run
`node ../fleet/scripts/ci/product-identity-audit.mjs --list` before finalising;
these are dated observations, not a replacement for the live register.

## Work log

### 2026-09-16

- Rechecked branch and working-tree state; fetched Substrata and fleet remotes.
- Wrote this ledger before implementation to preserve scope across sessions.
- Added atlas and SVG figure export, a shared search/AI projection, evidence counts,
  JSON digest and CSV exports, talent contributions and company/science connections.
- Added Substrata chat using ai-kit; contributions are explicit writes with receipts,
  same-origin/body-size/rate guards, and a private reviewer inbox.
- Added OrangeCat OIDC and account-based technology interests. Provisioned the
  dedicated PostgreSQL database, client credentials and reviewer identity on bitbaum.
- Confirmed the host backup job discovers every non-template database and app env,
  so it includes Substrata without a second database list.
- Populated the canonical Loki identity and four substantive roadmap goals.
- Published the linked OrangeCat project via Loki's existing integration:
  `6759d848-c438-462c-9058-b8848986b35f` (publication returned success).
- Added canonical roadmap/changelog/vision rendering, a development article,
  and universal public Loki profile pages at `/fleet/[slug]`.
- First Substrata verify passed 60 tests; first production build passed.
  Further figure/retrieval changes are being verified. Loki full verify passed
  181 unit-test files plus home/operational gates.
- First Playwright pass: eight key routes at 390px and 1440px, no page overflow
  or non-200 responses. Screenshots under `/tmp/substrata-audit`.
- Improved the atlas after inspection: collapsible stage records and a separate
  source-labelled chain diagram; tightened the mobile footer to two columns.

## Verification and deployment

Substrata PR #43 deployed as `ecca727`; Loki PR #737 deployed as `f1d35e5d`.
Substrata PR #44 deployed as `a370a704` (successful CI and Deploy run
`35062856491`). The public atlas, profiles, export and diagram
work. A missing PostgreSQL HBA allowlist rule initially broke writes; corrected
with a localhost-only app/database rule and a TCP login probe in provisioning.
Production AI now answers and contribution receipt storage succeeds. Anonymous
review access returns 404; foreign-origin writes return 403; missing consent 400.

Follow-up branch `fix/research-production-verification` improves health readiness,
fixes optional-email rejection during OIDC sign-in, renders assistant Markdown,
and clarifies inherited ambiguous GlobalWafers wording and retrieval attribution.
These fixes are deployed and passed repeat production verification.

### Production evidence, 2026-09-16

- Actual OrangeCat login using a temporary verified account, OAuth consent,
  return to Substrata, saved interests and persistence after reload all passed.
- Signed-in non-reviewer and anonymous requests to the private inbox returned 404.
- Mobile browser question returned rendered Markdown and working citation anchors;
  submission through the contribution tab returned a durable receipt.
- API checks: foreign-origin write 403, missing consent 400, valid submission 201,
  sourced AI answer 200, SVG figure 200 and matching JSON SHA-256.
- Eight routes at both 390px and 1440px: no non-200 response, browser error or
  horizontal document overflow. Local screenshots: `/tmp/substrata-audit`.
- Snapshot retained in the database:
  `dc39d7262b8feb018bf49cb2536e68f984a56e5e559bb3501386ad7e07b2baad`.
  The checked corpus contained 29 bottlenecks and 92 producer records, of which
  62 were sourced, 20 candidate and 10 unverified. These are coverage counts.
- Canonical changelog appended and roadmap progress updated in Loki. OrangeCat
  project description was projected from that profile with development links;
  the article summary and canonical link were cross-posted successfully using
  Loki's existing, idempotent publication integration.
- Removed the temporary OrangeCat identity, saved preferences and all three
  exact test contributions. Removed local and remote fixture credential files.
- Loki PR #738 updates the hosting register to name the dedicated database.

### Limits and remaining fleet work

This is a beta. Primary-source coverage is incomplete; sources for production
do not establish market shares, customer contracts, capacity or employment.
Assistant output remains fallible: a production answer overgeneralised coverage
into total world supply. A follow-up system instruction explicitly prohibits that
inference; continue answer-quality evaluation rather than treating citations as
proof of correctness. Contributions await human review; the inbox does not
automatically publish claims or send email. Personalisation currently saves
technology interests, not an entire persistent conversation history.

Loki public profiles now render development records across the fleet. The full
identity audit on 2026-09-16 still finds 57 gaps among 17 served projects:
14 missing roadmaps, four missing changelogs, nine missing OrangeCat profiles,
12 missing Solon organisations, plus identity fields. Substrata's sole remaining
identity-audit gap is a Solon organisation. This session did not complete
fleet-wide remediation and must not be reported as having done so.

Missing roadmaps: aoz-housing, botsmann, causius, datacat, evig, heidi, kivvi,
petvity, revamp-info, s-ink, solon, surf-your-life, vitareba and wild-spirit.
Missing changelogs: botsmann, causius, petvity and s-ink.

Next session: rerun the canonical audit; inspect each affected repository's
current plans and merged changes; populate substantive goals and factual dev-log
entries in Loki; render those records on each product site; then verify public
routes. Do not insert placeholder milestones to make the audit green. The
canonical roadmap retains the ongoing company/source research work.
