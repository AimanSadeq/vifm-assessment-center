# VIFM Assessment Center Digital Portal

## Project Overview
Custom-built Assessment Center management platform for Virginia Institute of Finance and Management (VIFM). The portal operationalizes the VIFM-AC Framework across four user interfaces: Admin, Assessor, Candidate, and Client. Target market: GCC and MENA region (banking, government, corporate).

## Current Status
All 5 development phases are **complete**. The portal is functionally ready with auth disabled for development. To go to production, flip `AUTH_ENABLED = true` in `src/middleware.ts` and follow `src/lib/auth/README.md`.

**ARA module status:** VIFM ARA (AI Readiness Assessment) is built out and merged into master. M1–M6 complete (respondent flow, scoring, distortion, peer benchmarks, year-on-year, bilingual consultant notes, EN/AR/bilingual Puppeteer PDF report, Phase 2 consultant guide, regulatory doc upload with Claude extraction, **annual reassessment workflow shipped 2026-04-28 via `createReassessmentFromPrior` in `src/lib/ara/consultant-actions.ts` with copy-and-create of org/stage/scope/weights + opt-in respondent carry-over + new active question-bank pin + `ara_assessments.prior_assessment_id` audit link**). M2.1 (respondent invitation email) and M3.3 (consultant completion notification) shipped 2026-04-28 via `src/lib/ara/email.ts` with bilingual templates + sandbox redirect + ara_email_log writes. Retention purge + sandbox cleanup admin pages shipped at `/ara/admin/retention` + `/ara/admin/sandbox`; scheduled cron for those is the only ARA item still open. See "ARA Module" section below for the current deferred-items list.

**AC competitor-parity status:** Fifteen features inspired by a competitor walkthrough are shipped on `master` (P0.1 JD-to-competency extractor, P0.2 role profile library, P0.3 gap-severity badges, Learning Plan PDF, G1 candidate→role-profile binding, G2 learner skill dashboard, G3 self-serve AI quiz flow with MCQ + cognitive items + per-question AI explanations, G4 bulk JD import, G5 bulk CSV user-to-persona linking, G6 JSON export, **G7 admin re-engagement workflow shipped 2026-04-28 — "Re-engage cohort" button on completed/archived engagement detail copies design + candidates with `prior_engagement_id` + `prior_candidate_id` links and renders an OAR delta pill ("↑+1 vs prior") on each candidate row once the new run scores**, H1 JD-extractor domain tally card, H2 personal-statistics donut + bar charts on /candidate/skills, H3 in-app notification bell, H4 admin "view as candidate" banner). Full second-pass analysis (158-frame video sweep) lives in `.tmp/parity-gap-analysis.md`; see "AC competitor-parity upgrades" section below.

**Hardening + i18n status (2026-04-28):** Migration 00019 hardens the parity tables — `notifications` split into per-op policies + read-only-recipient trigger, `candidate_quiz_attempts` immutable-fields trigger + initial-state CHECK constraint preventing fabricated score writes. Bilingual EN/AR translations shipped on the candidate-facing surfaces (skills dashboard, personal-statistics charts, quiz interface, quiz results, Start AI Quiz button, notification bell, admin "view as" banner, candidate layout chrome) plus AI-generated quiz prompts/options/explanations now bilingual via `bilingual: true` on the generator. I18nProvider is route-aware: only `/candidate/*` and `/ara/respond/*` honour the `vifm-locale` cookie; admin / login / assessor / client portals stay LTR/EN regardless (closes a dir-leak that drifted the admin sidebar to centre when the cookie was `ar`). Full roadmap with statuses lives in `docs/post-parity-roadmap.md`.

**VIFM Courses workstream (2026-04-28):** The bridge that turns AC + ARA gap diagnoses into VIFM training-course recommendations. Four-day workstream shipped end-to-end. Day 1: schema (00023, 00024) + sidebar entry + manual editor for the seven blocks (Course Overview · Target Competencies · Course Objectives · Target Audience · Course Methodology · Course Outline · Note). Day 2: AI PDF extraction at `/admin/courses/import` — Claude reads all 6 PDF blocks + proposes AC competency tags + ARA pillar tags with rationale. 127 courses imported and tagged on the live DB. Day 3: course recommender library (`src/lib/recommender/courses.ts`) + panels on AC engagement detail (cohort-aggregated with per-candidate filter), ARA Phase 2 tab, and a 4th page on the candidate Learning Plan PDF showing top-5 recommended VIFM programmes with ★ HIGH FIT badges and per-driver chips. Day 3d/e/f: course mapping panel on `/admin/courses/[id]`, per-candidate recommendation filter via `?candidate=<id>`, training recommendations on the Learning Plan PDF. Lifecycle: re-import-overwrite by code/title (case-insensitive), per-row delete with confirmation, drag-and-drop on the import zone, and a Levenshtein duplicate-finder at `/admin/courses/duplicates`. Block 6 supports 4-level depth (main header → subsections → bullets → sub-bullets) via a markdown-style editor that round-trips structured jsonb.

**ARA Personal / Individual readiness (2026-04-28):** Three deployment modes for VIFM-native four-factor individual AI readiness, designed mapped to the existing AC 4-domain framework (THINKING · RESULTS · PEOPLE · SELF). Factors: AI Sense-Check, AI Working Practice, AI Collaboration, AI Adaptive Mindset. Mode A (free snapshot, 24 items, anonymous self-served at `/ara/personal/start`). Mode B (paid deep-dive, 48 items, consultant-issued at `/ara/consultant/personal-deep-dive/new` — requires admin/consultant role). Mode C (individual layer alongside an org engagement — toggle on the assessment-create wizard, optional `individual_only` respondents who skip pillar questions, workforce-readiness rollup card on the consultant assessment detail and a dedicated section in the bilingual org PDF). Schema in 00025 (engagement_stage extended + individual_factor_id), 00026 (16-item snapshot seed), 00027 (tier system + 32 more items + include_individual_layer + individual_only). Consultant dashboard surfaces personal-snapshot activity (last 30 days, snapshot vs deep-dive distinction). On completion, every individual respondent gets the personal results-link email (URL + PDF) regardless of mode; the personal results page + PDF endpoint are gated to individual-stage OR include_individual_layer=true assessments only.

