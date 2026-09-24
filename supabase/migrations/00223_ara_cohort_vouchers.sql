-- ARC: cohort vouchers - one code, one assessment, everyone who redeems joins it.
--
-- A voucher redemption has always provisioned its OWN assessment: fifteen
-- redemptions of a fifteen-seat code produced fifteen single-respondent
-- assessments and no organisational view without an admin building a rollup
-- by hand afterwards. That is the wrong shape for the thing clients actually
-- buy - "assess my department" - where the fifteen are one cohort and the
-- report they want is over all of them, with each person's own standing too.
--
-- Two flags on the voucher, both meaningful only at an org stage:
--
--   pool_respondents        every redemption joins ONE assessment. The first
--                           redeemer creates it and the voucher records which
--                           one (pooled_assessment_id); the rest become
--                           respondents on it. Seats still count per person.
--   include_individual_layer the assessment also serves the four-factor
--                           personal layer, so each respondent gets a personal
--                           report and the org report gains the workforce
--                           readiness rollup (departmental-plus-personal).
--
-- pooled_assessment_id is set once, atomically (UPDATE ... WHERE IS NULL), so
-- two first redemptions racing cannot both create; the loser joins the winner.
-- ON DELETE SET NULL: if the pooled assessment is ever removed, the next
-- redemption starts a fresh one rather than failing forever.
--
-- Existing vouchers are untouched: both flags default false, and the redeem
-- path keeps its per-person behaviour unless pool_respondents is set.

alter table public.ara_vouchers
  add column if not exists pool_respondents boolean not null default false,
  add column if not exists include_individual_layer boolean not null default false,
  add column if not exists pooled_assessment_id uuid references public.ara_assessments(id) on delete set null;

comment on column public.ara_vouchers.pool_respondents is
  'Cohort code: every redemption joins one shared assessment instead of provisioning its own. Org stages only.';
comment on column public.ara_vouchers.include_individual_layer is
  'Org-stage code also serves the four-factor personal layer (departmental-plus-personal).';
comment on column public.ara_vouchers.pooled_assessment_id is
  'The shared assessment a pooled code provisions on first redemption; later redemptions join it.';

create index if not exists ara_vouchers_pooled_assessment_idx
  on public.ara_vouchers (pooled_assessment_id)
  where pooled_assessment_id is not null;
