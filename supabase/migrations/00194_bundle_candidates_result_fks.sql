-- ============================================================
-- bundle_candidates: real FKs on the two result links
--
-- 00172 created persona_session_id / cognitive_result_id as plain uuid
-- columns ("soft links"). That was harmless while nothing ever deleted the
-- referenced rows - but the unified retention policy (src/lib/retention/,
-- nightly cron since commit d5a9b77) deletes behavioral_assessment_sessions
-- and psy_results rows once they pass the 24-month window. A purged sitting
-- would leave bundle_candidates holding an id that resolves to nothing, and
-- every surface that renders a bundle candidate's Persona/Logica result would
-- dangle silently.
--
-- ON DELETE SET NULL, not CASCADE: the bundle candidate row is the commercial
-- record of the invitation (name, org, status, consent) and must outlive the
-- assessment data. When retention removes the sitting, the link nulls out and
-- the UI's existing "no result" path renders - the same shape it already
-- handles for a candidate who never finished.
--
-- Defensive first pass: null out any reference that already dangles, so the
-- constraint can be added VALID everywhere (prod is verified clean - one row,
-- both links resolve - but a fresh clone or a partially-seeded env may not be).
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.bundle_candidates') IS NULL THEN
    RETURN; -- 00172 not applied on this environment; nothing to do
  END IF;

  -- Clear any already-dangling references before constraining.
  UPDATE public.bundle_candidates bc
     SET persona_session_id = NULL
   WHERE persona_session_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.behavioral_assessment_sessions s WHERE s.id = bc.persona_session_id);

  UPDATE public.bundle_candidates bc
     SET cognitive_result_id = NULL
   WHERE cognitive_result_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.psy_results r WHERE r.id = bc.cognitive_result_id);

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bundle_candidates_persona_session_fk') THEN
    ALTER TABLE public.bundle_candidates
      ADD CONSTRAINT bundle_candidates_persona_session_fk
      FOREIGN KEY (persona_session_id)
      REFERENCES public.behavioral_assessment_sessions(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bundle_candidates_cognitive_result_fk') THEN
    ALTER TABLE public.bundle_candidates
      ADD CONSTRAINT bundle_candidates_cognitive_result_fk
      FOREIGN KEY (cognitive_result_id)
      REFERENCES public.psy_results(id)
      ON DELETE SET NULL;
  END IF;
END $$;