## Tech Stack
- **Framework:** Next.js 14 with App Router and TypeScript (strict mode)
- **Styling:** Tailwind CSS with Shadcn/UI component library (New York style)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth:** Supabase Auth with Row-Level Security (RLS) per role - toggle in middleware.ts
- **Real-Time:** Supabase Realtime (live wash-up collaboration)
- **Reporting:** React-PDF for candidate reports (6-page professional format), Recharts for analytics
- **AI:** Anthropic Claude API (observation classifier, report writer, development recommender, bias detector)
- **i18n:** react-i18next with RTL support for Arabic
- **Email:** Microsoft Graph API (Azure AD app credentials) — `src/lib/integrations/email.ts` ships 6 AC templates; falls back to console-mock when env vars are absent
- **Video:** Daily.co SDK placeholder for virtual AC sessions
- **Font:** Open Sans (VIFM Brand Kit)
- **Colors:** Primary Blue #010131, Accent Blue #5391D5, Off-White #FEFFF9, Dark Blue #111232, Navy Blue #121140
- **Deployment:** Vercel (frontend) + Supabase Cloud (backend)

## Project Structure
```
src/
  app/
    (auth)/               # Login (email/password + magic link), register, password reset
    admin/                # Admin portal (collapsible sidebar, process map dashboard)
      clients/            # Client organization management
      engagements/        # Engagement list, 5-step wizard, detail with tabs
        new/              # Engagement creation wizard (5 steps + JD extractor + role profile picker)
        [id]/             # Engagement detail with role-profile-aware candidates table + cohort-aggregated VIFM training recommendations + per-candidate filter (?candidate=<id>)
      exercises/          # Exercise library with briefing, timing, role player guides
        [id]/             # Exercise detail editor (4 tabs)
      role-profiles/      # Reusable competency packs per role (list, new, [id] editor, bulk-import, bulk-assign)
      courses/            # VIFM training catalogue (recommender bridge)
        new/              # Manual course creator with all 7 blocks
        [id]/             # Course detail + AC competency / ARA pillar mapping panel
        import/           # AI PDF extraction (drag-and-drop, 25/batch, replace-on-re-import)
        duplicates/       # Levenshtein near-match finder for catalogue cleanup
      assessors/          # Assessor pool management
      analytics/          # ICC, bias detection, Recharts charts
      settings/           # Integration status, compliance, environment info
    assessor/             # Assessor portal (top nav, process map)
      assignments/        # Engagement picker → assignment grid
        [engagementId]/   # Candidate-exercise assignment grid with Observe buttons
      observation/
        [assignmentId]/   # 4-tab observation form (Overview, Observe, Rate, Q&A)
      integration/
        [engagementId]/
          [candidateId]/  # Integration worksheet (pre-wash-up consolidation)
      washup/             # Wash-up engine
        [engagementId]/   # Candidate list with progress bars
          [candidateId]/  # Consensus form with radar chart + Realtime
    candidate/            # Candidate portal (minimal nav, process map)
      welcome/[id]/       # Personalized welcome with engagement details
      consent/[id]/       # GDPR/UAE PDPL consent form
      assessments/[id]/   # Exercise schedule with timing
      skills/[id]/        # Learner skill dashboard — gap badges + 3-chart stats panel + Start AI Quiz buttons (G2 + H2)
      quiz/[attemptId]/   # Self-serve AI quiz interface (timer, MCQ + T/F + pattern, End Session) (G3)
      quiz/[attemptId]/results/  # Score + per-question review with AI explanations (G3.d)
      report/[id]/        # Report viewer (gated behind release status)
    ara/
      personal/start/                  # Free Personal AI Readiness Snapshot entry (Mode A, anonymous)
      personal/results/[token]/        # Bilingual results page — factor scores + course recommendations + PDF download
      consultant/personal-deep-dive/new/  # Paid 48-item deep-dive issuance (Mode B, requires admin/consultant role)
      consultant/                      # Consultant dashboard with personal-snapshot-activity panel (last 30d, snapshot vs deep-dive)
      consultant/assessments/[id]/     # Org assessment detail — adds Workforce Readiness rollup card on Phase 2 tab when Mode C
      respond/[token]/                 # Stage-aware respondent form — pillar questions + four-factor items based on assessment.engagement_stage / include_individual_layer / individual_only
    client/               # Client portal (top nav, process map)
      engagements/        # Org-scoped engagement list
        [id]/             # Candidate results with OAR and PDF download
      reports/            # Cross-engagement report viewer
      analytics/          # Cohort strengths/development areas
    api/
      reports/[engId]/[candId]/                # Full assessment report PDF
      reports/[engId]/[candId]/learning-plan/  # Personalized 30/60/90 Learning Plan PDF + VIFM training recommendations page
      role-profiles/[id]/export/               # JSON export of role profile + competencies (G6)
      consent/[candId]/                        # Consent submission endpoint
      ara/reports/[assessmentId]/pdf/          # Bilingual EN/AR/side-by-side ARA PDF (Puppeteer) — includes Workforce Readiness section when Mode C
      ara/personal/[token]/pdf/                # Personal AI Readiness Snapshot PDF (React-PDF) — token-gated
  components/
    ui/                   # 17 Shadcn/UI components
    shared/               # Process map, BackLink, LanguageSwitcher, VifmLogo, EngagementPicker, LogoutButton
  lib/
    supabase/             # Server client, browser client, middleware, service client
    auth/                 # getClientOrgId helper, README migration guide
    ai/                   # AI client, observation assistant, report writer, dev recommender, bias detector, JD competency extractor (P0.1), quiz generator (G3), course extractor (Day 2 of courses)
    notifications/        # Publish + load + mark-read helpers (H3)
    constants/            # Exercise type labels, ARA pillars, ARA stages, ARA individual factors (the 4 VIFM personal factors)
    i18n/                 # Config, provider (route-aware), cookie + locale constants, server-side getServerT helper, EN + AR locale files
    integrations/         # Email (6 AC templates), Video (Daily.co placeholder)
    ara/                  # ARA-specific helpers — auth-guards, email (3 ARA templates), respondent-access, scoring, distortion, year-on-year, peer-benchmarks, regulatory engine, workforce-readiness rollup (Mode C)
    recommender/          # Course recommender (AC candidate / AC cohort / ARA pillar / Personal snapshot)
    reports/              # Candidate report PDF (6 pages) + Learning Plan PDF (4 pages incl. recommended training) + Personal Snapshot PDF (1 page bilingual), data fetcher, report types
    scoring/              # ICC calculation, bias detection, gap-severity computation (P0.3)
    validations/          # Zod schemas for engagement, assessor, washup, ARA assessments + respondents (now incl. include_individual_layer + assessment_tier + individual_only)
  types/                  # TypeScript types for all database tables
  hooks/                  # Custom React hooks (placeholder)
  utils/                  # General utilities (placeholder)
supabase/
  migrations/
    00001_initial_schema.sql                  # 25 tables + RLS policies + enums + triggers
    00002_seed_competencies.sql               # 4 domains, 8 clusters, 38 competencies
    00003_seed_behavioral_indicators.sql      # 249 behavioral indicators
    00004_seed_development_tips.sql           # 114 development tips (3 per competency)
    00005_create_engagement_rpc.sql           # Atomic engagement creation function
    00006_*…00013_*                           # ARA module (enums, core schema, regulatory seed, use cases, retain-on-delete, auth hardening, stages, bilingual notes)
    00014_ac_role_profiles.sql                # P0.2 Role profile library + role_profile_competencies
    00015_seed_role_profiles.sql              # 6 GCC banking + government seed profiles
    00016_ac_candidate_role_profile.sql       # G1 candidates.role_profile_id (nullable FK)
    00017_ac_candidate_quiz_attempts.sql      # G3 candidate_quiz_attempts (questions + answers JSONB)
    00018_ac_notifications.sql                # H3 notifications table + RLS
    00019_ac_auth_hardening.sql               # Notifications + quiz-attempts immutability triggers + CHECK
    00020_reassessment_links.sql              # ARA M6 + AC G7 prior_assessment_id / prior_engagement_id / prior_candidate_id FKs
    00021_ara_seed_question_bank.sql          # Vetted Production Bank v1.1 (125 questions, bilingual) — fresh clones get the active bank for free
    00022_ara_culture_talent_rebalance.sql    # +10 questions to v1.1 (4 L1+1 L2 talent, 4 L1+1 L2 culture) closing the people-pillar coverage gap
    00023_vifm_courses.sql                    # vifm_courses + course→AC competency + course→ARA pillar tag tables (recommender bridge)
    00024_vifm_courses_add_note.sql           # vifm_courses.note_en/_ar — Block 7 admin annotations
    00025_ara_individual_stage.sql            # engagement_stage += 'individual' + ara_questions.individual_factor_id (4 VIFM factors)
    00026_ara_individual_seed.sql             # 16 self-assessment items on v1.1 (4 per factor) — Mode A snapshot baseline
    00027_ara_individual_tiers.sql            # tier discriminator on questions + assessments + 32 more items → 24 (snapshot) / 48 (deep-dive) per factor; include_individual_layer + individual_only flags
scripts/
  seed-test-data.ts       # Creates full test dataset (engagement + candidates + assessor + observations)
  seed-tags-qa.py         # Populates tags and Q&A questions for competencies
```

