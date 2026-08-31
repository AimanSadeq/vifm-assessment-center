-- ARC org-design vouchers (client request 2026-08-31): a voucher can now carry
-- the ASSESSMENT DESIGN for an org pillar assessment - which pillars and how
-- many questions per pillar - so a client can self-serve a customized org
-- assessment test drive (e.g. HR department, all 8 pillars, 6 questions each
-- = 48 items) from a redeem code, exactly like the personal ARC vouchers.
--
-- engagement_stage 'individual' (default) = today's behaviour, untouched: the
-- voucher provisions the personal 4-factor ARC. An org stage provisions an
-- org assessment with the voucher's pillars_in_scope + questions_per_pillar
-- (the custom-scope levers from 00029 + 00198) on redemption.

alter table ara_vouchers
  add column if not exists engagement_stage text not null default 'individual'
    check (engagement_stage in ('individual','department','division','enterprise')),
  add column if not exists pillars_in_scope text[],
  add column if not exists questions_per_pillar integer
    check (questions_per_pillar is null or (questions_per_pillar between 1 and 20));

comment on column ara_vouchers.engagement_stage is
  'What a redemption provisions: individual = personal 4-factor ARC (default); an org stage = org pillar assessment using pillars_in_scope + questions_per_pillar.';
comment on column ara_vouchers.pillars_in_scope is
  'Org vouchers: the pillar set the provisioned assessment covers (custom scope). NULL = the stage default set.';
comment on column ara_vouchers.questions_per_pillar is
  'Org vouchers: per-pillar question budget for the provisioned assessment. NULL = full form.';
