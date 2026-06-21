-- 00145: Pre-Hire SME review + certification.
--
-- A VIFM assessor reviews a candidate's AI-scored responses (CBI transcript,
-- Fluent writing/speaking) and certifies the screening result. This is the
-- "certified" tier above the raw AI report. All reads are best-effort/tolerant
-- so an un-applied migration simply leaves a candidate "not certified".

alter table public.prehire_candidates
  add column if not exists certified_at timestamptz,
  add column if not exists certified_by text,
  add column if not exists certification_notes text;

comment on column public.prehire_candidates.certified_at is
  'When a VIFM assessor certified this candidate''s screening result (SME review). NULL = not certified.';
comment on column public.prehire_candidates.certified_by is
  'Name of the VIFM assessor who reviewed and certified the result.';
comment on column public.prehire_candidates.certification_notes is
  'Reviewer notes captured at certification (free text).';

-- No new RLS policy: prehire_candidates is already admin-all + client-SELECT-own-org,
-- and certification is an admin-only write performed through the service-role action.