## Four User Roles (with RLS policies)
1. **admin** - VIFM staff. Full access to all modules. Can create engagements, manage clients, assign assessors.
2. **lead_assessor** / **associate_assessor** - Assessors. See only assigned candidates and engagements. Can record observations, ratings, and consensus.
3. **candidate** - Assessment participants. See only their own data, consent forms, and released reports.
4. **client** - Sponsoring organizations. See only their own org's engagements and released candidate reports.

## Key Domain Concepts
- **Engagement:** A single assessment center project for a client
- **Competency:** A measurable behavioral dimension. VIFM framework: 4 domains, 8 clusters, 38 competencies with 249 behavioral indicators (positive/negative), 114 development tips, 5 tags, and 3 Q&A questions per competency
- **Exercise:** A simulation activity (In-Basket, Role Play, Group Exercise, Case Study, Oral Presentation, CBI) with structured timing (instructions/prep/meeting), participant briefing, and role player guides
- **Exercise-to-Competency Matrix:** Maps which competencies are observed in which exercises. Each competency must appear in at least 2 exercises (enforced by Zod validation)
- **Observation:** Assessor behavioral notes for a candidate in an exercise, classified by competency with +/- indicators
- **BARS Rating:** 1-5 scale (1=Significant Development Needed, 2=Development Needed, 3=Competent, 4=Strength, 5=Significant Strength) + NE (No Evidence)
- **Integration Worksheet:** Pre-wash-up form where assessors consolidate ratings across exercises
- **Wash-Up:** Structured data integration discussion with Supabase Realtime multi-user collaboration, radar chart, and color-coded score summary
- **OAR:** Overall Assessment Rating (1-5) with recommendation: Ready Now / Ready with Development / Not Ready
- **ICC:** Intraclass Correlation Coefficient measuring inter-rater reliability
- **PDF Report:** 6-page professional report (Cover, About AC, Summary, Competency Detail with Strengths/Development split, Development Recommendations)

