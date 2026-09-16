BEGIN;
CREATE TABLE IF NOT EXISTS research_page_messages (
  id uuid PRIMARY KEY,
  path text NOT NULL,
  author_id text NOT NULL,
  author_kind text NOT NULL CHECK (author_kind IN ('human', 'ai', 'system')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_page_messages_path ON research_page_messages (path, created_at);
COMMENT ON TABLE research_page_messages IS 'Public page threads. Permission is participation via threadkit; storage is this table.';
COMMIT;
