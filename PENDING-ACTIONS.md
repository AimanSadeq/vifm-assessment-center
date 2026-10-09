# Pending Actions — VIFM Assessment Center (Caliber)

> Living checklist of open/deferred work. Claude: surface this whenever the user
> asks "any pending actions?" (or similar), and keep it updated as items close.
> Last updated: 2026-10-07.

## ⭐ Priority 1 - SDAIA (Saudi Data & AI Authority)

Live client = **SDAIA**, Saudi Arabia's national AI authority. Per the 17 Jun 2026
"Call with Ahmad Rashid" (Ahmad = SME/client interface), the main stakeholder asked
for **three pilot projects**; demos start Mon-Wed the week after the call (est. 22-24
Jun 2026). **ARC orgs for SDAIA must be `region=saudi`, `sector=government`** - this
drives the regulatory tab (surfaces the 8 government-applicable Saudi frameworks incl.
SDAIA's own NDGF/Ethics/AAF/GenAI; excludes banking-only SAMA CSF).

**Pilots (provision access codes per pilot):**
- **Pilot 1 - Talent Acquisition** (TA Manager): 1-2 codes, Persona behavioural trial -> pre-hiring competency-fit report.
- **Pilot 2 - L&D** (Yousef): ~15-20 codes, technical-skill assessment scoped to the HR function "2.6 Learning & Development / L&D operations / instructional design".
- **Pilot 3 - Talent Management / Succession** (Abdullah, Mr. Alsharif): 2 codes, Persona-based succession for a critical role (e.g. HR GM) - ready-now/ready-soon/not-ready + 9-box. Client wants Persona only (not the 360) initially.

> **SD-1..SD-10 all shipped 2026-06-19** (commits `26b6ff6`..`19e0b1b`; migrations 00139 + 00140 applied). Recon found SD-1/SD-3/SD-6 were already built; the rest were built this session. Verified: tsc + lint on every item; SD-4 live-verified. Only remaining: SD-2 not yet smoke-tested with a live Persona-scored candidate, and SD-10 code issuance (run `scripts/seed-sdaia-pilots.ts --apply`).

**Demo-critical features (target: before Monday):**
- [x] **SD-1 Persona role success-profile** - was already shipped (00123/00124 + role designer + scoped runner + fit report). Added the explicit "Ready / Ready-with-Development / Not-Ready" verdict badge (additive, indicative/self-report) on the hiring report (EN PDF + AR + on-screen).
- [x] **SD-2 9-box + ready-now/ready-soon in the report** - 9-box placement on the individual readiness page + PDF (reuses talent-map axes), PLUS Persona-only mode now drives the tier (was 360-only -> "insufficient data" for Pilot 3). Tagged "Self-reported (Persona)". *(Not yet smoke-tested with a real Persona-scored candidate.)*
- [x] **SD-3 Technical-skill sandbox for HR "2.6 L&D / instructional design"** - was already shipped (00117-00120, L&D node active with 3 pillars + 4 logic_input blocks).
- [x] **SD-4 Cognitive subtest selection** - bilingual chip picker (any 1-4 of numerical/verbal/inductive/deductive); generation/scoring/bank subset-aware. Live-verified.
- [x] **SD-5 BUG: "Invalid UUID" on new Reflect 360 engagement creation** - Zod schema coerces ""->null + friendly messages; wizard passes organization_id || null; action backstop.
- [x] **SD-6 Persona report by purpose** - was already shipped (hiring=fit, development=dev plan + VIFM Academy recommendations, fully branched EN/AR/on-screen). Academy items render as recommendation cards (not deep links).
- [x] **SD-7 Technical report** - per-band capability MEANINGS in the legend (proficiencyTierMeaning) + FP&A pillar definitions (migration 00139). Narrative + band legend were already done (TECH-6). **Deferred: in-assessment "hints" toggle** (gold-plating; report already carries rich explanatory text).

**Meeting items (config / non-demo-critical):**
- [x] **SD-8 IA restructure** - two-column Selection/Development IA was already shipped (commit c367822). Remaining cleanup done: sidebar instrument-runner leaf relabelled "Overview" -> "Take assessment" (Cognitive/Persona/Fluent).
- [x] **SD-9 Persona item-format option** - admin/voucher-pinnable + standalone chooser: normative / ipsative / both (migration 00140). **Deferred: true ipsative SCORING** (Thurstonian IRT - multi-week psychometric build); this is forced-choice presentation, documented honestly in the methodology brief.
- [x] **SD-10 Provision the SDAIA ARC org as saudi/government** - org provisioned (verified live). Idempotent `scripts/seed-sdaia-pilots.ts` ready (dry-run verified). **OPERATOR ACTION: run `npx tsx scripts/seed-sdaia-pilots.ts --apply` to issue the per-pilot codes** (Pilots 1+3 = Persona codes, Pilot 2 = Technical L&D code - NOT ARC questionnaire codes).
- [ ] **SD-11 L&D 2.6 approved question bank** - `tech_assessment_items` holds NO items for `learning_development`, so every Techno knowledge section for 2.6 is generated live by AI at the moment a code is redeemed. **To remove the live-AI dependency for Pilot 2: author and SME-review an L&D item bank (10 skills, same workbook round trip as the other domains).**
  - *Incident 2026-10-05 (resolved):* four of Ahmad's 2.6 trial sittings lost the knowledge section with no trace. Root cause was NOT the code: the Anthropic organisation had hit its **monthly API spend limit** ("You have reached your specified API usage limits ... regain access on 2026-11-01"), so every AI call across the platform failed in under a second. Fixed by raising the limit in the Anthropic Console (Settings, Limits); Ahmad confirmed both sections generate again. Shipped on master the same day: `4d72132` (a sitting that asked for a knowledge section is refused with a clear message when it cannot be built, seat released) and `f18968e` + `562b17e` (Admin, Settings, "AI connectivity" card: one live call, reports the cause in plain language, including "Spend limit reached" with the reset date). **Operator action: set the usage alert emails on the Console Limits page so the next approach to the cap is a warning, not an outage.**

## ⭐ SDC HiPo assessment (Soudah Development Company)

Engagement: SDC High-Potential Leadership Development Program (proposal `20260809-SDC-02-HPHLD`, charter V0.1). Caliber part = an online "HiPo Identification Assessment" (psychometric + leadership competency) for **50 nominees** (grades 4-8: 22 at G5, 13 at G6, 9 at G7, 3 at G8, 3 at G4), completed remotely, English, individual reports + cohort analytics + SDC debrief; results select the final cohort of 20-25. Proposal also commits a **post-program assessment** (progression), so the setup must be repeatable. People: Suzanne Salim (SDC sponsor), Ali AlShouli (VIFM PM), Ahmad Rashid (partner, wrote the Caliber part).

**Standing rule: Ali AlShouli leads SDC and is the subject-matter expert; keep him in the loop at every stage of the Caliber build** (Aiman, 2026-10-08): build plan to Ali before code (sent 2026-10-08); Ali walks through the candidate flow and reviews the first real reports; Ali joins the pilot; a short progress note to Ali at each checkpoint. Ali decides on SDC delivery questions (scenario presentation, order, cut-offs, launch date). Ali asked that his private comments on the samples (2026-10-08) are not forwarded to Ahmad.

**Hard rule: send NOTHING to candidates until SDC gives the green light.** The invitation hold (migration 00233, on master) keeps the bundle closed until it is released in the admin delivery panel; only roster rows marked tester can sit while it is held.

**Agreed with SDC (Ahmad's meeting with Suzanne 2026-10-07; Suzanne approved the approach and the sample reports 2026-10-08):**
- **One assessment, two parts, about 2 hours:** Part 1 = 30 SDC scenario questions (MOST / LEAST effective), untimed; Part 2 = Logica reasoning, timed. No Persona, no line-manager Engagement survey. Suzanne approved "Numerical and Inductive Reasoning"; whether Deductive stays as a third test is with Ali.
- **Scenarios:** 3 per competency (Basic / Proficient / Advanced) = 30; leadership counts against the requirement only at G7-8. Each has 4 responses keyed Advanced / Proficient / Basic / Counter-evidence to v3 indicator IDs. Scoring: MOST pick 3/2/1/0, +1 when LEAST is the Counter-evidence; per competency 0-12; proposed cut-offs Advanced 10, Proficient 7, Basic 4 (settings in Caliber; Ali to confirm).
- **Content:** Ali's `SDC_HiPo_Caliber_Detailed_Assessor_Indicators_v3.xlsx` (10 competencies, 160 indicators); Grade 4 = Grade 5 levels (Suzanne, 2026-10-06). Leadership required only at G7 (Basic) and G8 (Proficient).
- **Reports (approved by Suzanne 2026-10-08, then refined per Ali the same day):** one-page executive summary, one-page IDP, one group report ranking candidates. Grid = competency fit (Above = all required met + 2 exceeded; Meets = 80%+ met, including all met with fewer than 2 exceeded; Below) x **reasoning performance** (renamed from "cognitive agility"; Strong 70%+, Solid 50-69%, Developing <50%, indicative until SDC norms); rules printed under the grid. IDP per priority: SMART goal, 30/60/90-day milestones, on-the-job / coaching / learning actions (70-20-10 as approach, not formula), specific evidence (outputs, documented decisions, manager feedback). Ranking within grade band by grid position, then fit, then reasoning.
- **One shared link** in SDC's announcement; work email checked against the approved list of 50, one sitting each. SDC's IT team must approve the link before launch (Suzanne gets that once we send her the link).
- **Demographics (Suzanne 2026-10-08):** Employee Name, Business Unit, Department. **Welcome message:** Suzanne sending it separately (promised 2026-10-08). **Completion window 20-29 Oct confirmed.** Announcement corrections (VIFM name, 2026, "one assessment in two parts, about 2 hours") noted by Suzanne.

**Done:**
- [x] 2026-10-07: decisions, Ali's actions and the Caliber change list emailed to Ali (cc Ahmad); scenario template `SDC_HiPo_Scenario_Template_v1.xlsx` and the three sample reports sent to Ali.
- [x] 2026-10-08: Ali sent the samples to Suzanne; **Suzanne approved the reports and the two-part approach**, confirmed the window and the demographic fields.
- [x] 2026-10-08: Ali's review applied (rename, grid rules note, SMART goals, 30/60/90 milestones, specific evidence, 70-20-10 framing); revised samples + `SDC_HiPo_IDP_Actions_v2.xlsx` sent to Ali only. Generators in `scripts/sdc-hipo/` (README there); the sample IDP and the IDP sheet share one source (`idp_actions.py`).
- [x] 2026-10-08: **Caliber build on master** (not yet deployed): approved-list shared link with one sitting each, invitation hold + release, welcome message, demographic questions, per-bundle Logica time limit, hardened reasoning stage (migration 00233 applied); scenario section with autosave, resume, shuffled order, server-side scoring, admin switch / order / cut-offs and scenario review (migration 00234 applied); `scripts/sdc-hipo/load-scenarios.py` checks Ali's workbook and writes the load SQL.

**Open (dates are KSA working days):**
- [ ] **Aiman: trigger the Render deploy** so the build above goes live (nothing reaches candidates; the bundle stays held).
- [ ] **Ali decides (email 2026-10-08):** (1) send the refined samples to Suzanne as final versions or not; (2) keep Deductive as the third Logica test or use Numerical + Inductive only; (3) accept Suzanne's request to **launch Sun 18 Oct** instead of Tue 20 Oct. If 18 Oct: pilot moves to Thu 15 / Fri 16 Oct and the link must reach Suzanne for IT approval early in the week of 11 Oct.
- [ ] **Ali:** confirm with Suzanne how line managers take part (IDP evidence now uses manager feedback); confirm the scenario cut-offs and order.
- [ ] **Suzanne:** welcome message (promised 2026-10-08); IT approval of the link.
- [ ] **Ali (Sun 11 Oct):** 10 sample scenarios to Aiman; run them through `load-scenarios.py` (check only), then to Suzanne.
- [ ] **Ali (Wed 14 Oct):** all 30 scenarios approved in the template; IDP sheet v2 rows set to Approved.
- [ ] **Caliber (Aiman):** create the SDC bundle; load the 10 competencies + scenarios; roster of 50 (+ testers); demographics + welcome message; switch the scenario section on; reports in Caliber (executive summary, IDP, group report + portal ranking) from the approved samples; walkthrough with Ali.
- [ ] **Pilot** with 3-5 internal testers (Ali joins), then fixes; **launch** (18 or 20 Oct, Ali's call) only on SDC's green light.
- [ ] Charter spells the platform "Calibar": Ali asking Suzanne to correct before EPMO approval.
- [ ] Post-program assessment (progression) to be kept in the revised timeline.

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
- [x] Email wiring: the candidate results-email was **REMOVED 2026-06-17** - results are now hidden from the candidate; the scored development report is a client/admin deliverable (admin results view `/admin/tech-sandbox/results` + the admin-gated PDF route). `emailResults` (`src/lib/technical-sandbox/email.ts`) is retained for a future client-recipient send. Admin `emailSandboxLinkAction` ("Email to candidate" on the issue screen) + `emailVoucherCodesAction` ("Email N delegate(s)" on the generated batch + per-row "Email" in the vouchers table) send one-click redeem links (code+name+email+company prefilled). Best-effort throughout (degrades cleanly when `resendConfigured()` is false). **Still gated for EXTERNAL delivery on Resend domain verification (see §E)** - until then sends only reach the Resend-account address.
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
- [x] (Already done - checked 2026-09-30: auth user confirmed, admin profile present, last sign-in 5 Aug 2026.) Create `ahmad.rashid@viftraining.com` admin - run `scripts/create-admin.ts` (creates the auth user + role=admin profile; prints a temp password to share/reset)
- [ ] Rotate or disable the weak demo credential `admin@viftraining.com` / `admin123` now that auth is live
- [ ] Decide on open self-registration: `/register` is reachable when logged out; confirm that's acceptable or lock it down
- [ ] NOW LIVE-RELEVANT: pre-flip hardening buckets 2-3 below are enforced in prod from here on

## B. Pre-flip hardening (remaining buckets)
- [x] Bucket 1 — candidate ownership guards on service-client page reads (shipped, commit 9dbf31f)
- [x] Bucket 2 — auth guards on API routes (2026-06-16): `/api/reports/*` (full + learning-plan) + `/api/readiness/*/pdf` enforce admin / own-org-client / own-record-candidate via `guardCandidateReportAccess` (`src/lib/auth/report-access.ts`); `/api/consent/*` requires the owning candidate or admin. Unauthenticated is already blocked by middleware (307 → /login); these add the role/ownership layer. Verified: admin passes, unauth blocked.
- [x] Bucket 3 — identity (2026-06-16): assessor + client headers show the signed-in user (`CurrentUserBadge`) instead of a static role label; `created_by = auth.uid()` and assessor-id = `auth.uid()` were already in place (README was stale).
- [x] Bucket 4 — broader API-auth pass (2026-06-16): audited every remaining PDF/data/action route. **Adequate as-is:** ARA report PDF (`requireAssessmentOwner`), ARA personal PDF + tech-sandbox routes (unguessable token), Fluent cert / psychometrics report / standalone Persona report (UUID-secret + middleware session; consumed by anonymous/standalone takers so no owner to bind), prehire export (`requireRole(admin)`), credential verify (public-by-design). **Guards added** (`src/lib/reflect/report-access.ts` `guardReflectEngagementAccess` + `src/lib/academy/access.ts` `guardAcademyCandidate`): the 4 Reflect routes (participant/cohort PDF, framework PDF, needs-scheduling CSV — were explicitly "open to whoever has the link" → now admin or owning consultant); the 5 Academy action routes (enroll/lesson-start/save/complete — service-role writes that accepted any client-supplied id → now admin or the owning candidate, gated before AI cost + credential issuance); credential PDF (now admin or the owning candidate); role-profiles export (now `requireRole(admin)`). Verified: tsc clean; cookieless → 307/login on all 11; admin session → 200 on reports + export + credential, 404 (not 403) on academy = guard passes admin; live-data predicate check = every deny-other → DENY, admin → ALLOW, client org-match wired.
- [x] **Candidate/client login readiness - tooling built (2026-06-16).** Root cause confirmed: with auth ON the ownership guards are correct but the links they compare against were unset (**0/12 `candidates` had `profile_id`**; the demo `candidate@viftraining.com` mapped to 0 candidate rows). The **client path was already wired** (demo `client@viftraining.com` has `organization_id`). Shipped the provisioning capability (AC candidates need a REAL auth account - unlike token-based Pre-Hire/ARA):
  - **`src/lib/auth/provision-candidate.ts`** - `provisionCandidateLogin()` (find-or-create auth user -> upsert `profiles(role=candidate)` -> set `candidates.profile_id` on every row sharing that email) + `generateCandidateSetupLink()` (recovery link, delivered via our own Graph email). Safety rail: refuses to downgrade/relink an email that already has a non-candidate profile (e.g. an admin).
  - **In-app "Invite to portal" button** (KeyRound icon) on each candidate row on the engagement detail page -> `inviteCandidateToPortalAction` provisions + emails the existing `candidate_invitation` template with a set-password link; copy-link fallback when email is unconfigured. The forward path: new candidates become login-ready on demand.
  - **`scripts/provision-candidate-logins.ts`** - batch backfill, **dry-run by default**, `--apply`, target specific emails or all. Prints a per-candidate set-password link on apply. **You run this** (account creation is yours to execute). Verified dry-run against live data.
  - **500 -> clean fix:** the 5 guarded candidate pages (skills / academy x3 / credentials) now `notFound()` on an ownership mismatch instead of throwing a 500 (`requireCandidateAccessOrNotFound`).
- [ ] **ACTION (you):** run `npx tsx scripts/provision-candidate-logins.ts` (dry-run) then `--apply` for the REAL candidate emails only. **Do NOT provision the seeded `@adnoc.ae` demo candidates** (throwaway addresses) and **do NOT provision `ahmad.rashid@viftraining.com` as a candidate** - he is the intended admin (has an auth user but no profile yet; run `scripts/create-admin.ts` for him first, after which the candidate script auto-skips him).
- [ ] **Optional / moot today:** legacy `reflect_engagements.consultant_id` is null on pre-flip rows (admin-accessible; consultants would not see them). No consultant-role users exist yet, so nothing to backfill until you add consultants. Reflect client portal listing is also not built (separate feature, not login-readiness).

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

## I. Email deliverability - voucher/results mail (raised + RESOLVED 2026-07-21)

**Outcome: DNS/auth is fully healthy - nothing to fix.** Original worry was that
voucher/results mail from `noreply@viftraining.com` lands in spam for lack of
SPF/DKIM/DMARC. Verified live 2026-07-21 that all records exist, are aligned, and pass.

**Verification done (2026-07-21):**
- [x] **DNS records confirmed present + correct** (via `dig`): SPF `v=spf1 include:amazonses.com ~all`
      on `send.viftraining.com`; DKIM TXT at `resend._domainkey.viftraining.com` (signs for
      `viftraining.com`); DMARC `v=DMARC1; p=quarantine; pct=100; rua/ruf=info@viftraining.com; fo=1`
      at `_dmarc.viftraining.com`; envelope MX `feedback-smtp.us-east-1.amazonses.com`.
      Note: DMARC is **`p=quarantine` (enforced)**, not `p=none`.
- [x] **Live send test through the real app transport** (Resend, from `noreply@viftraining.com`,
      HTTP 200): landed in **Gmail Inbox**; "Show original" showed **SPF PASS / DKIM PASS
      (domain viftraining.com, aligned) / DMARC PASS**. All app mail sends via **Resend**
      (`src/lib/integrations/resend.ts`), NOT Microsoft Graph.
- [x] **Second live test to Outlook/M365** (the stricter filter): landed in **Inbox**.
      Confirms inbox placement on both Gmail and Microsoft.

**Conclusion:** earlier spam-foldering was reputation warmup (newly-sending domain; self-heals
as volume builds) or per-email content - NOT authentication. The "redeem links only" workaround
can be relaxed for Gmail-class recipients.

**Residual / optional (not blocking):**
- [ ] **Corporate Outlook/M365 filtering** is independent + stricter. If a specific client
      tenant reports spam, it's reputation with that tenant (still not our DNS) - ask their IT
      to allowlist `noreply@viftraining.com`.
- [ ] **Optional content hardening** (deliverability polish, not a fix): app emails are
      plain-text with a single bare link - sending multipart HTML + a `List-Unsubscribe` header
      would further improve placement. Low priority now that auth passes and mail inboxes.

## J. SME question-bank review - defects found in returned workbooks (2026-09-22)

First workbook back (Yassin, Technical / Accounting, 15 items). Two things came out of it:

- [x] **Arabic question duplicates the Arabic scenario on 5 technical items.** CLOSED 2026-09-28: all 5 fixed (3 via the Yassin set, 2 real-estate via Aiman's second decision workbook, incl. the Property Valuation key now $9,750,000); bank-wide recheck finds 0 left. `question_ar`
  holds a verbatim copy of `scenario_ar`, so an Arabic candidate reads the case twice and is
  never asked the question. Found by Yassin in review, not by us. All 5 are `status='in_review'`,
  so none has ever been served in a certified test. Fix is to author the missing Arabic question
  in `/admin/tech-assessment/items` (Arabic is SME-reviewed content, so it is not a code change):
  - The 3 accounting items were fixed 2026-09-28 (MD decision workbook). Still open, rechecked
    against the whole bank the same day (150 items, only these 2 remain):
  - `90133e9f-b137-45da-adec-098af2bb6af0` real_estate / Development Feasibility
  - `e31fe444-67e2-4534-b3f0-b60119d9e871` real_estate / Property Valuation
  The item console + AI drafter already refuse this (a07e129); the SME importer now also holds an
  Approve of such an item (2026-09-28). The Property Valuation item ALSO has a wrong key (NOI
  780,000 / 8% = 9,750,000, not among the options) - found by recomputing every worked sum in the
  bank (148 items, this is the only real error). Both items sent to Aiman as a decision workbook:
  `.tmp/sme/returned/md-realestate-2026-09-28/Technical-real-estate-MD-decisions.xlsx`; apply with
  `python .tmp/_apply_md_technical_decisions.py <returned.xlsx> --set realestate [--apply]`.
  Moayad's issued Real Estate pack contains both; the importer now holds his verdict on either if
  the options or English text changed after issue.
- [x] **Workbook instructions did not say that a difficulty-only disagreement is still Approve.**
  Three sound accounting items came back Revise with no fix written purely because the reviewer
  would have relabelled the difficulty; the importer holds those, so Accounting stayed 3 items
  short of the 8-item certification floor. The seven pack generators in `.tmp/_build_*.py` now
  spell out what each verdict means, that a difficulty quibble belongs in `Difficulty agree?` +
  Comments, and that a Revise with an empty `Suggested fix` leaves nobody anything to act on.
  Packs already issued still carry the old wording, so the point was made in the reply instead of
  reissuing workbooks people have started filling.

**Re-cut on behavioural framework v2 - emails SENT 2026-09-28.** The v2 content lives in new rows,
so the v1 Persona / Assessment Center / Reflect library packs were replaced (v1 copies in
`.tmp/sme/superseded/`; register `.tmp/_build_assignment.py` is current). Due 15 Oct 2026 for
everything, including Ali's Persona + Logica (moved from 30 Sep).
- [ ] **Ali - rating anchors (BPS 4.31, B19) first.** `AC-Scale-Anchors-SME-validation.xlsx`,
  105 anchors, 32 already rewritten in a VIFM first pass. Import with
  `python scripts/sme-import/sme_import.py <file> --reviewer "Ali"`; approval removes the "draft"
  label on the assessor observation + wash-up screens.
- [x] **Mufid's return loaded 2026-10-05** - AC + Reflect 360 packs for Thinking / Innovation & Complexity (v2-02). He never annotated the v1 workbooks, so nothing of his to carry across. Applied by hand under the importer's rules (no service key in that session), one `sme_review_log` row per item: AC 28 approved (18 indicators + 10 tips), Reflect 9 approved; 3 Reflect approvals concurred with Prof. Yassin's existing ones (stamp left as his). Workbook text matched the bank exactly.
  - [ ] **Follow-up with Mufid (14 held, logged with reasons; questions emailed 2026-10-05, reply due by 15 Oct; apply his answers the same way when they arrive):** 9 approvals where he answered "Measures this competency? = No" (Reflect: "Adjusts plans and approach...", "Connects decisions to how different parts...", "Traces how a change in one area...", "Reassures colleagues..." which stays live on Prof. Yassin's approval; AC: "Becomes overwhelmed...", "Shows interest in learning about... other cultures", "Relates well to people of different levels of seniority", "Adapts own style...", "Shows insensitivity to cultural differences"); 2 Revise with no wording ("Dismisses new ideas without consideration", "Quickly identifies the key ideas behind a topic or technique"); 1 Reject with "Type correct? = No" ("Produces novel and original approaches" - the importer would also have flipped it to a contra-indicator); 2 tips approved but marked not actionable (cross-cultural meeting research, scenario planning); 1 indicator with no verdict ("Remains productive in changing environments"). His note on "Adjusts plans promptly..." (own plan or the team's?) is a wording point for the next revision.
- [x] **Moayad's AC v2 + ARC Strategy & Vision return loaded 2026-10-09** (email 2026-10-07: AC v2-01 Strategic & Commercial Reasoning, v2-03 Delivery & Execution, v2-04 Customer & Stakeholder Focus, ARC Strategy & Vision pillar). Applied by hand under the importer's rules (no service key in the session; workbooks transcribed from the email, so `workbook_sha256` reads `transcribed:...`). All 128 items matched the live text and were pending. AC: 108 approved (33 with his new wording), 4 rejected; ARC: 7 approved. 129 `sme_review_log` rows; live result verified against the tested plan by checksum. Preview workbook: `Moayad-review-preview-2026-10-09.xlsx` (session scratchpad).
  - [ ] **Moayad: open until finished (Aiman's reminder):**
    - [ ] **5 duplicate pairs (MD decision):** he approved both items in each pair but said keep only one. Held (pending): indicator 4 "Sees tasks through to completion" vs 18; 12 "Maintains concentration..." vs 8; 21 "Fails to follow through on commitments" vs 14; 33 "Does not plan ahead for resource needs" vs 28; tip 15 "reframe the question..." vs tip 13 (all Delivery & Execution). Choose which to keep; reject the other.
    - [ ] **4 rejected indicators still shown to assessors:** the observation screen (`src/app/assessor/observation/[assignmentId]/page.tsx`) lists every behavioural indicator; filter out `sme_status = 'rejected'` (the anchors and examples on the same page already do). Rejected: "Seeks to understand customer needs", "Advocates for the customer interests...", "Arrives to work and meetings on time", "Allocates resources to meet work requirements".
    - [ ] **4 ARC Strategy & Vision rewordings queued for AR Compass v1.2** (`ARC_V12_QUEUE` in `sme_review_log`): items 1 (drop sponsor + budget from the strategy item; he suggests they become two new items), 4 (becomes a frequency question with new options; board or executive committee), 7 (drop "three-to-five"), 10 (risk appetite stated in the strategy). EN + AR wording given for all four.
    - [ ] **ARC pillar coverage (his Pillar review):** items check that documents exist, not that the strategy drives decisions; weak at the top end where the 4.00 benchmark sits. Add 2-3 items on what the strategy changed in practice, budget released and spent, day-to-day ownership below board, awareness outside leadership. Overlapping pairs: 1/8, 4/8, 2/7. For v1.2.
    - [ ] **Thank Moayad** with what happened to his work (as for the Technical packs on 2026-09-30).
    - [ ] **Remaining workbooks from Moayad, due Thu 15 Oct 2026:** Reflect 360 v2 for the same three clusters (Strategic & Commercial Reasoning, Delivery & Execution, Customer & Stakeholder Focus). Load the same way when they arrive.
- [x] **Prof. Yassin's return loaded 2026-09-28** - Technical Accounting / Business Reporting /
  Finance: 32 approved + 2 rejected + 3 cut-scores (all three domains now certifiable, 10/10/12
  approved vs the 8 floor); his 36 old-framework Reflect approvals carried onto the identical v2
  statements (`.tmp/sme/returned/yassin-2026-09-28/`). Financial Literacy (13 items) has no live row.
- [x] **B24 validity evidence structure built 2026-09-30** (migration 00230 APPLIED): `engagements.evaluation_plan`
  (3.20), `ac_outcome_followups` (6m/12m manager performance rating, the criterion), `ac_evaluations`
  (9.6/9.8 record). `src/lib/ac/validity.ts` (criterion r with power gates 10/30/100, criteria overlap
  4.6, evaluation calendar) + `evidence-data.ts` loader shared by the engagement "Validity evidence"
  panel and the Evidence pack PDF (`/api/admin/engagements/[id]/evidence-pack`). Fills as centres
  run; the science (a real sample, a psychometrician) is still non-code. UI not exercised in the
  preview (quick-login refused); data path + PDF verified locally.
- [x] **Engagement checklists for ALL EIGHT services built 2026-09-30** (migrations 00231 + 00232 APPLIED):
  live, per-engagement checklists with an owner per item (BD / consultant / admin / client) across five
  phases; record-backed items tick themselves, the rest are ticked with name, date and note. AC + ARC
  deployed in the morning; Reflect 360, Pre-Hire, Persona, Logica, Fluent, Techno added the same day
  (voucher services keyed on the voucher batch). Panels on the AC / ARC / Reflect / Pre-Hire pages,
  issuance tables under the four voucher lists, `/admin/checklists` overview, master lists, PDF per
  engagement. Verified in preview on a real engagement of every service. **DEPLOY PENDING** (second
  half). **Ahmad reviewing the process** (email sent 2026-09-30 with the eight master lists as PDF);
  apply his comments to `src/lib/checklists/definitions.ts` when they arrive.
- [x] **Moayad's return loaded 2026-09-30** - Technical Banking / Investment / Real Estate / Treasury:
  47 approved + 4 pass marks (78 / 76 / 74 / 73%, min 10 items; typed as fractions, importer now
  accepts 0-1 as %). Banking 13, Investment 15, Real Estate 12 approved = certifiable; Treasury 8 of
  the 10 it needs. His Property Valuation fix matched Aiman's 2026-09-28 correction exactly.
- [x] **12 held Technical items from Moayad** - settled 2026-09-30 by Aiman (11 fixes accepted, Loan Structuring approved unchanged); all approved + logged. Banking / Investment / Real Estate / Treasury now 15 approved each = certifiable at Moayad's pass marks. (Banking 2, Real Estate 3, Treasury 7) - precise written
  fixes, turned into field changes in `.tmp/sme/returned/moayad-2026-09-30/Technical-held-items-Moayad-MD-decisions.xlsx`
  (builder `.tmp/_build_md_moayad_decisions.py`); apply with
  `python .tmp/_apply_md_technical_decisions.py <returned.xlsx> --set moayad [--apply]`. Approving
  the 7 Treasury items takes it to 15 and makes it certifiable.
- [x] **11 held Technical items from Yassin** - settled 2026-09-28 by Aiman (MD) via a decision
  workbook: 9 proposed fixes accepted (incl. IAS 1 -> IFRS 18 wording, 3 Arabic questions that
  repeated the scenario), 2 Basel items (CET1, LCR) approved unchanged. All 11 approved + logged in
  `sme_review_log`. Approved now: Accounting 15, Business Reporting 14, Finance 14.
- [x] **Technical SME packs lack a Scenario (AR) column** - added 2026-09-28 to
  `.tmp/_build_tech_packs.py` (+ the importer knows the column, so it is not mistaken for a review
  answer); the Arabic check instruction now covers the scenario. Issued packs NOT regenerated -
  applies to the next issue. Verified: new-layout pack and old-layout returns both preview cleanly.
- [ ] **Returned v1 workbooks with notes** - reviewers were told to send back any old workbook they
  had already annotated so the notes can be carried across by hand (v1 rows are retired, so the
  importer cannot apply them). Match on statement text: v2 pooled rows keep the v1 wording.
- [ ] **Arabic** in the anchors (written by VIFM, not a native reviewer) still needs a native check.
- [ ] **Framework definitions** - Resilience & Composure, Delivery & Accountability and Integrity &
  Principled Courage include over-time elements (work-life balance, track record, reputation) no
  exercise can show. For the chartered psychologist's framework review.
- [ ] **Content flag** - v1 Outcome Ownership carried two customer-focus indicators into v2
  Delivery & Accountability; for the reviewer of the Delivery & Execution AC pack.

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

## H. ARC audit - open findings (2026-06-17 end-to-end re-run)

Full re-run: ~743 atomic checks across 13 domains, 658 PASS. The 3 highest-impact FAILs and
their tightly-coupled siblings are **FIXED + shipped** (commits `04a5a17`, `7e0d4aa`; migrations
00115/00116 applied):
- [x] Band-gap mislabel (SCORE-03/07) - lower-threshold band lookup.
- [x] Subset-stage overall deflation (SCORE-14/16) + SCOPE-03 no-op validator.
- [x] Dead Agentic tier (AGN-* / 00116 layer flip + save bypass + form sections) + GUIDE-07 + DERIVE-04 contamination guard applied across scoring / compliance / distortion / detectors.
- [x] (Earlier) SAMA CSF framework (00113/00114), sector binding (00115), compliance recalc-on-completion + pillar-scope gating + not-yet-calculated state, regulatory-extractor severity enum, Phase 2 Arabic help text, bilingual PDF Workforce+Agentic sections.

**All closed as of 2026-09-28.** Re-checked against the code: several were already fixed on
2026-07-03/04 (commits `fa5ceca`, `abba0b9`) but never ticked here; the rest were fixed on
2026-09-28 (one commit each).
- [x] Fixed July: WEIGHT-04 (weights scoped to in-scope pillars), STATUS-08/09 (Launch / Mark
  complete), ORG-DELETE-02 + SANDBOX-05 audit rows, TIMER-05 (server-side time limit), DEFER-01
  (regulatory approve/reject), QCRUD-08 (activate AI-authored questions), DIST-04 (leave-one-out),
  YOY-07 (prior scan by major version), PDF-17 (radar labels), DEEPDIVE-03, EMAIL-17 (attachments),
  OFFLINE-02 (honest banner), AGN-REASSESS-01 (reassessment carries layers + scope), NOTES-14.
- [x] AUDIT-IMMUTABLE-01 - `ara_data_management_log` append-only (migration 00228, applied +
  verified: UPDATE/DELETE/TRUNCATE refused, performed_by -> NULL allowed for account deletion).
- [x] NOTES-07/13/15 - Arabic notes get English on save; Arabic report says "translation
  pending" instead of repeating English; notes editable in both languages.
- [x] PDF-34/38/41 - the Arabic PDF prints the bilingual report's Arabic column (A4 portrait)
  instead of the English-only portrait flow; spanning charts/panels take the report language.
- [x] PDF-07/43 - every PDF stored in the private `ara-reports` bucket with a version number +
  scores snapshot; last five downloadable from the assessment page. (Also created the missing
  `ara-materials` bucket - respondent supporting-material uploads had been failing.)
- [x] REC-ARA-46 - an unanswered personal factor (score 0) is "not measured", not the max gap.
- [x] TIMER-06 - resume shows the same countdown the server enforces.
- [x] VOUCHER-12 - a typed voucher code is checked on leaving the field.
- [x] UC-03 - no use-case portfolio for personal-only respondents (page + server action).
- [x] I18N-03 - no left-to-right flash for Arabic users (pre-paint script + server locale).
- [x] QCSV-02/VAL-02 - question CSV round-trips (verified: 213/213, zero field differences).
- [x] ORG-ANON-03/06 - anonymise scrubs demographics, redemptions, voucher contacts, scope
  labels, use-case owners, uploaded files; the admin is recorded on every erasure log row.
  Free-text answers and consultant notes are deliberately left as written.
- [x] REC-ARA-40 - `?source=ara` carries from ARC pages to the quote form (engagement_type 'ara').
- [x] DOC-COUNT-02/DOC-NAMES-01 - ARC landing + roadmap read framework/requirement counts and
  names from the bank (16 frameworks, 66 requirements, SAMA CSF listed).
- [x] EMAIL-18 - one `siteOrigin()` for every outbound link (some paths fell back to localhost).
- [x] CRON-14/18 - ARC retention cron pinned to Node runtime, Render copy.
- [x] REASSESS-09 - assessment page links the prior year's baseline and later reassessments.
- [x] EMAIL-15 - moot: the personal-results email was retired by client policy (no sender).
- [x] **Policy decided 2026-09-28 (Aiman): keep stored report PDFs permanently** as business
  records, including after the assessment is purged (handover rule, migration 00010). Do not add
  them to the retention sweep.
