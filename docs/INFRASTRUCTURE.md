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

Migration: `scripts/db/001-research-service.sql`, additive and idempotent. Apply
it before deploying the routes. SQL runs as the app role so ownership is correct.
The generic deploy workflow does not apply this migration automatically.

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

## Authentication and contributions

Auth.js uses OrangeCat OIDC with state and PKCE, client-secret-post, and only
openid/profile/email scopes. No local password store. A verified identity is
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
