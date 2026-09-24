-- ARC: a cohort voucher can name the rollup its assessment belongs under.
--
-- 00223 made one code provision one department assessment. A client with five
-- departments issues five codes and wants, at the end, the division or
-- enterprise report over all five. 00200 gave that report its structure
-- (parent_assessment_id links a unit to its rollup) but the link could only be
-- made by an admin after the fact, one unit at a time, once the rollup existed.
--
-- This column moves the link to issue time: the admin picks (or creates) the
-- rollup when issuing the department code, and the pooled assessment is born
-- already linked under it. The hierarchy assembles itself as people redeem.
--
-- Only honoured for pooled (cohort) codes, and only when the rollup belongs to
-- the same organisation as the voucher - the redeem path re-checks both, so a
-- stale or cross-org pointer degrades to an unlinked assessment rather than a
-- wrong tree. ON DELETE SET NULL: removing a rollup unhooks the codes that
-- pointed at it; it does not delete them or their assessments.

alter table public.ara_vouchers
  add column if not exists parent_assessment_id uuid references public.ara_assessments(id) on delete set null;

comment on column public.ara_vouchers.parent_assessment_id is
  'Rollup (division/enterprise assessment) a pooled code''s assessment is created under. Same org only; pooled codes only.';

create index if not exists ara_vouchers_parent_assessment_idx
  on public.ara_vouchers (parent_assessment_id)
  where parent_assessment_id is not null;
