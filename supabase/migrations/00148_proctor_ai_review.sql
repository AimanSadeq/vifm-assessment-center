-- Camera proctoring Phase 2: AI vision review of snapshots.
--
-- Per-snapshot flags live in the existing proctor_snapshots.flags jsonb (00147)
-- and now carry { motion (client-side), faces, looking_away, device_or_screen,
-- ai_note }. The session-level review summary + when it was run live here.

alter table public.proctor_sessions
  add column if not exists ai_review jsonb,
  add column if not exists ai_reviewed_at timestamptz;
