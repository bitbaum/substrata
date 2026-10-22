BEGIN;

-- The chat-review loop (docs/INFRASTRUCTURE.md, "Chat review"). Every Ask
-- turn is kept so a nightly judge in Loki can read a day of conversations
-- and say what the reader most likely wanted, what Substrata could have
-- given with the tools it has, and what it gave. Nothing here names a
-- person: the ids are random, minted by the reader's browser for the thread
-- and by the server for each turn; no reader, no IP, no key.
CREATE TABLE IF NOT EXISTS chat_turns (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  -- The status and tool labels the reader saw while the answer was written.
  steps jsonb NOT NULL DEFAULT '[]',
  -- The page the question was asked from ('/chat', '/markets/asml').
  surface text NOT NULL DEFAULT '/chat',
  failed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_turns_conversation ON chat_turns (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS chat_turns_created ON chat_turns (created_at);

-- A thumb under an answer (chatkit's AnswerFeedback): up or down, a reason
-- from chatkit's FEEDBACK_REASONS, and the reader's own words if any.
CREATE TABLE IF NOT EXISTS chat_feedback (
  id bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('up', 'down')),
  reason text,
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_feedback_conversation ON chat_feedback (conversation_id, created_at);

COMMENT ON TABLE chat_turns IS 'Every Ask turn (question, answer, steps, surface) for the nightly chat review; random ids only, no reader.';
COMMENT ON TABLE chat_feedback IS 'Thumbs under Ask answers (chatkit AnswerFeedback), exported with the conversation for review.';

COMMIT;
