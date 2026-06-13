# Pending Actions — VIFM Assessment Center (Caliber)

> Living checklist of open/deferred work. Claude: surface this whenever the user
> asks "any pending actions?" (or similar), and keep it updated as items close.
> Last updated: 2026-06-13.

## ⭐ Priority 2 - KAFD (King Abdullah Financial District)

**P2.1 - 20 ARC access codes + presentation**
- [x] Onboarding presentation (`scripts/build-kafd-onboarding-deck.js` → `KAFD-AI-Readiness-Compass-Onboarding.pptx`)
- [ ] Send the 20 invitations to KAFD delegates (needs Resend domain verified - see §E)
- [ ] Collect completions + share an aggregated readout

**P2.2 - Sample reports from the VIFM behavioural assessment**
- [ ] Produce sample reports off VIFM behavioural competencies for THREE audiences:
      candidate, hiring manager, talent acquisition (each a different lens on the same assessment data).

**P2.3 - Technical assessment: 3-level breakdown with reports**
- [ ] Restructure so the technical assessment reports at THREE levels (not just an overall score) -
      builds on the Domain → Function → Competency → Skill tier already added (migration 00074).
      First subject: **Finance** competencies. Per-level reports.

**P2.4 - Combine question types into one customised assessment (investigation)**
- [ ] Viability analysis: can questions from different assessment types (behavioural / technical /
      Fluent / ARA / CBI / psychometrics) be merged into one overall assessment? Which combine
      logically, which don't, and how scoring would work. (Precedent: Pre-Hire already chains
      quiz + Fluent + CBI.) Deliverable = a written assessment, not code (yet).

## A. Auth go-live
- [x] Admin account live: `asadeq@viftraining.com` (role `admin`, strong password set via `scripts/reset-password.ts`); login verified on caliber.viftraining.com
- [x] `AUTH_ENABLED = true` (flipped 2026-06-13)
- [x] Demo-login dropdown gated to `NODE_ENV !== "production"` (hidden on the live site)
- [x] Supabase Auth Site URL set to `https://caliber.viftraining.com`
- [ ] Create additional role logins as needed (consultant / lead+associate assessor / candidate / client) - same flow, set `role` accordingly
- [ ] Decide on open self-registration: `/register` is reachable when logged out; confirm that's acceptable or lock it down
- [ ] NOW LIVE-RELEVANT: pre-flip hardening buckets 2-3 below are enforced in prod from here on

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
- [x] Apply migration 00075 to live Supabase (done 2026-06-13)
- [x] Nav tile on the ARA admin hub (`/ara/admin` → Vouchers)
- [x] Add-client inline on the vouchers screen; region inherits from the tagged client
- [x] Per-company redemptions insights view (delegates / started / completed / completion% + CSV)
- [x] Back link on the vouchers screen
- [x] Resend app-email transport (`src/lib/integrations/resend.ts`) wired into sendAraEmail
- [x] "Email codes to delegates" on the voucher screen (per-delegate single-use code + one-click link)
- [x] One-click redeem: `?code=` + email + company prefill
- [x] Auto-email results with the PDF attached on completion (markAraRespondentComplete)
- [ ] **ENV on Render**: set `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` (all = caliber.viftraining.com for the URLs)
- [ ] **Verify a domain in Resend** + switch `EMAIL_FROM` to `noreply@viftraining.com` (required to email external delegates, not just your Resend-account email)
- [ ] Verify end-to-end on deployed app: email a delegate, redeem one-click, complete, receive results PDF
- [ ] Phase 4 polish (optional): full funnel analytics, deep-dive tier option (currently snapshot-only)

## D. Minor / cleanup
- [ ] Remove dead i18n keys `tech.take.chooseTitle` / `chooseIntro` (deprecated broad-domain screener, no live references)
