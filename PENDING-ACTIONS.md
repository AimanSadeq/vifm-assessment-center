# Pending Actions — VIFM Assessment Center (Caliber)

> Living checklist of open/deferred work. Claude: surface this whenever the user
> asks "any pending actions?" (or similar), and keep it updated as items close.
> Last updated: 2026-06-13.

## A. Auth go-live (user-paused)
- [ ] Provision the 6 role accounts in the **live** Supabase:
      `npx tsx scripts/create-admin.ts` + `npx tsx scripts/create-test-accounts.ts`
- [ ] Confirm each of the 6 roles logs in (admin/consultant/lead+associate assessor/candidate/client; all pwd `admin123`)
- [ ] Flip `AUTH_ENABLED = true` in `src/lib/auth/config.ts`
- [ ] Gate the demo-login dropdown to `NODE_ENV !== "production"` (so embedded creds don't ship to prod)
- [ ] Rotate the `admin123` demo password before real go-live

## B. Pre-flip hardening (remaining buckets)
- [x] Bucket 1 — candidate ownership guards on service-client page reads (shipped, commit 9dbf31f)
- [ ] Bucket 2 — auth guards on API routes (`/api/reports/*`, `/api/consent/*`)
- [ ] Bucket 3 — identity TODOs (layout `full_name`, `created_by = auth.uid()`, assessor-id fallback)

## C. Technical competency tier (Domain → Function → Competency → Skill)
- [x] Migration 00074 applied + baseline competencies populated (one-per-function)
- [x] Backbone + results "By competency" breakdown + admin read panel (shipped, commit 7658402)
- [ ] Optional: run AI regroup for 2–4 competencies/function: `npx tsx scripts/regroup-tech-skills.ts` (currently baseline one-per-function)
- [ ] Verify on deployed app: results "By competency" + admin competency panel render against real data
- [ ] Increment 2.2 — JD-extractor emits a competency grouping + admin write-path editor (deferred; needs runtime verification)
- [ ] Increment 2.4 — group the runner picker chips by competency (deferred; entangled with mix-&-match)

## E. ARC voucher system (practice-access codes for AI Readiness Compass)
- [x] Schema (migration 00075: `ara_vouchers` + `ara_voucher_redemptions` + `ara_voucher_claim` RPC)
- [x] Voucher service (`src/lib/ara/vouchers.ts`: generate batch + atomic redeem → provisions sandbox individual run)
- [x] Admin generate/manage UI (`/ara/admin/vouchers` — batch, seat pool, client-org tag, copy/CSV, disable)
- [x] Public redeem page (`/ara/redeem` — code + name + email + **company**, auth-bypassed) → drops into `/ara/respond/{token}`
- [ ] **Apply migration 00075** to live Supabase (SQL editor or `supabase db push`)
- [ ] Add a nav link to `/ara/admin/vouchers` (admin/consultant nav) — currently direct-URL only
- [ ] Verify end-to-end on deployed app: generate code → redeem → take run → result
- [ ] Phase 4 polish (optional): results email on completion, redemption analytics (issued→redeemed→completed funnel), per-company insights view, deep-dive tier option (currently snapshot-only by decision)

## D. Minor / cleanup
- [ ] Remove dead i18n keys `tech.take.chooseTitle` / `chooseIntro` (deprecated broad-domain screener, no live references)
