-- Capture the request IP at Fluent test START so the score step can detect a
-- mid-test IP change (possible hand-off / VPN switch / location change) and
-- raise it in the advisory integrity signal (FLU-1). Server-set, never trusted
-- from the client. Nullable + best-effort: a pending migration just means no
-- IP-change flag, never a broken test.
ALTER TABLE eng_fluent_sessions
  ADD COLUMN IF NOT EXISTS start_ip text;

COMMENT ON COLUMN eng_fluent_sessions.start_ip IS
  'Request IP captured at test start; compared at scoring to flag a mid-test IP change in the advisory integrity signal (FLU-1).';
