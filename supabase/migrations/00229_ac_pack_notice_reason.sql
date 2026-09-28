-- Assessment Center: the reason a joining pack went out at short notice.
--
-- BPS 5.40: packs should be sent far enough ahead for participants to prepare
-- (the standard's note suggests two to three weeks for development centres).
-- VIFM's house rule, written into the centre agreement template (clause 8.1),
-- is at least 21 days. The agreement allows a centre to give less for a stated
-- reason, so publishing at short notice is allowed but the reason is recorded
-- here, next to who published and when.
--
-- The notice actually given is not stored: it is the gap between
-- pack_published_at and start_date, and storing it would let the two disagree.

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS pack_late_reason text;

COMMENT ON COLUMN engagements.pack_late_reason IS
  'Why the joining pack was published with less than the 21 days notice VIFM requires (BPS 5.40). Null when notice was met.';