## Database
- **25 tables** with Row-Level Security on every table
- **8 enums:** user_role, engagement_status, candidate_status, exercise_type, indicator_type, oar_recommendation, report_status, recommendation_priority
- **363 behavioral indicators** (249 behavioral + 114 development tips)
- **Competency fields:** tags (text[]), qa_questions (text[])
- **Exercise fields:** prep_minutes, meeting_minutes, instructions_minutes, participant_brief, scenario_context, assessor_notes
- **Role player prompts:** character_name, character_role, character_attitude, meeting_objectives

## Auth Status
- Middleware toggle: `AUTH_ENABLED` in `src/middleware.ts` (currently `false`)
- Login form: email/password + magic link (implemented)
- Dev bypass: 4 role buttons on login page
- Production guide: `src/lib/auth/README.md`
- All pages have `// TODO:` comments for auth integration points

## Brand Kit
- **Primary Blue:** #010131 (sidebar, primary buttons)
- **Accent Blue:** #5391D5 (highlights, links, charts)
- **Off-White:** #FEFFF9 (backgrounds)
- **Dark Blue:** #111232 (text)
- **Navy Blue:** #121140 (sidebar accent)
- **Font:** Open Sans
- **Logo:** `/public/images/vifm-logo-light.png` (color) and `/public/images/vifm-logo-dark.png` (monochrome)

## Environment Variables
```
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional - enable AI features
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional - enable email notifications
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM_ADDRESS=noreply@vifm.ae

# Optional - enable video conferencing
DAILY_API_KEY=your-daily-api-key
```

## Commands
- `npm run dev` - Start development server (port 3000)
- `npm run build` - Production build
- `npm run lint` - ESLint check
- `npx supabase db push` - Push schema changes to Supabase
- `npx supabase gen types typescript` - Generate TypeScript types from DB schema
- `npx tsx scripts/seed-test-data.ts` - Seed test data for development

## Coding Conventions
- TypeScript strict mode. No `any` types.
- Server Components by default. Use `"use client"` only when React hooks or browser APIs are needed.
- All database access through Supabase client in server components or API routes.
- Use Zod for form validation and API input validation.
- Use Shadcn/UI components as the base. Do not install other UI libraries.
- Tailwind CSS only for styling. No CSS modules or styled-components.
- Lucide React for all SVG icons. No emoji icons.
- File naming: kebab-case for files, PascalCase for components.
- Commit messages: imperative mood, under 72 characters.
- Every table must have RLS policies. Never bypass RLS with service role key in client-facing code.
- All user-facing text should use i18n keys from Phase 4 onward.
- Toast notifications (Sonner) for all save/error actions.
- BackLink component for all back navigation (ArrowLeft SVG icon).

## Compliance Requirements
- UAE Federal Decree-Law No. 45 of 2021 (Data Protection)
- Saudi Arabia Personal Data Protection Law (PDPL)
- GDPR for EU/UK operations
- ISO 10667 alignment (Assessment of People in Work and Organizational Settings)
- International Taskforce on Assessment Center Guidelines (6th Edition)
- Data retention: maximum 2 years unless contractually extended
- Candidate consent required before any data collection
- Audit trail on all significant actions (immutable log)

## Important Notes
- The Wash-Up Engine is the single most important differentiator. It includes Supabase Realtime for live multi-user collaboration.
- Arabic competency translations are placeholders and must be human-reviewed before going live.
- Auth is disabled for development. Flip `AUTH_ENABLED = true` and follow `src/lib/auth/README.md` for production.
- No third-party assessment tool references or competitor names anywhere in the codebase. When referencing prior-art for context, use generic placeholders ("Competitor One", "an industry vendor") and never the actual product or vendor name.
- All competency content (descriptions, behavioral indicators, development tips, tags, Q&A questions) is original VIFM content.

## ARA Module (AI Readiness Assessment)

