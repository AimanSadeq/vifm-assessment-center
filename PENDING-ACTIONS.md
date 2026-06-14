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
- [x] Admin `/admin/tech-sandbox`: pick function or JD-match shortlist -> issue token link (per-delegate direct link)
- [x] Voucher system (00078): admin generates a batch (single-use codes or one shared seat-pool code) bound to a function + client; public redeem `/tech-sandbox/redeem` (code+name+email+company) -> provisions a sitting. Atomic claim + release verified on scratch PG (concurrency, expiry, disabled)

**Manual steps to activate (USER):** — all done + verified on production 2026-06-14
- [x] **Apply migrations 00078 + 00079 to Supabase** (voucher tables + claim/release RPCs; 00079 per-delegate assigned_name/email) — applied
- [x] **Apply migration 00077 to Supabase** (node index + FP&A 1.7) — applied (framework shows 9 domains / 62 functions / 1 live)
- [x] **`SANDBOX_DATABASE_URL` on Render** — set to the dedicated `caliber-sql-sandbox` Postgres (PostgreSQL 18); "Test sandbox DB" green on both local + production. Local `.env.local` uses the External URL + `?sslmode=no-verify`; the web service uses the internal URL.

**Remaining build:**
- [x] **Univer grid runtime QA** - grid renders + accepts input; verified end-to-end on the deployed site (3-statement, sensitivity, PVM, SQL all score correctly). Fixes: required `name`+`sheetOrder`, `theme: defaultTheme`, reader via onRegister callback (next/dynamic drops refs) reading from the workbook snapshot.
- [x] Nav chip to `/admin/tech-sandbox` on the admin hub hero
- [x] Per-checkpoint pass/fail breakdown on the results screen
- [x] Admin-only Model Answers page (`/admin/tech-sandbox/answers`: model values/formulas, master SQL, checkpoints+weights)
- [x] Email wiring shipped: `emailResults` (with the PDF) fires from the submit route on completion (`src/lib/technical-sandbox/results-email.tsx`); admin `emailSandboxLinkAction` ("Email to candidate" on the issue screen) + `emailVoucherCodesAction` ("Email N delegate(s)" on the generated batch + per-row "Email" in the vouchers table) send one-click redeem links (code+name+email+company prefilled). Best-effort throughout (degrades cleanly when `resendConfigured()` is false). **Still gated for EXTERNAL delivery on Resend domain verification (see §E)** - until then sends only reach the Resend-account address.
- [x] PDF report (overall + per-pillar + per-block band + per-checkpoint pass/fail), downloadable from results. English-only (React-PDF; matches Fluent cert). Route: GET /api/tech-sandbox/[token]/report
- [x] **End-to-end delegate flow verified on production 2026-06-14** (asadeq@gmail.com): issued FP&A session -> invitation email delivered to inbox from `noreply@viftraining.com` (verified domain, external delivery) -> delegate link opened the live timed assessment -> submit -> results email delivered WITH the PDF attached (`vifm-technical-...-.pdf`, application/pdf). Confirms EMAIL_FROM + Resend + the submit-route results-email wiring all work live. (Test was a blank attempt = 0%/basic; scoring accuracy verified separately.)
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
- [x] **Verify the `viftraining.com` domain in Resend** - confirmed verified by IT 2026-06-14 (DKIM CNAME/TXT + SPF `include:` TXT + DMARC TXT at `_dmarc.viftraining.com`). External delegate sends are now possible once `EMAIL_FROM` is switched (next item).
- [ ] **ENV on Render (now the active blocker)**: set `EMAIL_FROM=VIFM Assessment Center <noreply@viftraining.com>` on the web service and redeploy (the from-domain must match the verified Resend domain; until set, code falls back to `onboarding@resend.dev` = Resend-account owner only). Confirm `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` (= caliber.viftraining.com) are also set.
- [ ] Verify end-to-end on deployed app: email a delegate, redeem one-click, complete, receive results PDF
- [ ] Phase 4 polish (optional): full funnel analytics, deep-dive tier option (currently snapshot-only)

## D. Minor / cleanup
- [ ] Remove dead i18n keys `tech.take.chooseTitle` / `chooseIntro` (deprecated broad-domain screener, no live references)
- [ ] **Course-catalogue vertical tag hygiene** (surfaced during the 2026-06-14 ARC e2e test). The recommender now floats AI-relevant verticals (`artificial_intelligence`/`analytics`/`business_intelligence`) to the top for AI-readiness results - but some courses are mis-categorised, so non-AI courses ride that boost. Concrete example: "Microsoft Office Specialist Certification (Office 365)" and "Microsoft PowerPoint Associate" are tagged `vertical = business_intelligence`, so they surfaced as #2/#3 AI-readiness recommendations. Audit `vifm_courses.vertical` (admin `/admin/courses/[id]`) and re-classify office/productivity courses out of the AI/data verticals. Not a code bug - data hygiene; makes ARC recs pristine for client demos.

## F. AI Readiness Compass - recently shipped (2026-06-14)
- [x] **Graded individual question types** (`situational_judgment` + `knowledge_check`) on the 4 personal factors - migrations 00080/00081, server-side scored, answer key never sent to the browser, bilingual chips. Verified e2e on production (`caliber.viftraining.com`).
- [x] **Recommender fix** (AI-readiness surfaces only): min-gap threshold (>= 0.5) so trivial gaps stop recommending, and AI/data verticals floated to the top so an AI-readiness gap recommends AI training (not "The Art of Public Speaking"). AC + Reflect recommenders intentionally unchanged.
- [ ] Seed items 301-312 carry `validation_evidence.review_status='ai_proposed'` - SME-review + flip to `verified` before relying on them in a client deliverable.
