# Pending Actions — VIFM Assessment Center (Caliber)

> Living checklist of open/deferred work. Claude: surface this whenever the user
> asks "any pending actions?" (or similar), and keep it updated as items close.
> Last updated: 2026-06-16.

## ⭐ Priority 2 - KAFD (King Abdullah Financial District)

**P2.1 - 20 ARC access codes + presentation**
- [x] Onboarding presentation (`scripts/build-kafd-onboarding-deck.js` → `KAFD-AI-Readiness-Compass-Onboarding.pptx`)
- [ ] Send the 20 invitations to KAFD delegates (needs Resend domain verified - see §E)
- [ ] Collect completions + share an aggregated readout

**P2.2 - Sample reports from the VIFM behavioural assessment**
- [x] Produced THREE audience-lens sample PDFs off one synthetic persona (Noura Al-Otaibi, Senior Manager - Corporate Banking, 3.1/5 Ready with Development) using the current v2 competency names: candidate (development), hiring manager (decision), talent acquisition (screening). Files in `public/samples/VIFM-AC-Sample-{Candidate,Hiring-Manager,Talent-Acquisition}-Report.pdf`; regenerate via `npx tsx scripts/build-audience-reports.tsx`. New lens components in `src/lib/reports/` (not yet wired to portal routes - that's the optional "productize" follow-up if the client wants self-serve generation).

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
- [ ] Create `ahmad.rashid@viftraining.com` admin - run `scripts/create-admin.ts` (creates the auth user + role=admin profile; prints a temp password to share/reset)
- [ ] Rotate or disable the weak demo credential `admin@viftraining.com` / `admin123` now that auth is live
- [ ] Decide on open self-registration: `/register` is reachable when logged out; confirm that's acceptable or lock it down
- [ ] NOW LIVE-RELEVANT: pre-flip hardening buckets 2-3 below are enforced in prod from here on

## B. Pre-flip hardening (remaining buckets)
- [x] Bucket 1 — candidate ownership guards on service-client page reads (shipped, commit 9dbf31f)
- [x] Bucket 2 — auth guards on API routes (2026-06-16): `/api/reports/*` (full + learning-plan) + `/api/readiness/*/pdf` enforce admin / own-org-client / own-record-candidate via `guardCandidateReportAccess` (`src/lib/auth/report-access.ts`); `/api/consent/*` requires the owning candidate or admin. Unauthenticated is already blocked by middleware (307 → /login); these add the role/ownership layer. Verified: admin passes, unauth blocked.
- [x] Bucket 3 — identity (2026-06-16): assessor + client headers show the signed-in user (`CurrentUserBadge`) instead of a static role label; `created_by = auth.uid()` and assessor-id = `auth.uid()` were already in place (README was stale).
- [x] Bucket 4 — broader API-auth pass (2026-06-16): audited every remaining PDF/data/action route. **Adequate as-is:** ARA report PDF (`requireAssessmentOwner`), ARA personal PDF + tech-sandbox routes (unguessable token), Fluent cert / psychometrics report / standalone Persona report (UUID-secret + middleware session; consumed by anonymous/standalone takers so no owner to bind), prehire export (`requireRole(admin)`), credential verify (public-by-design). **Guards added** (`src/lib/reflect/report-access.ts` `guardReflectEngagementAccess` + `src/lib/academy/access.ts` `guardAcademyCandidate`): the 4 Reflect routes (participant/cohort PDF, framework PDF, needs-scheduling CSV — were explicitly "open to whoever has the link" → now admin or owning consultant); the 5 Academy action routes (enroll/lesson-start/save/complete — service-role writes that accepted any client-supplied id → now admin or the owning candidate, gated before AI cost + credential issuance); credential PDF (now admin or the owning candidate); role-profiles export (now `requireRole(admin)`). Verified: tsc clean; cookieless → 307/login on all 11; admin session → 200 on reports + export + credential, 404 (not 403) on academy = guard passes admin; live-data predicate check = every deny-other → DENY, admin → ALLOW, client org-match wired.
- [ ] **Candidate/client login readiness (found during the Bucket 4 check, data not code):** with auth ON, the ownership guards are correct but the *links they compare against are mostly unset*: **0/12 `candidates` have `profile_id`** and the demo `candidate@viftraining.com` profile maps to **0 candidate rows**, so a real candidate login resolves to a profile but to no candidate data → every candidate-owned report/quiz/credential denies. **0/7 `reflect_engagements` have `consultant_id`** (created pre-flip) → only admins can open their reports; new post-flip engagements set the owner. The **client path IS wired** (demo `client@viftraining.com` has `organization_id` set, so the client-org branch allows/denies correctly). To make candidate self-service usable: create candidate auth users + backfill `candidates.profile_id` (and optionally backfill `reflect_engagements.consultant_id` for legacy rows). Out of scope for code hardening; needs the user to create the accounts.

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
- [x] **ENV on Render**: `EMAIL_FROM` set to the verified `noreply@viftraining.com` domain - confirmed by the Technical-portal external-delivery test on 2026-06-14 (invitation + results emails reached an external inbox from `noreply@viftraining.com`, which requires the verified from-domain). `RESEND_API_KEY` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` set.
- [ ] Verify end-to-end on deployed app: email a delegate, redeem one-click, complete, receive results PDF
- [ ] Phase 4 polish (optional): full funnel analytics, deep-dive tier option (currently snapshot-only)

## D. Minor / cleanup
- [ ] Remove dead i18n keys `tech.take.chooseTitle` / `chooseIntro` (deprecated broad-domain screener, no live references)
- [ ] Fix the pre-existing **ARA voucher-page hydration warning** (dev-only "server HTML replaced with client content"; present on `/ara/admin/vouchers` and inherited by the new `/admin/vouchers` hub - React recovers and the page works, but worth cleaning up)
- [ ] **Course-catalogue vertical tag hygiene** (surfaced during the 2026-06-14 ARC e2e test). The recommender now floats AI-relevant verticals (`artificial_intelligence`/`analytics`/`business_intelligence`) to the top for AI-readiness results - but some courses are mis-categorised, so non-AI courses ride that boost. Concrete example: "Microsoft Office Specialist Certification (Office 365)" and "Microsoft PowerPoint Associate" are tagged `vertical = business_intelligence`, so they surfaced as #2/#3 AI-readiness recommendations. Audit `vifm_courses.vertical` (admin `/admin/courses/[id]`) and re-classify office/productivity courses out of the AI/data verticals. Not a code bug - data hygiene; makes ARC recs pristine for client demos.

## F. AI Readiness Compass - recently shipped (2026-06-14)
- [x] **Graded individual question types** (`situational_judgment` + `knowledge_check`) on the 4 personal factors - migrations 00080/00081, server-side scored, answer key never sent to the browser, bilingual chips. Verified e2e on production (`caliber.viftraining.com`).
- [x] **Recommender fix** (AI-readiness surfaces only): min-gap threshold (>= 0.5) so trivial gaps stop recommending, and AI/data verticals floated to the top so an AI-readiness gap recommends AI training (not "The Art of Public Speaking"). AC + Reflect recommenders intentionally unchanged.
- [ ] Seed items 301-312 carry `validation_evidence.review_status='ai_proposed'` - SME-review + flip to `verified` before relying on them in a client deliverable.

## G. Succession Readiness · Persona · Reflect 360 · Vouchers - shipped 2026-06-16
Migrations 00099 / 00100 / 00101 applied to prod this session.
- [x] **Auth confirmed ENABLED** + stale docs fixed (README + CLAUDE.md said "false"; now accurate). Enforcement verified (`/admin/*` + `/candidate/*` → `/login`; `/login` + `/courses` open). `scripts/create-admin.ts` generalized (any email, secure temp password).
- [x] **Persona scopes to the agreed competencies** (`engagement_competencies`); full 38/41 framework retained; standalone `/ac/persona` stays full. 5-band interpretation guide on Persona results + PDF.
- [x] **9th competency cluster - Customer & Stakeholder Focus** (00100): cluster + 3 competencies (Customer Orientation, Stakeholder Management, Value Creation) under RESULTS + dev tips + matching Persona bank items. Framework now **9 clusters / 41 competencies**.
- [x] **Succession Readiness combined-mode wiring** (00099): setup panel on the engagement detail (mode toggle + link a Reflect 360 + per-candidate status + readiness-report link); thin front door at `/admin/readiness` to start a combined programme; readiness + Persona PDFs + candidate self-results view.
- [x] **Reflect 360 five open-ended questions** (00101): rater form (standard + gamified) + scoring + participant report, bilingual, alongside Start/Stop/Continue.
- [x] **Consolidated voucher hub** at `/admin/vouchers` (ARC + Technical tabs + cross-service summary; Technical nav repointed; no schema change).
- [ ] (Optional follow-up) Replace Reflect's Start/Stop/Continue with the 5 questions if 8 open prompts is too many - currently keeping both per user decision.
