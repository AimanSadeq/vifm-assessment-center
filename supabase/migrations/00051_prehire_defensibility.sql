-- ════════════════════════════════════════════════════════════════
-- VIFM Pre-Hire — defensibility layer
-- Three additions that make the screening legally/professionally defensible,
-- all additive to migration 00050:
--
--   1. Voluntary demographic self-identification on prehire_candidates
--      (gender / age band / national vs. expatriate). Used ONLY for aggregate
--      adverse-impact (4/5ths-rule) monitoring — never in scoring, never shown
--      to assessors. Every attribute is nullable and supports 'prefer_not_to_say'.
--
--   2. Human-decision capture on prehire_candidates. `recommendation` is the AI
--      SIGNAL; `decision` is what a PERSON decided, with a job-related reason and
--      an actor + timestamp. The pipeline never auto-rejects — this is where the
--      human-in-the-loop is recorded and made auditable.
--
--   3. prehire_audit_log — an append-only, immutable trail of significant
--      actions (requisition created, candidate invited, consent, stage completed,
--      decision recorded, export taken), per the CLAUDE.md compliance requirement.
-- ════════════════════════════════════════════════════════════════

-- ── 1 + 2. Candidate columns (all nullable / additive) ──────────
ALTER TABLE prehire_candidates
  ADD COLUMN gender                     text CHECK (gender IN ('male','female','prefer_not_to_say')),
  ADD COLUMN age_band                   text CHECK (age_band IN ('under_25','25_34','35_44','45_54','55_plus','prefer_not_to_say')),
  ADD COLUMN nationality_group          text CHECK (nationality_group IN ('national','expatriate','prefer_not_to_say')),
  ADD COLUMN demographics_submitted_at  timestamptz,
  ADD COLUMN decision                   text CHECK (decision IN ('advanced','rejected','hold','withdrawn')),
  ADD COLUMN decision_reason            text,
  ADD COLUMN decided_by                 uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN decided_at                 timestamptz;

-- ── 3. Immutable audit log ──────────────────────────────────────
CREATE TABLE prehire_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id  uuid REFERENCES prehire_requisitions(id) ON DELETE CASCADE,
  candidate_id    uuid REFERENCES prehire_candidates(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Free-text actor label so the trail survives even when there's no account
  -- (dev admin stub, system events). actor_id is the FK when one exists.
  actor_label     text,
  action          text NOT NULL,
  detail          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prehire_audit_req     ON prehire_audit_log(requisition_id);
CREATE INDEX idx_prehire_audit_cand    ON prehire_audit_log(candidate_id);
CREATE INDEX idx_prehire_audit_created ON prehire_audit_log(created_at DESC);

-- Immutability: rows may be inserted (service-role) and deleted (cascade +
-- retention purge) but NEVER updated, so the recorded history can't be rewritten.
CREATE OR REPLACE FUNCTION prehire_audit_no_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'prehire_audit_log rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prehire_audit_log_immutable
  BEFORE UPDATE ON prehire_audit_log
  FOR EACH ROW EXECUTE FUNCTION prehire_audit_no_update();

-- ── RLS ─────────────────────────────────────────────────────────
-- Mirrors the 00050 model: admin full; client SELECT scoped to their own org's
-- requisitions; candidates never touch the table (writes are service-role only).
ALTER TABLE prehire_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY prehire_audit_admin ON prehire_audit_log
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY prehire_audit_client_select ON prehire_audit_log
  FOR SELECT USING (
    auth_role() = 'client'
    AND requisition_id IN (
      SELECT id FROM prehire_requisitions
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );
