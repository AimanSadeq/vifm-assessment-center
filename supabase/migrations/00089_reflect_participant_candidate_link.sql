-- Bridge the Reflect participant to the AC candidate (same person), so a
-- combined engagement can pull the 360 for a given candidate.
-- (Renumbered from handover 00080.)
ALTER TABLE reflect_participants
  ADD COLUMN candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL;

CREATE INDEX idx_reflect_participants_candidate ON reflect_participants(candidate_id);

-- Email is the fallback matcher when candidate_id is null (both tables hold email).
