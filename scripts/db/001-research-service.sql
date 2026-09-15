BEGIN;
CREATE TABLE IF NOT EXISTS research_preferences (
 actor_id text PRIMARY KEY,
 topics jsonb NOT NULL DEFAULT '[]',
 saved_paths jsonb NOT NULL DEFAULT '[]',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS research_contributions (
 id uuid PRIMARY KEY,
 actor_id text,
 message text NOT NULL CHECK(length(message) BETWEEN 10 AND 12000),
 topic text NOT NULL DEFAULT '',
 reply_to text,
 credit_name text,
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','accepted','declined')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_contributions_inbox ON research_contributions(status,created_at DESC);
CREATE TABLE IF NOT EXISTS research_rate_limits (
 key text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 hits integer NOT NULL
);
CREATE TABLE IF NOT EXISTS research_snapshots (
 sha256 text PRIMARY KEY CHECK(length(sha256)=64),
 schema_version integer NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now(),
 data jsonb NOT NULL
);
COMMENT ON TABLE research_snapshots IS 'Derived immutable analysis snapshots; versioned repository corpus remains the producer.';
COMMENT ON TABLE research_contributions IS 'Private content review inbox. No automatic promotion into the research corpus.';
COMMIT;
