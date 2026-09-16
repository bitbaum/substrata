# Substrata implementation ledger

Started 2026-09-16. Status: in progress. Owner: current coding session.

## Requested outcome

A useful research service with checkable visual explanations, reliable data,
clear navigation and search, rich company and talent context, a Substrata
assistant that accepts contributions, personalisation, and current public
development records. Deployment is explicitly authorised by the user.

## Plan and acceptance checks

- [x] Recover current code, instructions, shared capabilities and production configuration.
- [ ] Establish evidence and data contracts: provenance, dates, uncertainty,
  validation, reproducible exports and analysis. No invented measurements.
- [ ] Build visual chain exploration with accessible explanations, linked evidence,
  useful filters and readable mobile layouts.
- [ ] Improve search, navigation, company detail, Learn and Science; add talent
  and concrete contribution paths without inventing vacancies or affiliations.
- [ ] Integrate reusable AI infrastructure as Substrata chat, with cited context,
  durable content contributions and truthful delivery receipts.
- [ ] Add accounts and saved interests using existing shared authentication where
  practical; distinguish device-only preferences from account persistence.
- [ ] Publish development articles and render canonical roadmap, changelog and
  vision; update the OrangeCat and Loki (formerly FleetCrown) profiles.
- [ ] Run required gates, browser checks on mobile and desktop, deploy through
  the supported pipeline and verify the deployed revision and user journeys.
- [ ] Record completed work, evidence, limitations and exact continuation steps.

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
Production verification is ongoing. The public atlas, profiles, export and diagram
work. A missing PostgreSQL HBA allowlist rule initially broke writes; corrected
with a localhost-only app/database rule and a TCP login probe in provisioning.
Production AI now answers and contribution receipt storage succeeds. Anonymous
review access returns 404; foreign-origin writes return 403; missing consent 400.

Follow-up branch `fix/research-production-verification` improves health readiness,
fixes optional-email rejection during OIDC sign-in, renders assistant Markdown,
and clarifies inherited ambiguous GlobalWafers wording and retrieval attribution.
These fixes still require deployment and repeat production verification.

Temporary operational fixtures to remove after testing:

- Contribution receipt `9434cd8e-7f84-473e-8431-8be9f5528ecd` (deployment test).
- OrangeCat test identity metadata at `/tmp/substrata-auth-fixture.json` on laptop
  and host. This file contains test credentials; never commit or print it.
