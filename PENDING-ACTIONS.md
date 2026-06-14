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

**P2.3 - Technical assessment: professional competency framework + 3 bands + reports**
> SUPERSEDED (2026-06-13): the MCQ + AP-framework approach below is replaced by the
> performance-based Sandbox portal (see the Technical Assessment Portal section at the
> top). The 3-band model (Basic/Intermediate/Advanced at competency level) carries over;
> the MCQ runner + AP framework (00076) are retired from the live flow.
Vision: a professional technical competency framework per FUNCTION (job), online-assessable, to
hire/screen AND develop; default-general, customisable from a client JD. Model: Function (job, not
banded) → Competency (assessed unit, banded Basic/Intermediate/Advanced) → Skill (measured by questions).
Thresholds: Basic < 60 / Intermediate 60-84 / Advanced >= 85.
- [x] 3-band classifier `proficiencyTier()`; per-competency banding on results; overall band removed.
- [x] **AP competency framework approved** (`docs/technical-ap-competency-framework.md`, 6 competencies).
- [x] AP framework v2 seeded (migration 00076; validated on scratch PG): **6 categories / 19 competencies / 36 skills** + `category`/`reference` columns, blueprint aligned. **APPLY 00076 to Supabase** to activate.
- [ ] Group the results "By competency" view by category (+ reference) - pairs with the report step.
- [ ] Draft + SME-review exam questions for the 36 AP skills (`scripts/draft-function-items.ts --function accounts_payable`; needs ANTHROPIC_API_KEY). Question count per skill: decide here.
- [ ] PDF breakdown report (per-competency band + descriptor + development pointers). Subject: Finance/AP.
- [ ] Extend the framework template to other finance functions + JD-custom path.

**P2.4 - Combine question types into one customised assessment (investigation)**
- [ ] Viability analysis: can questions from different assessment types (behavioural / technical /
      Fluent / ARA / CBI / psychometrics) be merged into one overall assessment? Which combine
      logically, which don't, and how scoring would work. (Precedent: Pre-Hire already chains
      quiz + Fluent + CBI.) Deliverable = a written assessment, not code (yet).

## ⭐ Technical Assessment Portal - Performance-Based Sandbox (replaces MCQ)

Decisions + data model + build order: `docs/technical-sandbox-portal.md`. SRS:
Domain -> Function -> Pillar -> Skill Block (banded competency, sandbox-delivered).
9 domains / 62 functions seeded as a lazy-load node index; **FP&A 1.7 is the live
worked example** (3 pillars, 4 skill blocks: 3-statement spreadsheet, sensitivity
matrix, PVM logic-input, read-only SQL).

**Shipped (all gated: tsc clean + `npm run build` passes; logic verified on scratch PG):**
- [x] Migration 00077: schema + 9 domains + 62-function node index + full FP&A 1.7 seed
- [x] Core logic: validators (cell/array-formula/logic/SQL), scoring + banding (60/85), pluggable JD matcher
- [x] Read-only SQL runner (single SELECT guard, rolled-back tx, statement timeout, hash-match)
- [x] Service layer (public blueprint w/ answer key stripped; create/start/save/submit)
- [x] Candidate runner `/tech-sandbox/[token]`: timed, autosave, auto-submit, bilingual EN/AR, banded results; 3 engines (Univer spreadsheet, logic-input, SQL)
- [x] Token API (start/save/submit) + middleware bypass
- [x] Admin `/admin/tech-sandbox`: pick function or JD-match shortlist -> issue token link

**Manual steps to activate (USER):**
- [ ] **Apply migration 00077 to Supabase** (seeds the node index + FP&A 1.7)
- [ ] **Set `SANDBOX_DATABASE_URL` on Render** to a DEDICATED throwaway Postgres (NEVER the app/Supabase DB) - required for the SQL block 3.1 to execute. Without it, SQL checkpoints score 0 with a clear error.

**Remaining build:**
- [x] **Univer grid runtime QA** - grid renders + accepts input; verified end-to-end on the deployed site (3-statement, sensitivity, PVM, SQL all score correctly). Fixes: required `name`+`sheetOrder`, `theme: defaultTheme`, reader via onRegister callback (next/dynamic drops refs) reading from the workbook snapshot.
- [x] Nav chip to `/admin/tech-sandbox` on the admin hub hero
- [x] Per-checkpoint pass/fail breakdown on the results screen
- [x] Admin-only Model Answers page (`/admin/tech-sandbox/answers`: model values/formulas, master SQL, checkpoints+weights)
- [ ] Email the candidate link on session create + email results + the PDF on completion (reuse sendAraEmail / Resend). BLOCKED on Resend domain verification (see §E). PDF generator is ready to attach.
- [x] PDF report (overall + per-pillar + per-block band + per-checkpoint pass/fail), downloadable from results. English-only (React-PDF; matches Fluent cert). Route: GET /api/tech-sandbox/[token]/report
- [ ] Admin results view (sessions list + per-candidate breakdown)
- [ ] Build out more functions beyond FP&A 1.7 (each: pillars + skill blocks + payloads/master/checkpoints); JD-custom path
- [ ] Python code sandbox engine (deferred; needs isolated-execution design) for Data/AI functions

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
- [ ] **Verify the `viftraining.com` domain in Resend** (DNS records sent to IT 2026-06-14: DKIM CNAME/TXT + SPF `include:` TXT merged with any existing SPF + DMARC TXT at `_dmarc.viftraining.com`). Required to email external delegates (not just the Resend-account owner's address).
  - **AFTER the domain shows "Verified" in Resend**, set `EMAIL_FROM=noreply@viftraining.com` on Render (web service env) and redeploy. Until then, leave `EMAIL_FROM` as the Resend-account email or sends to external addresses will be rejected.
- [ ] Verify end-to-end on deployed app: email a delegate, redeem one-click, complete, receive results PDF
- [ ] Phase 4 polish (optional): full funnel analytics, deep-dive tier option (currently snapshot-only)

## D. Minor / cleanup
- [ ] Remove dead i18n keys `tech.take.chooseTitle` / `chooseIntro` (deprecated broad-domain screener, no live references)