New module being built alongside the existing AC portal. Full spec in `VIFM_ARA_Handover.md` (on user's Desktop).

### Non-breaking integration
- All new DB tables prefixed `ara_` - no existing table modified
- All new pages under `/ara/*` route namespace
- All new API routes under `/api/ara/*`
- Added `consultant` to the `user_role` enum (existing values unchanged)
- Added single nav link "AI Readiness" to admin sidebar - no other nav changes
- Middleware bypasses auth for `/ara/respond/[token]` routes (token-based access)

### ARA roles
- **admin** - reuses existing role. Manages question bank, regulatory docs, sandbox.
- **consultant** - new role. Owns their own assessments; scoped RLS.
- **respondent** - no account; accesses via `ara_respondents.access_token` validated by service-role API routes.

### ARA tech choices (differ from AC where necessary)
- **PDF reports:** Standard Puppeteer (bundled Chromium) on Render — Arabic shaping + landscape bilingual side-by-side layout. Keep React-PDF for AC candidate reports. Endpoint: `/api/ara/reports/[assessmentId]/pdf?language=en|ar|bilingual`. Production is Render, not Vercel — the Lambda-stripped `@sparticuz/chromium` is no longer used (the package is still in `package.json` from the prior Vercel era but is unimported).
- **Languages:** full bilingual EN + Gulf Arabic with RTL. Translation fields on all content tables (`_en` / `_ar` suffixes).
- **Region-driven content:** UAE clients see UAE frameworks only, Saudi sees Saudi only - never mixed.
- **Engagement stages:** three-tier model (`department` / `division` / `enterprise`) drives pillar filtering across detail page and report. Stage 1 (4 pillars) doubles as a sales sample.

### Key ARA database objects
- 8 pillars (strategy, data, technology, talent, culture, governance, operations, model_management)
- Question bank versioning via `ara_question_bank_versions` - one active at a time (partial unique index)
- Regulatory frameworks seeded: 7 UAE + 9 Saudi from handover Section 11
- Helper function `ara_is_assessment_owner(uuid)` for consultant-scoped RLS

### ARA build order (milestones)
- **M1 (done):** Schema, consultant role, nav link
- **M2 (done):** Organizations CRUD + anonymize, assessments, respondents, question bank versions, question CRUD + drag-to-reorder + per-layer split, CSV import + export
- **M3 (done):** Respondent form (EN/AR/RTL), auto-save + retry, Levels 1–5 scoring, distortion detection, peer benchmarks, year-on-year, materials upload, offline banner, use-case portfolio
- **M4 (done):** Pillar weight editor, perception vs reality (validated score), shadow AI alert, gap detector, regulatory engine, compliance summary, **Phase 2 consultant guide tab (Layer 2 questions, bilingual)**, **regulatory document upload + Claude requirement extraction at `/ara/admin/regulatory`**
- **M5 (done):** Puppeteer EN/AR/bilingual PDF report (~30 pages), stage-aware pillar filtering, all 8 deep-dives, gap heatmap, investment matrix, gantt roadmap, compliance, use cases, YoY comparison, organization profile, **bilingual consultant notes (note_text_ar) auto-translated via Claude on save with hand-written Arabic in seed**
- **M6 (done):** Annual reassessment workflow shipped 2026-04-28 — `createReassessmentFromPrior` server action in `src/lib/ara/consultant-actions.ts` copies org/region/sector/stage/scope/weights, picks the active question bank version, opt-in respondent carry-over (fresh access tokens, invited_at=null), and links the new draft via `ara_assessments.prior_assessment_id` (migration 00020). UI: "Start reassessment" button on the assessment detail action rail when status is in [completed, frozen, archived]. Retention purge + sandbox cleanup admin pages already shipped in earlier milestones at `/ara/admin/retention` + `/ara/admin/sandbox`. **Retention purge cron shipped 2026-05-15 via `.github/workflows/ara-retention-purge.yml`** — daily 03:00 UTC GitHub Actions cron hits `/api/ara/admin/retention/cron` with `CRON_SECRET` bearer; the `vercel.json` cron config that this replaced has been removed. Sandbox cleanup stays manual by design (requires typed-confirmation `"DELETE SANDBOX DATA"`).

### ARA deferred items (from earlier milestones)
Track here - pick up as scope allows. Do NOT delete without user confirmation. Items in this list are confirmed un-shipped; items previously listed and now shipped have been removed.
- **AUTH_ENABLED flip:** still `false` in `src/middleware.ts`. Production switch on requires real Supabase Auth wiring per `src/lib/auth/README.md`. User-paused; pickup plan in `docs/post-parity-roadmap.md`.
- **Mode A norm group accumulation:** percentile claims like "you scored at the X% percentile of GCC respondents" require ~200-500 completed Personal AI Readiness Snapshots in the DB. Passive — accumulates as people take the free snapshot. No action needed until the volume's there.

### Recently shipped (2026-05-15)
- **Customer-facing training catalogue with quote CTAs:** discoverable from `/ara` header nav, surfaced again on `/ara/engage` as a bridge section, and cross-linked from the personal results page below the gap-driven recommender. The full flow already existed at `/courses` (public listing with vertical+level filters), `/courses/[code]` (programme detail), `/courses/[code]/request-quote` (lead-gen form with org/role/cohort-size/timeline/notes), and `/admin/courses/quotes` + `/admin/courses/quotes/[id]` for consultant follow-up. Only the discoverability into the marketing surfaces was missing.
- **Arabic personal-snapshot PDF:** dual-renderer dispatch in `/api/ara/personal/[token]/pdf` — English stays on React-PDF, Arabic renders via Puppeteer + HTML so Chromium can shape the glyphs React-PDF can't. Layout mirrors the EN three-page report. All Arabic content (12 stage×factor coaching blurbs, 9 stage next-steps bullets, all UI strings) lives in `src/lib/reports/personal-snapshot-ar-html.ts` for single-source-of-truth translation.
- **Retention purge cron:** scheduled via `.github/workflows/ara-retention-purge.yml` (daily 03:00 UTC). Replaces the no-op `vercel.json` cron from the original Vercel deployment. Bearer auth via `CRON_SECRET` set in BOTH Render env and GitHub Actions secrets. Sandbox cleanup stays manual (typed "DELETE SANDBOX DATA" confirmation required by design).
- **Respondent submit-flush:** Submit button now awaits any in-flight auto-saves before firing `markAraRespondentComplete`. Closes a race the audit demonstrated where 24 fast-clicked answers + a quick Submit could land with only N-of-24 responses persisted. Form-save gate registers via a module-level `Map<token, FormSaveGate>`; CompleteButton shows a distinct "Saving your answers…" label during the flush.

### Critical ARA business rules
- Reports are **never** auto-sent to clients - consultant controls delivery
- No file size limits on supporting material uploads
- Desktop only - no mobile layouts required
- UAE/Saudi framework isolation enforced at query and report layer

## AC competitor-parity upgrades

A separate workstream alongside ARA, started after a competitor walkthrough revealed several capabilities worth porting to the VIFM AC. Reconstructed gap analysis lives in `.tmp/parity-gap-analysis.md` (the analysis file is not checked in but the conclusions are). Items are tagged P0.x / Gn for traceability.

### Shipped (first pass — P0.x and G1 / G2)
- **P0.1 - JD-to-competency extractor** ([src/lib/ai/jd-competency-extractor.ts](src/lib/ai/jd-competency-extractor.ts) + [jd-extractor.tsx](src/app/admin/engagements/new/_components/jd-extractor.tsx)): paste/upload JD (Arabic or English, text or PDF) → Claude returns the most relevant 6–10 VIFM competencies with weight, priority, and reasoning. Surfaces in engagement wizard step 2.
- **P0.2 - Role profile library** (`/admin/role-profiles/`, migrations 00014 + 00015): reusable competency packs per role with admin-scoped RLS and an authenticated read policy that respects org isolation. Six GCC banking + government profiles seeded.
- **P0.3 - Gap-severity badges** ([src/components/shared/gap-badge.tsx](src/components/shared/gap-badge.tsx) + [src/lib/scoring/competency-gap.ts](src/lib/scoring/competency-gap.ts)): "Significant Gap (N levels)" / "On Target" / "Strength" chips with a six-tier tone palette. Server-renderable; mirrored as `GapPill` in PDFs. Applied across client engagement results, score matrix, candidate report Summary, and per-competency cards.
- **Personalized Learning Plan PDF** ([src/lib/reports/learning-plan.tsx](src/lib/reports/learning-plan.tsx)): 3-page React-PDF — Cover, 30/60/90 Day Roadmap, per-competency action cards (uses GapPill), reflection prompts. Endpoint: `/api/reports/[engId]/[candId]/learning-plan` with the same auth + OAR-finalised gate as the main report. Surfaced as a secondary download on the candidate report and client engagement results pages.
- **G1 - Candidate ↔ role-profile binding** (migration 00016): nullable `candidates.role_profile_id` FK. Engagement detail's candidates table has a per-row Role Profile dropdown; the Add Candidate dialog has the same picker. Permissive UUID-shape regex on the validator so seeded synthetic UUIDs pass Zod.
- **G2 - Learner skill dashboard** (`/candidate/skills/[candidateId]/`): 4 stat cards (Total / Assessed / Skills with Gaps / Average Score) + per-skill cards grouped by VIFM domain (THINKING / RESULTS / PEOPLE / SELF). Shows target, current BARS score from `consensus_ratings`, and a `<GapBadge>`. Empty-state placeholder when no profile is bound. Linked from the post-consent welcome page.

### Shipped (second pass — H1–H4 + G3)
- **H1 - JD-extractor domain tally card** ([jd-extractor.tsx](src/app/admin/engagements/new/_components/jd-extractor.tsx) `<DomainTallyCard />`): four colored chips (THINKING blue / RESULTS green / PEOPLE orange / SELF violet) with per-domain counts and a "{total} total · {N} unclassified" footer above the recommendations list. Helps admins sanity-check that the AI didn't return an unbalanced profile.
- **H2 - Personal-statistics charts** ([personal-statistics.tsx](src/app/candidate/skills/[candidateId]/_components/personal-statistics.tsx)): three Recharts on the candidate skills page — Assessment Progress donut (Assessed vs Not Assessed), Skills by Domain donut (4-segment), Average Score by Domain bar chart (0–5). Domain colors match the H1 palette so admins and candidates see the same colour for the same VIFM domain everywhere.
- **G3 - Self-serve AI quiz flow** (migration 00017, [src/lib/ai/quiz-generator.ts](src/lib/ai/quiz-generator.ts), `/candidate/quiz/[attemptId]/`, `/candidate/quiz/[attemptId]/results/`): launched per-competency from the G2 skill cards. AI generates 7 questions mixing 4 multiple-choice + 2 true/false + 1 cognitive pattern-recognition. Mixed difficulty (Easy/Medium/Hard pills), 5-minute timer, "End Session" graceful exit. Results page shows score circle + 3 stat cards + per-question review with **AI-generated explanations in a Lightbulb tip box** — the highest-value learning moment from the competitor walkthrough. Questions + answers stored as JSONB on `candidate_quiz_attempts` so the deck is reproducible.
- **H3 - In-app notification bell** (migration 00018, [src/lib/notifications/publish.ts](src/lib/notifications/publish.ts), [notification-bell-client.tsx](src/components/shared/notification-bell-client.tsx)): bell with rose unread badge in admin + candidate headers. Popover lists the 20 newest items with title / body / relative time. Click marks read (optimistic, RLS-protected), "Mark all read" CTA when unread > 0. Publishers wired in: candidate notified on role-profile binding, all admins notified on quiz completion. Tolerant of the table not existing yet (renders disabled).
- **H4 - Admin "view as candidate" banner** ([impersonation-banner.tsx](src/components/shared/impersonation-banner.tsx)): amber strip at the top of any /candidate/* page when `?asAdmin=1` is in the URL, showing candidate name + email + "Exit view" CTA back to the source engagement. Per-row Eye icon on the engagement detail's candidates table opens the candidate portal in a new tab with the query pre-applied.

### Shipped (third pass — G4 / G5 / G6)
- **G4 - Bulk JD import** (`/admin/role-profiles/bulk-import/`): multi-file drop zone (up to 25 PDF/TXT) → batch AI extraction → per-file results table with editable name + accept/skip checkbox + competency chip preview → "Create N role profiles" creates them in one server roundtrip. Each accepted file becomes one new `role_profiles` row with its `role_profile_competencies` populated; failures roll back the empty shell so no orphaned rows.
- **G5 - Bulk CSV user-to-persona linking** (`/admin/role-profiles/bulk-assign/`): paste-CSV or upload-file UI accepting `email,role_profile_id` (UUID) or `email,role_profile_name` (case-insensitive); optional default profile for blank rows; per-row results table showing Updated / No match / No change / Error with status pills. Matches by email — supports a candidate having the same email across multiple engagements.
- **G6 - JSON export** (`/api/role-profiles/[id]/export`): self-describing JSON with schema version, exported_at, profile metadata + organisation name, and competencies enriched with cluster + domain names. Triggered by a "Export JSON" button on the role-profile detail page.

### Shipped (fourth pass — G7 admin re-engagement)
- **G7 - Admin re-engagement workflow** (migration 00020, [src/app/admin/engagements/[id]/actions.ts](src/app/admin/engagements/[id]/actions.ts) `createReengagementAction`): "Re-engage cohort" button on the engagement detail header, visible when status is in [completed, archived]. Modal asks whether to carry candidates; on confirm, copies the engagement design (target role, competencies, exercises, exercise-competency matrix) and the candidates (preserving role profile binding, demographics, profile_id) into a new draft engagement. Each new candidate row stores its `prior_candidate_id` link so the engagement detail's candidates table can render an OAR delta pill ("↑+1 vs prior" / "↓-1") once the new run scores. Prior assessor assignments, observations, ratings, and reports are deliberately not copied — the new run starts fresh and earns its own scores. The candidate-side quiz-retake path was always available via G3's "Retake Quiz" button on the results page; G7 is the admin-side complement.

### Post-parity hardening + polish (2026-04-28)
- **Migration 00019 — auth hardening** (commit `b10afe9`): `notifications` policy split into per-op (no INSERT for recipients; trigger restricts updates to `read_at` only). `candidate_quiz_attempts` BEFORE UPDATE trigger refuses candidate-context writes to immutable + score fields and any update once status leaves `in_progress`; CHECK constraint blocks fabricated `status='completed'` inserts. Quiz finalisation actions switched to `createServiceClient()` so the trigger short-circuits for the legitimate write path.
- **Bilingual EN/AR** (commits `3bc9593`, `ac79916`, `3fdaeee`): cookie-driven via `vifm-locale`. Server components read it through `getServerT()` (`src/lib/i18n/server.ts`); client components use the existing `useTranslation()`. Locale-aware routes are `/candidate/*` and `/ara/respond/*` only — every other portal stays LTR/EN regardless of cookie (this prevents the admin sidebar drifting to centre when an admin enters from a candidate's Arabic session). AI-generated quiz prompts/options/explanations are also bilingual via `bilingual: true` on the generator.
- **Defence-in-depth admin role checks** (commit `574509a`): five sensitive AC admin actions (`addCandidateAction`, `setCandidateRoleProfileAction`, `bulkAssignRoleProfilesAction`, `bulkExtractJdsAction`, `bulkCreateRoleProfilesAction`) wrap their entry with `requireRole(["admin"])` from the existing ARA auth-guards module. Under AUTH_ENABLED=false the guard returns a synthetic admin so dev work continues; under auth=on it refuses non-admin callers cleanly.
- **Skipped (intentionally)**: SECURITY DEFINER RPC for quiz scoring — gold-plating now that 00019's trigger covers the realistic threat model. Re-open if a real exploit surfaces.

### Skipped intentionally
- **Cert Builder** (no certificate concept yet — defer)
- **Color Control / Sidebar customization** (conflicts with VIFM brand kit per "Brand Kit" section)
- **Index card show/hide** (admin UX nice-to-have, low ROI)

## VIFM Courses workstream (the recommender bridge)

VIFM is fundamentally a training company; the AC and ARA modules are *diagnostic*. The courses workstream bridges the two — diagnostic gaps become prescriptive training-course recommendations rendered on AC engagements, ARA assessments, and the candidate Learning Plan PDF.

### Catalogue + tagging
- **Schema:** `vifm_courses` (migration 00023) — bilingual EN+AR, 7 building blocks captured as structured fields (`overview_*`, `target_competencies_raw_*` text[], `objectives_*` text[], `audience_*`, `methodology_*`, `outline_*` jsonb supporting 4-level depth, `note_*` admin annotations from migration 00024). Identity columns: `code`, `vertical` (one of 14: finance / investment / treasury / accounting / banking / tax / analytics / business_intelligence / artificial_intelligence / business_reporting / leadership / strategy / project_management / real_estate), `level`, `default_duration_days` + `min/max_duration_days` (band 2-5d typical), `delivery_modes`, `languages`, `certification_code`, `extraction_confidence`.
- **Tag tables:** `vifm_course_competency_tags` (course → AC's 38 behavioural competencies with relevance weight 1-3 + rationale + source 'manual'/'ai_proposed'/'ai_accepted') and `vifm_course_pillar_tags` (course → ARA's 8 pillars, same shape). Two-axis tagging because the PDF's own "Target Competencies" block is topical (e.g. "Bookkeeping Automation") while AC competencies are behavioural (e.g. "Strategic Thinking") — different ontologies serving different recommender contexts.
- **AI extraction** at `/admin/courses/import`: drag-and-drop up to 25 PDFs per batch, processed 5 in parallel via Claude's document content block, with per-row review + replace-on-re-import (case-insensitive code → title fallback). 127 courses imported and tagged on the live DB.
- **Mapping editor** at `/admin/courses/[id]`: edit existing AC/ARA tags inline with weight/rationale/source columns; rationale flips to manual on edit, AI-proposed flips to AI-accepted on weight tweak.
- **Duplicate-finder** at `/admin/courses/duplicates`: O(min) Levenshtein on case-insensitive whitespace-collapsed titles, surfaces pairs ≥85% similarity ranked Strong / Likely / Possible based on similarity threshold + same-vertical bonus + duration delta.

### Recommender library
[src/lib/recommender/courses.ts](src/lib/recommender/courses.ts) ships 4 ranking functions, all returning the same `RecommendedCourse[]` shape so a single panel component renders any context:
- `recommendCoursesForAcCandidate({ engagementId, candidateId })` — per-candidate consensus_ratings → competency gaps → courses, ranked by sum(gap × relevance).
- `recommendCoursesForAcCohort({ engagementId })` — aggregate variant, sums every candidate's gaps before ranking.
- `recommendCoursesForAraAssessment({ assessmentId })` — ARA pillar maturity_level → gap (target=4) → courses tagged to those pillars.
- `recommendCoursesForIndividualSnapshot({ factorScores })` — Mode A/B/C personal readiness → maps each below-target factor to AC competency names from `ARA_INDIVIDUAL_FACTORS`, looks up courses tagged to those competencies.

### Recommender UI surfaces
- **AC engagement detail** (`/admin/engagements/[id]`): cohort-aggregated panel below the engagement card, with a `?candidate=<id>` URL filter that switches to per-candidate view. Driver chips show competency name + gap × relevance + AI rationale on hover.
- **ARA Phase 2 tab** (`/ara/consultant/assessments/[id]`): "Capability-building plan" card listing courses ranked by per-pillar maturity gap. When Mode C is on, also shows a "Workforce training plan" panel using the cohort factor scores.
- **Candidate Learning Plan PDF**: 4th page (after Cover, Roadmap, Per-Competency cards) showing top-5 recommended VIFM programmes with ★ HIGH FIT badging when `total_score >= 4`, per-driver chips, and the AI rationale for the top driver as a soft caption.
- **ARA Personal Snapshot PDF + results page**: courses ranked by personal factor gaps (target=4), surfaced inline below the factor breakdown.

## ARA Personal / Individual readiness

### The four VIFM-native factors
Mapped to the existing AC 4-domain framework (consistent with org-side ARA's 8 pillars at a different granularity). Defined in [src/lib/constants/ara-individual-factors.ts](src/lib/constants/ara-individual-factors.ts):
- **AI Sense-Check** (THINKING) — critical evaluation of AI output, hallucination detection, domain validation. Maps to AC competencies: Analytical Reasoning, Decision Quality, Strategic Thinking.
- **AI Working Practice** (RESULTS) — productive hands-on use of AI, prompt-craft, workflow integration. Maps to: Action Orientation, Drive for Results, Plans and Aligns.
- **AI Collaboration** (PEOPLE) — leading or supporting team adoption, communicating about AI, shaping shared norms. Maps to: Communicates, Influences, Develops Talent, Builds Networks.
- **AI Adaptive Mindset** (SELF) — curiosity, openness to relearning, responsible posture. Maps to: Self-Development, Resilience, Manages Ambiguity, Self-Awareness.

### Three deployment modes

| Mode | Stage | Tier | Items | Issuance | URL |
|---|---|---|---|---|---|
| A — Free snapshot | `individual` | `snapshot` | 24 (6/factor) | Anonymous self-served | `/ara/personal/start` |
| B — Paid deep-dive | `individual` | `deep_dive` | 48 (12/factor) | Consultant-issued | `/ara/consultant/personal-deep-dive/new` |
| C — Org engagement layer | dept/division/enterprise + `include_individual_layer=true` | `snapshot` or `deep_dive` | 24 or 48 | Wizard toggle on `/ara/consultant/assessments/new` | (alongside org pillar items) |

All three modes share infrastructure: same `ara_questions` table (distinguished by `individual_factor_id` + `tier`), same `ara_respondents` flow (Mode C optionally `individual_only=true` to skip pillar questions), same results page (`/ara/personal/results/[token]` — gated to individual-stage OR include_individual_layer assessments) and same PDF endpoint (`/api/ara/personal/[token]/pdf`).

### Mode C consultant deliverables
- **Workforce-readiness rollup card** on the assessment detail's Phase 2 tab — cohort overall + 4 factor cards with green/amber/rose tones (≥4 / ≥3 / <3) + per-respondent breakdown table with `· individual-only` markers.
- **"Workforce training plan" panel** below the rollup — recommendCoursesForIndividualSnapshot driven by cohort factor means.
- **Workforce AI Readiness section** in the bilingual org PDF — appears before "Next Steps" when the layer is on and respondents have answered. Cohort overall row + 4 per-factor rows + reading-the-scores legend + tier badge. Per-respondent breakdown intentionally not in the client-facing PDF (stays in consultant view; consultant decides what to surface).

### Email + delivery
[src/lib/ara/email.ts](src/lib/ara/email.ts) ships 3 ARA email templates (each in EN / AR / bilingual): `ara_respondent_invitation` (M2.1), `ara_consultant_completion` (M3.3), `ara_personal_results_link` (Personal). The personal-results email fires on completion for Mode A, B, AND Mode C respondents — every individual respondent gets a direct link to their own results page + PDF, regardless of how the assessment was issued. Sandbox redirect honoured throughout via `SANDBOX_EMAIL_REDIRECT` env var; falls back to console-mock when Microsoft Graph creds are absent.

### Consultant dashboard
`/ara/consultant` filters out `engagement_stage='individual'` from the org-side pipeline view and renders a "Personal snapshots · last 30 days" panel showing snapshot vs deep-dive distinction (violet badge for deep-dive). Header copy reads e.g. `5 started · 2 completed · 1 deep-dive`.
