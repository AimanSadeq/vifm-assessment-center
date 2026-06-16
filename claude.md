# VIFM Assessment Center Digital Portal

> **Open work is tracked in [`PENDING-ACTIONS.md`](./PENDING-ACTIONS.md).** When the user
> asks whether there are any pending actions, read that file and surface the open items.
>
> **Conventions (SOP):**
> - **No em dashes (`—`).** Use regular hyphens (`-`) in all code, UI strings, content, comments, and chat replies.
> - **Every screen needs a back affordance.** New pages must include a back link (e.g. the shared `BackLink` component) so users can return to the previous screen.

## Project Overview
Custom-built Assessment Center management platform for Virginia Institute of Finance and Management (VIFM). The portal operationalizes the VIFM-AC Framework across four user interfaces: Admin, Assessor, Candidate, and Client. Target market: GCC and MENA region (banking, government, corporate).

## Current Status
All 5 development phases are **complete**. **Auth is ENABLED** (`AUTH_ENABLED = true` in `src/lib/auth/config.ts`, since 2026-06-13 commit `1092c28`; consumed by `src/middleware.ts` + `src/lib/ara/auth-guards.ts`): unauthenticated requests to non-public routes redirect to `/login`, and the demo quick-login dropdown is hidden outside development. Real users need a `profiles` row with a role - see `src/lib/auth/README.md` and `scripts/create-admin.ts`.

**ARA module status:** VIFM ARA (AI Readiness Assessment) is built out and merged into master. M1–M6 complete (respondent flow, scoring, distortion, peer benchmarks, year-on-year, bilingual consultant notes, EN/AR/bilingual Puppeteer PDF report, Phase 2 consultant guide, regulatory doc upload with Claude extraction, **annual reassessment workflow shipped 2026-04-28 via `createReassessmentFromPrior` in `src/lib/ara/consultant-actions.ts` with copy-and-create of org/stage/scope/weights + opt-in respondent carry-over + new active question-bank pin + `ara_assessments.prior_assessment_id` audit link**). M2.1 (respondent invitation email) and M3.3 (consultant completion notification) shipped 2026-04-28 via `src/lib/ara/email.ts` with bilingual templates + sandbox redirect + ara_email_log writes. Retention purge + sandbox cleanup admin pages shipped at `/ara/admin/retention` + `/ara/admin/sandbox`; scheduled cron for those is the only ARA item still open. See "ARA Module" section below for the current deferred-items list.

**AC competitor-parity status:** Fifteen features inspired by a competitor walkthrough are shipped on `master` (P0.1 JD-to-competency extractor, P0.2 role profile library, P0.3 gap-severity badges, Learning Plan PDF, G1 candidate→role-profile binding, G2 learner skill dashboard, G3 self-serve AI quiz flow with MCQ + cognitive items + per-question AI explanations, G4 bulk JD import, G5 bulk CSV user-to-persona linking, G6 JSON export, **G7 admin re-engagement workflow shipped 2026-04-28 — "Re-engage cohort" button on completed/archived engagement detail copies design + candidates with `prior_engagement_id` + `prior_candidate_id` links and renders an OAR delta pill ("↑+1 vs prior") on each candidate row once the new run scores**, H1 JD-extractor domain tally card, H2 personal-statistics donut + bar charts on /candidate/skills, H3 in-app notification bell, H4 admin "view as candidate" banner). Full second-pass analysis (158-frame video sweep) lives in `.tmp/parity-gap-analysis.md`; see "AC competitor-parity upgrades" section below.

**Hardening + i18n status (2026-04-28):** Migration 00019 hardens the parity tables — `notifications` split into per-op policies + read-only-recipient trigger, `candidate_quiz_attempts` immutable-fields trigger + initial-state CHECK constraint preventing fabricated score writes. Bilingual EN/AR translations shipped on the candidate-facing surfaces (skills dashboard, personal-statistics charts, quiz interface, quiz results, Start AI Quiz button, notification bell, admin "view as" banner, candidate layout chrome) plus AI-generated quiz prompts/options/explanations now bilingual via `bilingual: true` on the generator. I18nProvider is route-aware: only `/candidate/*` and `/ara/respond/*` honour the `vifm-locale` cookie; admin / login / assessor / client portals stay LTR/EN regardless (closes a dir-leak that drifted the admin sidebar to centre when the cookie was `ar`). Full roadmap with statuses lives in `docs/post-parity-roadmap.md`.

**VIFM Courses workstream (2026-04-28):** The bridge that turns AC + ARA gap diagnoses into VIFM training-course recommendations. Four-day workstream shipped end-to-end. Day 1: schema (00023, 00024) + sidebar entry + manual editor for the seven blocks (Course Overview · Target Competencies · Course Objectives · Target Audience · Course Methodology · Course Outline · Note). Day 2: AI PDF extraction at `/admin/courses/import` — Claude reads all 6 PDF blocks + proposes AC competency tags + ARA pillar tags with rationale. 127 courses imported and tagged on the live DB. Day 3: course recommender library (`src/lib/recommender/courses.ts`) + panels on AC engagement detail (cohort-aggregated with per-candidate filter), ARA Phase 2 tab, and a 4th page on the candidate Learning Plan PDF showing top-5 recommended VIFM programmes with ★ HIGH FIT badges and per-driver chips. Day 3d/e/f: course mapping panel on `/admin/courses/[id]`, per-candidate recommendation filter via `?candidate=<id>`, training recommendations on the Learning Plan PDF. Lifecycle: re-import-overwrite by code/title (case-insensitive), per-row delete with confirmation, drag-and-drop on the import zone, and a Levenshtein duplicate-finder at `/admin/courses/duplicates`. Block 6 supports 4-level depth (main header → subsections → bullets → sub-bullets) via a markdown-style editor that round-trips structured jsonb.

**ARA Personal / Individual readiness (2026-04-28):** Three deployment modes for VIFM-native four-factor individual AI readiness, designed mapped to the existing AC 4-domain framework (THINKING · RESULTS · PEOPLE · SELF). Factors: AI Sense-Check, AI Working Practice, AI Collaboration, AI Adaptive Mindset. Mode A (free snapshot, 24 items, anonymous self-served at `/ara/personal/start`). Mode B (paid deep-dive, 48 items, consultant-issued at `/ara/consultant/personal-deep-dive/new` — requires admin/consultant role). Mode C (individual layer alongside an org engagement — toggle on the assessment-create wizard, optional `individual_only` respondents who skip pillar questions, workforce-readiness rollup card on the consultant assessment detail and a dedicated section in the bilingual org PDF). Schema in 00025 (engagement_stage extended + individual_factor_id), 00026 (16-item snapshot seed), 00027 (tier system + 32 more items + include_individual_layer + individual_only). Consultant dashboard surfaces personal-snapshot activity (last 30 days, snapshot vs deep-dive distinction). On completion, every individual respondent gets the personal results-link email (URL + PDF) regardless of mode; the personal results page + PDF endpoint are gated to individual-stage OR include_individual_layer=true assessments only.

## Tech Stack
- **Framework:** Next.js 14 with App Router and TypeScript (strict mode)
- **Styling:** Tailwind CSS with Shadcn/UI component library (New York style)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth:** Supabase Auth with Row-Level Security (RLS) per role - `AUTH_ENABLED = true` (enabled) in src/lib/auth/config.ts
- **Real-Time:** Supabase Realtime (live wash-up collaboration)
- **Reporting:** React-PDF for candidate reports (6-page professional format), Recharts for analytics
- **AI:** Anthropic Claude API (observation classifier, report writer, development recommender, bias detector)
- **i18n:** react-i18next with RTL support for Arabic
- **Email:** Microsoft Graph API (Azure AD app credentials) — `src/lib/integrations/email.ts` ships 6 AC templates; falls back to console-mock when env vars are absent
- **Video:** Daily.co SDK placeholder for virtual AC sessions
- **Font:** Open Sans (VIFM Brand Kit)
- **Colors:** Primary Blue #010131, Accent Blue #5391D5, Off-White #FEFFF9, Dark Blue #111232, Navy Blue #121140
- **Deployment:** Render (web service) + Supabase Cloud (backend). NOT Vercel — the production checklist PDF still says Vercel and is stale; ignore it. Render auto-deploys on push to `master`.

## Project Structure
```
src/
  app/
    (auth)/               # Login (email/password + magic link), register, password reset
    admin/                # Admin portal (collapsible sidebar, process map dashboard)
      clients/            # Platform Clients — unified registry: "Add Client" dialog (dual-writes to both org stores) + union list with per-service badges
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
      prehire/            # Pre-Hire screening — requisition list + 1-step create wizard
        [id]/             # Requisition detail: ranked shortlist, invite (email/link), per-candidate report, email-report-to-client (no hiring decision), JSON/CSV export
        [id]/fairness/    # Defensibility hub — adverse-impact (4/5ths) tables + immutable audit trail
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
      academy/            # VIFM Academy — My Learning list + course page + Complete Course
      academy/[enrollmentId]/lesson/[lessonKey]/  # Per-lesson AI knowledge-check (reuses the G3 quiz engine)
      credentials/[candidateId]/  # Candidate credential wallet (Academy / AC Ready Now / Fluent CEFR)
    ara/
      personal/start/                  # Free Personal AI Readiness Snapshot entry (Mode A, anonymous)
      personal/results/[token]/        # Bilingual results page — factor scores + course recommendations + PDF download
      consultant/personal-deep-dive/new/  # Paid 48-item deep-dive issuance (Mode B, requires admin/consultant role)
      consultant/                      # Consultant dashboard with personal-snapshot-activity panel (last 30d, snapshot vs deep-dive)
      consultant/assessments/[id]/     # Org assessment detail — adds Workforce Readiness rollup card on Phase 2 tab when Mode C
      respond/[token]/                 # Stage-aware respondent form — pillar questions + four-factor items based on assessment.engagement_stage / include_individual_layer / individual_only
    ac/                   # Standalone AC AI tools
      fluent/             # Fluent English placement — runner + cohort + calibration (admin "Fluent" nav link)
      ai-interview/       # AI Conversational Assessor (CBI prototype) — direct-URL, no nav link
    reflect/              # Reflect 360 leadership feedback (own reflect_* tables, ARA-style)
      admin/              # Console + library templates + retention/sandbox purge
      consultant/         # Dashboard, 5-step engagement wizard, participant report + IDP, cohort report
      respond/[token]/    # Token-gated rater form (auth-bypassed in middleware)
    prehire/apply/[token]/ # Pre-Hire candidate flow (token-gated, no account) — consent → quiz + Fluent + CBI → optional voluntary self-ID
    verify/[code]/        # Public credential verification page (auth-bypassed)
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
      ac/cbi/                                  # CBI agent — {action: "turn" | "score"}
      ac/fluent/                               # Fluent start/score (+ /transcribe Whisper, /tts, /[resultId]/certificate PDF)
      academy/                                 # enroll, lesson/start, lesson/[attemptId]/(save|complete), complete
      reflect/reports/...                      # Participant + cohort PDFs (Puppeteer) + framework.pdf + needs-scheduling.csv
      reflect/admin/reminders/cron/            # Rater-reminder sweep (Bearer CRON_SECRET; GitHub Actions)
      credentials/verify/[code]/               # Public verification (service-role; auth-bypassed)
      credentials/[credentialId]/pdf/          # Credential PDF
      prehire/[token]/                         # Pre-Hire candidate token routes — consent, quiz (start/submit), fluent (start/submit/transcribe/tts), cbi (turn/submit), demographics
      admin/prehire/[id]/export/               # Admin-gated ATS export (JSON/CSV) — deliberately OUTSIDE the /api/prehire/ auth-bypass
  components/
    ui/                   # 17 Shadcn/UI components
    shared/               # Process map, BackLink, LanguageSwitcher, VifmLogo, EngagementPicker, LogoutButton
  lib/
    supabase/             # Server client, browser client, middleware, service client
    auth/                 # getClientOrgId helper, README migration guide
    ai/                   # AI client, observation assistant, report writer, dev recommender, bias detector, JD competency extractor (P0.1), quiz generator (G3), course extractor; reflect-behavior-extractor + reflect-behavior-tips (Reflect), cbi-interviewer (CBI), fluent-english (Fluent)
    notifications/        # Publish + load + mark-read helpers (H3)
    constants/            # Exercise type labels, ARA pillars, ARA stages, ARA individual factors (the 4 VIFM personal factors)
    i18n/                 # Config, provider (route-aware), cookie + locale constants, server-side getServerT helper, EN + AR locale files
    integrations/         # Email (7 AC templates incl. prehire_invitation), Video (Daily.co placeholder), Speech (Azure pronunciation; Whisper via scripts/), Transcription (shared Whisper+Azure helper for Fluent speaking)
    ara/                  # ARA-specific helpers — auth-guards, email (3 ARA templates), respondent-access, scoring, distortion, year-on-year, peer-benchmarks, regulatory engine, workforce-readiness rollup (Mode C)
    reflect/              # Reflect 360 — actions, admin-actions, idp-actions, rater-access, rater-actions, scoring, validations, email
    academy/              # Academy completion (markEnrollmentComplete → academy_completion credential) + lesson-key helpers
    credentials/          # Shared issuer + public verification reader (issue.ts) + AC Ready-Now issuance (ac-ready-now.ts)
    prehire/              # Pre-Hire — candidate-access (token), composite scoring/ranking, adverse-impact (4/5ths), audit-log helper
    recommender/          # Course recommender (AC candidate / AC cohort / ARA pillar / Personal snapshot)
    reports/              # Candidate report PDF (6 pages) + Learning Plan PDF (4 pages incl. recommended training) + Personal Snapshot PDF (1 page bilingual), data fetcher, report types
    scoring/              # ICC calculation, bias detection, gap-severity computation (P0.3), reliability/confidence band + IRT/Rasch CAT (Fluent)
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
    00028_ara_question_validation_evidence.sql # ARA per-question validation_evidence JSONB (anchor instruments + human-review status)
    00029_assessment_pillars_in_scope.sql      # Per-assessment pillars_in_scope override (decouples pillar set from engagement_stage)
    00030_vifm_course_quote_requests.sql       # Public /courses lead-capture: vifm_course_quote_requests (new→contacted→quoted→won/lost)
    00031_reflect_enums.sql                    # Reflect 360 enums (engagement / rater / level / scale / participant / idp lifecycles)
    00032_reflect_core_schema.sql              # Reflect 360 core: 11 reflect_* tables + owner helpers + RLS
    00033_reflect_seed_template_framework.sql  # Seed "VIFM Leadership Essentials" template (5 competencies × 4 behaviours, bilingual)
    00034_reflect_template_align_ac_names.sql  # Aligns the Reflect template's names to AC competency names
    00035_quote_request_engagement_type.sql    # Quote requests gain engagement_type ('direct'/'ac'/'ara'/'reflect') + Reflect FKs
    00036_reflect_open_responses.sql           # reflect_raters Start / Stop / Continue open-text columns
    00037_reflect_critical_picks.sql           # reflect_raters.critical_competency_ids (Self + Manager role-critical picks)
    00038_reflect_rater_tenure.sql             # reflect_rater_tenure enum + column ("how long have you known this person")
    00039_reflect_reassessment_links.sql       # reflect_engagements.prior_engagement_id + reflect_participants.prior_participant_id
    00040_ac_cbi_sessions.sql                  # AI Conversational Assessor: cbi_sessions audit (AI draft vs human-approved)
    00041_ara_agentic_tier.sql                 # ARA agentic-AI readiness tier (agentic_dimension_id + include_agentic_layer + 18 items)
    00042_eng_fluent_results.sql               # Fluent: eng_fluent_results (one row per completed placement test)
    00043_eng_fluent_depth.sql                 # Fluent: integrity_flags + email_sent_at on results
    00044_eng_fluent_candidate_binding.sql     # Fluent: candidate_id + engagement_id on results (admin-run-for-candidate)
    00045_eng_fluent_sessions.sql              # Fluent: eng_fluent_sessions (full test held server-side; answer key never sent)
    00046_eng_fluent_calibration.sql           # Fluent: eng_fluent_human_ratings + eng_fluent_score_runs (QWK calibration)
    00048_eng_fluent_item_bank.sql             # Fluent: eng_fluent_items + eng_fluent_item_responses (IRT/Rasch CAT groundwork; no 00047)
    00049_academy_credentials.sql              # vifm_enrollments + academy_lesson_attempts + vifm_credentials (deliver + certify)
    00050_prehire_pipeline.sql                 # Pre-Hire: prehire_requisitions + prehire_candidates + prehire_stage_results (commercial screening funnel)
    00051_prehire_defensibility.sql            # Pre-Hire: voluntary demographics + human-decision capture + immutable prehire_audit_log (adverse-impact + audit)
    00052_tech_assessment.sql                  # Technical: tech_assessment_sessions (server-held key) + tech_assessment_results (indicative 1–5 per domain)
    00053_tech_assessment_item_bank.sql        # Technical Tier 2: SME-reviewed tech_assessment_items + tech_assessment_cut_scores + widened vifm_credentials type CHECK (adds technical_proficiency)
    00054_technical_taxonomy_bridge.sql        # Technical taxonomy → DB: technical_domains + technical_skills + technical_domain_competencies (the technical→behavioural "enables" bridge) + FK tech_assessment_*.domain_key → technical_domains
    00055_technical_skills_arabic.sql          # technical_skills.name_ar (50 Arabic skill names) — the runner reads bilingual domains+skills from the DB so the picker, item skill badges, and per-skill result localize
    00056_engagement_technical_domains.sql     # engagement → technical certification program: which domains are in scope per AC engagement (the paid org-certify layer; results/credentials already bind via candidate_id+engagement_id)
    00057_technical_programs.sql               # standalone (ARA-style) technical certification: technical_programs (org + dept/division/enterprise tier) + program_domains + token-based program_participants + program_id/participant_id on tech_assessment_results/sessions
scripts/
  seed-test-data.ts       # Creates full test dataset (engagement + candidates + assessor + observations)
  seed-tags-qa.py         # Populates tags and Q&A questions for competencies
  whisper-transcribe.py   # Fluent speaking transcription (faster-whisper + ffmpeg)
  fluent-calibrate-items.ts  # Computes Rasch difficulty for the Fluent item bank
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
- Auth toggle: `AUTH_ENABLED` in `src/lib/auth/config.ts` (currently `true` - enabled 2026-06-13, commit `1092c28`); consumed by `src/middleware.ts` + `src/lib/ara/auth-guards.ts`. Unauthenticated `/admin/*` + `/candidate/*` redirect to `/login`; token-gated routes + `/courses` + `/login` stay open.
- Login form: email/password + magic link (implemented)
- Dev bypass: 4 role buttons on login page - shown only in development (hidden in production)
- Create an admin: `scripts/create-admin.ts` (creates the auth user + the required `profiles` row with role=admin)
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
- **Platform Clients = unified client registry across two org stores.** The portal keeps two organization tables: `organizations` (Assessment Center + Pre-Hire) and `ara_organizations` (AI Readiness + Reflect 360, requires `region`∈{uae,saudi} + `sector`∈{government,banking,general}). [src/lib/clients/registry.ts](src/lib/clients/registry.ts) `createClientOrganization()` **dual-writes** to both (service-role — bypasses the `organizations` RLS that denied client-side inserts), deduped by case-insensitive name, deriving region/sector from country/industry when absent; `loadPlatformClients()` returns a name-keyed **union** with per-service `acId`/`araId`. Surfaces: the "Add Client" dialog on `/admin/clients` (`createClientAction`) and the engagement wizard's inline "+ New" (`createOrganizationAction`, now service-role — fixes the "new row violates row-level security policy for table organizations" error). A client created once is selectable in every service.
- The Wash-Up Engine is the single most important differentiator. It includes Supabase Realtime for live multi-user collaboration.
- Arabic competency translations are placeholders and must be human-reviewed before going live.
- Auth is **enabled** (`AUTH_ENABLED = true`, since 2026-06-13). Real users need a `profiles` row with a role; create admins via `scripts/create-admin.ts`. See `src/lib/auth/README.md`.
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
- ~~AUTH_ENABLED flip~~ **DONE** - auth enabled 2026-06-13 (commit `1092c28`); demo login hidden in production; enforcement verified (`/admin/*` + `/candidate/*` → `/login`). Provision admins via `scripts/create-admin.ts`.
- **Mode A norm group accumulation:** percentile claims like "you scored at the X% percentile of GCC respondents" require ~200-500 completed Personal AI Readiness Snapshots in the DB. Passive — accumulates as people take the free snapshot. No action needed until the volume's there.

### Recently shipped (2026-05-15)
- **Customer-facing training catalogue with quote CTAs:** discoverable from `/ara` header nav, surfaced again on `/ara/engage` as a bridge section, and cross-linked from the personal results page below the gap-driven recommender. The full flow already existed at `/courses` (public listing with vertical+level filters), `/courses/[code]` (programme detail), `/courses/[code]/request-quote` (lead-gen form with org/role/cohort-size/timeline/notes), and `/admin/courses/quotes` + `/admin/courses/quotes/[id]` for consultant follow-up. Only the discoverability into the marketing surfaces was missing.
- **Arabic personal-snapshot PDF:** dual-renderer dispatch in `/api/ara/personal/[token]/pdf` — English stays on React-PDF, Arabic renders via Puppeteer + HTML so Chromium can shape the glyphs React-PDF can't. Layout mirrors the EN three-page report. All Arabic content (12 stage×factor coaching blurbs, 9 stage next-steps bullets, all UI strings) lives in `src/lib/reports/personal-snapshot-ar-html.ts` for single-source-of-truth translation.
- **Retention purge cron:** scheduled via `.github/workflows/ara-retention-purge.yml` (daily 03:00 UTC). Replaces the no-op `vercel.json` cron from the original Vercel deployment. Bearer auth via `CRON_SECRET` set in BOTH Render env and GitHub Actions secrets. Sandbox cleanup stays manual (typed "DELETE SANDBOX DATA" confirmation required by design).
- **Respondent submit-flush:** Submit button now awaits any in-flight auto-saves before firing `markAraRespondentComplete`. Closes a race the audit demonstrated where 24 fast-clicked answers + a quick Submit could land with only N-of-24 responses persisted. Form-save gate registers via a module-level `Map<token, FormSaveGate>`; CompleteButton shows a distinct "Saving your answers…" label during the flush.

### Per-assessment pillar scope override
By default the pillars an assessment scores are derived from its `engagement_stage` (Department = 4: data/talent/culture/operations; Division = 6: adds strategy/governance; Enterprise = all 8). Migration 00029 adds `ara_assessments.pillars_in_scope text[]` (GIN-indexed) so a consultant can pick a *different* combination at the same tier — same price + question count, different *which* (e.g. a bank at Stage 1 choosing Data + Governance + Talent + Model Management).
- **Resolution:** `getPillarsForAssessment({ engagement_stage, pillars_in_scope })` in [src/lib/constants/ara-stages.ts](src/lib/constants/ara-stages.ts) is the single source of truth — honours the override, ignores it for Enterprise (always all 8), validates the stored array, and falls back to the stage default (`ARA_STAGE_MAP[stage].applicable_pillars`) for legacy NULL rows. Use it everywhere the renderer / scorer / respondent loader needs "which pillars matter for THIS assessment" instead of reading the stage map directly.
- **Wizard:** `pillar-picker.tsx` on `/ara/consultant/assessments/new`, constrained by `PILLAR_PICK_COUNT` (department = exactly 4, division = exactly 6, enterprise = all 8 with no picker shown). Treated as locked once respondent answers exist (UI discipline — no DB-level lock). Consumed by the report (`bilingual-report.tsx`), the assessment detail page, the respondent loader, and aggregate scoring.

### Agentic-AI Readiness tier (opt-in)
A separate readiness construct on the question bank measuring readiness to **delegate** work to autonomous AI agents — distinct from the 8 pillars, which measure readiness to **use** AI. Off by default; an assessment opts in via `ara_assessments.include_agentic_layer` (a toggle on the create wizard, `agentic-layer-toggle.tsx`).
- **Six dimensions** ([src/lib/constants/ara-agentic-dimensions.ts](src/lib/constants/ara-agentic-dimensions.ts), bilingual + tone colour, each anchored to the `governance` or `model_management` pillar): Agent Governance & Accountability, Human-in-the-Loop & Oversight, Failure-Mode & Risk Awareness, Tool & Data Access Control, Autonomy Calibration, Auditability & Traceability.
- **Schema (migration 00041):** `ara_questions.agentic_dimension_id` (CHECK-constrained to the six ids) + `ara_assessments.include_agentic_layer`. 18 seed items (3 per dimension, question numbers 201–218, Layer 2) live on the active v1.1 bank, so existing assessments inherit them the moment they opt in. The items carry a real `pillar_id` for storage compatibility but are always filtered by `agentic_dimension_id`, so they never pollute the 8-pillar scoring.
- **Respondent flow** ([src/lib/ara/respondent-access.ts](src/lib/ara/respondent-access.ts)): served to org respondents only — `wantsAgentic = !isIndividualStage && include_agentic_layer && !individual_only`. The pillar query explicitly excludes agentic + individual items (`.is("agentic_dimension_id", null)`), so the three layers (pillar / individual-factor / agentic) never bleed into each other.
- **Rollup + deliverables:** `computeAgenticReadiness(assessmentId)` ([src/lib/ara/agentic-readiness.ts](src/lib/ara/agentic-readiness.ts)) returns cohort mean per dimension + per-respondent breakdown + cohort overall (target = 4; null when no agentic answers yet) — mirrors the Mode C workforce rollup. Surfaces as a rollup card on the consultant assessment detail and an "Agentic-AI Readiness" section in the bilingual PDF report (cohort overall + six per-dimension rows; renders only when the layer is on and respondents have answered).

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

### Public catalogue + quote requests (lead capture)
The public, no-account half of the courses workstream. Anyone can browse `/courses` (vertical + level filters), open `/courses/[code]`, and submit a quote request at `/courses/[code]/request-quote` (`quote-request-form.tsx`); middleware treats `/courses/*` as public (auth-bypassed). VIFM staff work the queue at `/admin/courses/quotes` + `/admin/courses/quotes/[id]` (`actions-panel.tsx`: assign, status, internal notes).
- **Server actions:** [src/lib/courses/quote-request-actions.ts](src/lib/courses/quote-request-actions.ts) — the form posts through a server action using the service-role client.
- **Schema (migrations 00030 + 00035):** `vifm_course_quote_requests` — requester name/email/company (required) + phone/role, optional scope (`estimated_group_size`, `preferred_start_date`, `preferred_language` en/ar/bilingual, `delivery_mode` in_person/virtual/hybrid, notes), `course_code_snapshot`/`course_title_snapshot` (survive a later course delete), pipeline `status` (new → contacted → quoted → won/lost) + `assigned_to` + timestamps, and `ip_address`/`user_agent` (forensic-only, never surfaced in the admin UI). `engagement_type` (00035: `direct`/`ac`/`ara`/`reflect`) distinguishes a cold `/courses` lead from one clicked off a diagnostic report, with nullable `reflect_engagement_id`/`reflect_participant_id` FKs so a Reflect-report quote traces back to its source.
- **RLS:** public INSERT (`WITH CHECK (true)`), admin-only SELECT + UPDATE, no DELETE (commercial record-keeping; purge via service-role only).

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

## Reflect 360 Module (360° leadership feedback)

A standalone multi-rater leadership-feedback module, built alongside AC/ARA the same way ARA was — its own `reflect_*` tables, its own `/reflect/*` route namespace, and reuse of ARA primitives (`ara_organizations`, `ara_region`/`ara_sector`/`ara_language`/`ara_report_language`, the `update_updated_at()` trigger and `auth_role()` helper). Bilingual EN + Gulf Arabic with RTL. The consultant brings the client's Corporate Values / Leadership Competencies; Claude decomposes them into observable behaviours; Self + Manager + Peer + Direct Report raters score them on a 5-point frequency scale; the module produces a development-grade participant report + Individual Development Plan (IDP) and an organisation-wide cohort view.

### Roles
- **admin** — curates library templates, monitors active engagements, runs retention/sandbox purge, audits email + scoring activity.
- **consultant** — owns their own engagements and all children; scoped RLS via `reflect_is_engagement_owner()` / `reflect_participant_owner_engagement()`.
- **rater** — no account. Accesses the form via `reflect_raters.access_token`; identity is always derived server-side from the token, never trusted from the client.

### Route namespace (`/reflect/*`, API `/api/reflect/*`)
- `/reflect` — module landing. (Its footer still reads "Module status: Scaffolding (M1)" — stale copy; the module is actually built out through several P0–P4 parity passes.)
- `/reflect/admin` + `/reflect/admin/templates` + `/reflect/admin/templates/[id]` — admin console, library-template curation, retention/sandbox purge buttons.
- `/reflect/consultant` — consultant dashboard.
- `/reflect/consultant/engagements/new` — 5-step wizard (basics → framework → levels → people → launch).
- `/reflect/consultant/engagements/[id]` — engagement detail (debrief row actions, "start reassessment" button) + `/cohort-report` + `/framework-preview`.
- `/reflect/consultant/participants/[id]/report` + `/idp` (IDP editor).
- `/reflect/respond/[token]` — token-gated rater form (auth bypassed in middleware).
- API: `/api/reflect/reports/[participantId]/pdf`, `/api/reflect/reports/cohort/[engagementId]/pdf`, `/api/reflect/engagements/[id]/framework.pdf`, `/api/reflect/engagements/[id]/needs-scheduling.csv`, `/api/reflect/admin/reminders/cron`.
- Admin sidebar link "Reflect 360" (`adminNav.reflect360`, Aperture icon) → `/reflect`.

### Key files
- `src/lib/reflect/` — `actions.ts` (consultant CRUD), `admin-actions.ts`, `idp-actions.ts`, `rater-access.ts` (`findRaterByToken`), `rater-actions.ts` (token-gated save / open-response / tenure / critical-picks / complete / reminder server actions), `scoring.ts` (group means, anonymity filtering, self-vs-others gap, prior-run deltas), `validations.ts` (Zod), `email.ts`.
- `src/lib/ai/reflect-behavior-extractor.ts` — values/competencies (EN/AR/mixed) → 3–5 observable bilingual behaviours per item (wizard step 2).
- `src/lib/ai/reflect-behavior-tips.ts` — per-behaviour bilingual coaching tips for top development-area behaviours (report/debrief).

### DB tables (migrations 00031–00039)
- `00031` enums; `00032` core schema (11 tables + helper functions + RLS); `00033` seed "VIFM Leadership Essentials" template (5 competencies × 4 behaviours); `00034` aligns template names to AC competency names; `00036` Start/Stop/Continue open-text columns on `reflect_raters`; `00037` Self+Manager `critical_competency_ids`; `00038` `reflect_rater_tenure` enum + column; `00039` reassessment self-FKs (`prior_engagement_id`, `prior_participant_id`).
- Tables: `reflect_engagements`, `reflect_frameworks` (a library template when `engagement_id IS NULL AND is_template`), `reflect_competencies`, `reflect_behaviors`, `reflect_participants`, `reflect_raters`, `reflect_responses`, `reflect_idps`, `reflect_reports`, `reflect_email_log`, `reflect_audit_log`.

### Auth/RLS + delivery notes
- Every table is RLS-enabled: admin full; consultant scoped to owned engagements; library templates readable by all consultants. Rater writes go through `"use server"` actions using the **service-role client** (bypassing RLS) after `requireRater()` validates the token, refuses already-completed raters, and requires the engagement to be `draft`/`live`. Middleware bypasses `/reflect/respond/` + `/api/reflect/respond/`.
- **Anonymity:** `reflect_engagements.anonymity_min_n` (default 3) hides peer/direct-report group means + verbatims until a group reaches the threshold.
- **PDF:** Puppeteer (participant report, cohort report, framework) — same engine as ARA, not React-PDF.
- **Email:** 3 templates (`reflect_rater_invitation`, `reflect_rater_reminder`, `reflect_completion_notice`) logged to `reflect_email_log`; sandbox redirect honoured.
- **Reminder cron:** `/api/reflect/admin/reminders/cron` (Bearer `CRON_SECRET`) sweeps `live` engagements and nags raters silent > 72h; scheduled by `.github/workflows/reflect-rater-reminders.yml`.
- **Reassessment:** mirrors AC/ARA — `scoring.ts` resolves a competency's `prior_others_mean` by name match so reports render year-on-year deltas.

## Fluent (English placement)

VIFM Fluent is a self-served English-language placement test, positioned as **indicative placement, not a certified high-stakes score**. Four CEFR-aligned skills (A1–C2): reading + listening are auto-scored MCQs; writing + speaking are Claude-scored against a CEFR rubric. The test content is always English; the UI/instruction language can be EN or AR. Anonymous by default (the taker optionally enters a name/email); an admin can also run it *for* a candidate via `?candidateId=…` so the placement lands on that candidate's record alongside their AC scores.

### Route namespace (`/ac/fluent`, API `/api/ac/fluent/*`)
- `/ac/fluent` — test runner (`FluentClient`); `/ac/fluent/cohort` — admin cohort report; `/ac/fluent/calibration` — human re-rating console for AI-score calibration.
- `/api/ac/fluent` — `{action:"start"}` returns an answer-key-stripped test + `session_id`; `{action:"score"}` reloads the stored test server-side and grades it.
- `/api/ac/fluent/transcribe` — **fallback** server transcription only. By default speaking is transcribed **in the browser** via the free Web Speech API (`src/lib/speech/browser-stt.ts`), so it works on Render with no server STT and no paid API. This route runs only for browsers without Web Speech (e.g. Firefox): OpenAI Whisper API when `OPENAI_API_KEY` is set, else local faster-whisper in dev. `/api/ac/fluent/tts` — listening-item audio; `/api/ac/fluent/[resultId]/certificate` — CEFR certificate PDF.
- Admin sidebar link "Fluent" (`adminNav.fluent`, Languages icon) → `/ac/fluent`.

### Key files
- `src/lib/ai/fluent-english.ts` — `generateFluentTest()`, `scoreFluentWriting/Speaking` (+ ensemble variants), `computeFluentResult()`, `stripAnswerKey()`, `blendPronunciation()`. Falls back to a static deck + placeholder scores when `ANTHROPIC_API_KEY` is absent.
- `src/lib/integrations/speech.ts` — Azure pronunciation (`isAzureSpeechConfigured`, `assessPronunciation`); optional, blended into the speaking score.
- `src/lib/scoring/reliability.ts` — overall confidence band; `src/lib/scoring/irt.ts` — `selectNextItem` (Rasch/CAT groundwork, dark until items reach `status='live'`).
- `src/lib/speech/browser-stt.ts` — **browser-native speech-to-text** (Web Speech API), the primary free speaking-transcription path (no server, no API key); falls back to the server `/transcribe` route on unsupported browsers.
- `scripts/whisper-transcribe.py` (faster-whisper + ffmpeg; no audio persisted; dev-only fallback); `scripts/fluent-calibrate-items.ts`.

### DB tables (migrations 00042–00048)
- `eng_fluent_results` (`00042`; + `integrity_flags`/`email_sent_at` in `00043`; + `candidate_id`/`engagement_id` in `00044`) — one row per completed test; `result` jsonb holds the full per-criterion detail for the certificate + detail view.
- `eng_fluent_sessions` (`00045`) — the full test (with answer key) held server-side so the key never reaches the browser; ~3h TTL.
- `eng_fluent_human_ratings` + `eng_fluent_score_runs` (`00046`) — calibration substrate; a human re-rates writing/speaking and QWK (Claude vs human, target ≥ 0.70) is computed per skill.
- `eng_fluent_items` + `eng_fluent_item_responses` (`00048`) — calibrated item bank (IRT/Rasch difficulty) + response log for a future computer-adaptive flow.

### Auth/RLS + integrity notes
- All `eng_fluent_*` tables are RLS **admin-SELECT only**; every write goes through the service-role API route (mirrors the ARA respondent model — no client-side writes, no candidate/profile FK required on the anonymous path).
- **Integrity:** the answer key is stripped from the start payload and grading happens server-side; if `eng_fluent_sessions` isn't migrated yet the route falls back to the legacy client-graded path (non-breaking). Client-side proctoring (`integrity_flags`: tab-blur + paste counts) is advisory only — surfaced to admins, never auto-fails.
- On completion the route issues a `fluent_cefr` credential (see Credentials) and best-effort emails the taker their results + certificate.
- **Env:** `ANTHROPIC_API_KEY` (test authoring + writing/speaking scoring), `AZURE_SPEECH_KEY` (optional pronunciation). Speaking transcription needs **no env** by default (browser Web Speech API); `OPENAI_API_KEY` (optional OpenAI Whisper API) or `PYTHON_BIN`/`FFMPEG_BIN` (local Whisper, dev) only power the server fallback for browsers without Web Speech.

## AI Conversational Assessor (CBI)

A prototype AI competency-based-interview agent. It runs a structured STAR behavioural interview on **one competency at a time** (one question per turn, bilingual EN/AR), then scores the full transcript into competency evidence + a BARS 1–5 rating with rationale. Positioned as a screening/sifting aid that runs **before** a human assessor — the human reviews and validates; the AI never makes the final decision.

### Route namespace
- Page: `/ac/ai-interview` (titled "AI Conversational Assessor"). API: `/api/ac/cbi` with `{action:"turn"}` (next interviewer question) and `{action:"score"}` (transcript → `CbiScore`). **Note:** there is no `/ac/cbi` *page* — `cbi` is only the API namespace. No static nav link; the page is reached by direct URL.
- The page loads CBI context from real `assessor_assignments` whose exercise is `exercise_type='competency_based_interview'`, with the mapped competencies pulled from `exercise_competency_matrix` (or runs standalone/demo).

### Key files
- `src/lib/ai/cbi-interviewer.ts` — `nextInterviewerTurn()`, `scoreCbiInterview()` (`MAX_CANDIDATE_ANSWERS = 4`; candidate text is sanitized as a prompt-injection defence; falls back to placeholders without an API key).
- `src/app/ac/ai-interview/actions.ts` — `persistCbiDraftAction` (save transcript + AI draft), `approveCbiToPipelineAction` (**the human-review gate**), `discardCbiSessionAction`.
- `src/app/ac/ai-interview/_components/interview-client.tsx`.

### The human-review gate (why this matters)
`approveCbiToPipelineAction` takes the assessor's reviewed evidence + rating and writes them into the **same `observations` + `ratings` tables the manual assessor flow uses** (`ratings` upsert on `assessor_assignment_id,competency_id`). AI-assisted evidence therefore flows through the normal integration → wash-up → consensus → OAR pipeline. Approval requires an `assessor_assignment_id`; `cbi_sessions` is the audit record of what the AI proposed vs. what the human approved.

### DB tables (migration 00040)
- `cbi_sessions` — `transcript` jsonb, `ai_rating`/`ai_rationale`/`ai_evidence`, `status` (`draft`/`approved`/`discarded`), `reviewed_rating`, `reviewer_notes`, `approved_at`; FKs to `assessor_assignments`, `engagements`, `candidates`, `competencies`.
- RLS: admin all; assessors (`lead_assessor`/`associate_assessor`) all (scoped further by assignment in app). Writes use the service client; auth is bypassed in dev (prototype surface).

## VIFM Academy (course delivery)

The **deliver** step of the diagnose → recommend → deliver → certify loop (Courses recommends, Academy delivers, Credentials certifies). It turns a VIFM course into a self-paced learning experience for a candidate, with a per-lesson AI knowledge-check, course completion, and an automatic completion credential. It **reuses the G3 quiz engine verbatim** (`quiz-generator` + `QuizInterface`); a "lesson" maps to one outline section of the course.

### Route namespace
- Candidate UI: `/candidate/academy` (My Learning list), `/candidate/academy/[enrollmentId]` (course page — lesson list + Complete Course), `/candidate/academy/[enrollmentId]/lesson/[lessonKey]` (knowledge-check). Components: `enroll-button`, `complete-course-button`, `start-check-button`, `lesson-knowledge-check`.
- API: `/api/academy/enroll` (idempotent on candidate×course), `/api/academy/lesson/start` (resolves the outline section → `generateQuizQuestions` ~5 grounded Qs → inserts an attempt; idempotent on enrollment×lesson; deterministic fallback without an AI key), `/api/academy/lesson/[attemptId]/save`, `/api/academy/lesson/[attemptId]/complete`, `/api/academy/complete` (course-level).

### Key files
- `src/lib/academy/complete.ts` — `markEnrollmentComplete()` (idempotent completion + `academy_completion` credential issue; never double-issues, keyed on `source_id = enrollment id`).
- `src/lib/academy/lesson-key.ts` — `lessonKeyFor` / `indexFromLessonKey` (outline section ↔ lesson key).

### Pass-gate (Tier 1 — makes the completion certificate sellable)
A course only completes + certifies when the learner **passed** every lesson's knowledge-check (best `score_pct >= passing_score_pct`, default 70), not merely attempted it. `markEnrollmentComplete` counts lessons from the course outline (empty outline → 1 "Overview"), computes distinct *passed* lessons + their best-score average, and gates: below the bar it returns `reason: "not_passed"` (the route maps that to HTTP 400 with `passedLessons`/`totalLessons`) and does **not** mark complete or issue. The credential now carries the average score, which renders as `Score: N%` on the branded certificate. The same passed-not-attempted rule is enforced in lock-step at three sites so a "course complete" claim can never appear without a credential behind it: the course page's Complete button, `/api/academy/complete`, and the per-lesson `/api/academy/lesson/[attemptId]/complete` "finish course" path.

### DB tables (migration 00049)
- `vifm_enrollments` — one row per (candidate, course); `source` (`self`/`admin_assigned`/`recommender`), `status` (`enrolled`/`in_progress`/`completed`/`withdrawn`), `visible_at` (hides admin-assigned until ready). Unique (candidate_id, course_id).
- `academy_lesson_attempts` — mirrors `candidate_quiz_attempts` (reuses the `candidate_quiz_status` enum); `questions`/`answers` jsonb, `score_pct`, `passing_score_pct` default 70. Unique (enrollment_id, lesson_key).
- RLS: admin all; candidate owns rows (`candidate_id → candidates.profile_id = auth.uid()`); clients SELECT their org's enrollments. Writes via service-role API routes (dev trusts `candidateId` from the body; under auth=on gate via `profile_id`). All paths are best-effort/tolerant if 00049 isn't applied.

## VIFM Credentials + Verify (certification)

The **certify** step. A verifiable credential is issued for any certified outcome and is publicly checkable by an unguessable `verification_code`. Four credential types: `academy_completion` (3-year default validity), `ac_ready_now` (1 year), `fluent_cefr` (1 year), `technical_proficiency` (1 year — see Technical Certification below); each is renewable by issuing a fresh row. The `vifm_credentials.credential_type` CHECK is the DB-level whitelist of these four (widened in 00053 to admit `technical_proficiency`) — adding a fifth type means a migration to re-create that constraint, or issuance is silently rejected.

### Issuance (all best-effort — never throws, so it can't block the primary operation; an admin can re-issue)
- `src/lib/credentials/issue.ts` — shared `issueCredential()` + `getCredentialForVerification()` (the public reader; returns non-sensitive fields only, validates UUID shape).
- `src/lib/credentials/ac-ready-now.ts` — `issueReadyNowForEngagement()`, called from `src/app/admin/engagements/[id]/actions.ts` when an engagement is marked **completed**; issues one credential per candidate whose finalised OAR recommendation is `ready_now`. Idempotent via `source_id = overall_assessment_ratings.id`; no auto-revoke on a later downgrade (an admin revokes manually).
- Academy completion → from `src/lib/academy/complete.ts`; Fluent CEFR → from the Fluent score route.

### Verification + delivery surfaces
- Public: `/verify/[code]` page (bilingual; a revoked/expired credential still resolves but renders as not-currently-valid) and `/api/credentials/verify/[code]` (returns `{verified, revoked, expired, credential}`). Both read **only** through the service-role reader — there is no public table SELECT policy.
- Candidate wallet: `/candidate/credentials/[candidateId]`. Credential PDF: `/api/credentials/[credentialId]/pdf`.

### DB table (migration 00049)
- `vifm_credentials` — `verification_code` (uuid, unique, the public lookup key), `candidate_id` (nullable — anonymous Fluent), denormalized `issued_to_name`/`issued_to_email`, `credential_type`, bilingual `title_*`/`subtitle_*`, `issuer` (default "Virginia Institute of Finance and Management"), `score_pct`, `source_id` (untyped, app-checked), `issued_at`/`expires_at`/`revoked_at`/`revocation_reason`.
- RLS: admin all; candidate SELECT own rows; public verification via the service-role API only. Middleware bypasses `/verify`, `/verify/`, and `/api/credentials/verify/`.

## VIFM Technical Certification (the third capability pillar)

Measures **technical** proficiency per finance domain — the third pillar alongside the AC behavioural 38 and Fluent's language skills. The taxonomy is a fixed, code-only 2-level framework (Domain → Skill) in [src/lib/competencies/technical-framework.ts](src/lib/competencies/technical-framework.ts): 10 domains (finance / investment / treasury / accounting / banking / analytics / business_intelligence / artificial_intelligence / business_reporting / real_estate — Tax excluded; leadership/strategy/PM stay behavioural), 5 skills each, with `proficiencyFromPercent()` → indicative 1–5 band (Awareness/Foundational/Working/Proficient/Expert). Runner at `/ac/tech-assessment`; API `/api/ac/tech-assessment` (`{action:"start"|"score"}`). Integrity mirrors Fluent: the full test (with answer key) is held server-side in `tech_assessment_sessions`, the browser gets a key-stripped copy, grading is server-side, option positions are re-randomised per administration (defeats LLM option-A bias + position memorisation), and sessions are **single-use** (a consumed session can't be re-scored → no credential replay).

### Two modes — the honest line between indicative and certified
- **INDICATIVE** — live AI-authored items, no human review. Renders the 1–5 band but issues **no credential**. The honest fallback when a domain's approved bank is too thin to certify (or no `ANTHROPIC_API_KEY`).
- **CERTIFIED (Tier 2)** — the test is assembled **entirely from SME-approved bank items**; when the score clears the domain's documented cut-score, a `technical_proficiency` credential is issued and is publicly verifiable. This is the defensible, sellable path. `TechTest.certified` threads through scoring → the result row's `certified`/`passed_cut`/`cut_pct`/`credential_code` columns → the result UI (credential panel vs "below the cut-score" panel).

### Item bank + cut-scores (migration 00053; [src/lib/competencies/technical-item-bank.ts](src/lib/competencies/technical-item-bank.ts))
- `tech_assessment_items` — AI-**drafted** (`status='draft'`) then human-**approved** review workflow (`draft`/`in_review`/`approved`/`rejected`/`retired`), bilingual EN+AR, with a rationale + light psychometrics (`times_administered`/`times_correct` p-value substrate — **no IRT calibration yet**). `buildCertifiedTest()` assembles only from `approved` items, returning null (→ indicative) below the cut-score's `min_items` floor.
- `tech_assessment_cut_scores` — one row per domain: `pass_pct` (default 70), `min_items` floor (default 8), plus `method`/`rationale` for the audit file. `getCutScore()` falls back to defaults when unset.
- **SME review console** at `/admin/tech-assessment/items`: bank-readiness grid (per-domain approved-count vs min → "Certifiable"/"Indicative"), AI-draft-into-bank, per-item approve/reject/retire/edit, cut-score editor. Server actions in `actions.ts` (all `requireRole(["admin"])`).
- **Technical Assessment Command** dashboard at `/admin/tech-assessment` ([page.tsx](src/app/admin/tech-assessment/page.tsx)): mirrors the AC's command cycle (reusing `ProcessMap`) but the stages are the *certification pipeline* — Item bank → SME review → Cut-scores → Certifiable → Assessed → Credentials — with a readiness hub %, plus a per-domain readiness+throughput table. Powered by `getTechPipelineStats()`. The sidebar "Technical Assessment" group is a parallel to "Assessment Center": Overview (this dashboard) · Take assessment (`/ac/tech-assessment` runner) · Item review (`/admin/tech-assessment/items` console).
- All paths best-effort/tolerant of 00053 not being applied (certified path stays dark; indicative results still persist via a legacy-column insert fallback). **Honest limits:** AI-drafted but human-approved items; light psychometrics only (no IRT); secure delivery, not invigilation.

### Taxonomy in the DB + the technical→behavioural bridge (migration 00054)
Two structural upgrades to the third pillar:
- **Taxonomy promoted to tables** — `technical_domains` (key PK, bilingual) + `technical_skills` (per-domain) now exist in the DB, seeded to mirror the code framework, and the `tech_assessment_*` tables' `domain_key` is now a real FK to `technical_domains(key)` (added `NOT VALID` so the migration can't fail on legacy rows). The code framework ([technical-framework.ts](src/lib/competencies/technical-framework.ts)) **stays** as the typed/synchronous source for the assessment engine + SME console; the tables own FK integrity + admin-editability (single seed, no drift at install).
- **technical→behavioural bridge** — `technical_domain_competencies` (domain_key FK → technical_domains, competency_id FK → competencies, `relation` default 'enables', `weight` 1–3) declares which of the behavioural 38 each technical domain *enables*, seeded by competency name (e.g. Finance → Financial Acumen/Analytical Reasoning/Decision Quality; AI → Digital Fluency/Cultivates Innovation/Manages Complexity). [unified-profile.ts](src/lib/competencies/unified-profile.ts) reads it and, for a **measured** domain (assessment level, not Academy evidence), adds an "enables" `CompetencySignal` (`source:"technical"`, `kind:"technical"`, indigo tone) onto each mapped competency — so a technical result surfaces as an indigo `↳ Finance · 4/5` chip on those competencies on the candidate skills page, exactly like Fluent's language→behavioural enablers. Tolerant of 00054 not being applied.
- **Layered measurement model (migration 00064)** — the single-purpose technical bridge is generalised into one typed link table `construct_competency_links(source_kind, source_key, competency_id, relation ∈ {manifests, enables, predicts}, layer ∈ {foundations, attainments, competencies}, weight, validated, rationale)`, seeded from `technical_domain_competencies`. This is the "golden thread": the behavioural 38 are the **spine**; every other instrument relates to it through a typed relationship of rising evidence strength — *predicts* (foundations: cognitive ability, personality) < *enables* (attainments: technical, language) < *manifests* (the AC/CBI/360 score itself). `unified-profile.ts` now carries `CompetencyRelation`/`CompetencyLayer` + a `relationMeta()` renderer (the `predicts` chip is flagged "predicted, not measured"), and reads `construct_competency_links` for the technical path (falling back to `technical_domain_competencies` when 00064 isn't applied). Cognitive/personality (the **VIFM Psychometrics** module, below) register here as `predicts`/`foundations` links via migration 00066. Rationale + the HiPo/Succession payoff: [docs/psychometrics-proposal.md](docs/psychometrics-proposal.md).
- **Admin editor** — the `/admin/tech-assessment/items` console (per selected domain) carries a "Behavioural bridge" card ([bridge-editor.tsx](src/app/admin/tech-assessment/_components/bridge-editor.tsx)): add/remove competency mappings, set each weight (1 Supporting / 2 Strong / 3 Primary), and edit the domain display names (the FK `key` is immutable). Server actions in [actions.ts](src/app/admin/tech-assessment/actions.ts) (`addBridgeAction` upserts on `domain_key,competency_id`; `setBridgeWeightAction`; `removeBridgeAction`; `updateDomainMetaAction`), all `requireRole(["admin"])`.

## VIFM Psychometrics (the Foundations layer — cognitive ability + personality)

The **Foundations layer** of the layered measurement model (the bottom of the spine the layered-model note above describes): cognitive ability + Big-Five personality **PREDICT** the behavioural 38 — the honest answer to "where does psychometric testing fit, and how do we cover High-Potential / Succession?". It is the propensity tier (weakest evidence; validate before high-stakes use), distinct from *enables* (technical/language attainments) and *manifests* (the AC/CBI/360 score itself). Tier 1 is **INDICATIVE** — classical scoring, no local norms, no IRT calibration yet, and **issues no credential**. Full rationale + the HiPo/Succession payoff in [docs/psychometrics-proposal.md](docs/psychometrics-proposal.md).

### Two instruments
- **Cognitive ability** — numerical / verbal / abstract reasoning subtests (MCQ) → % correct per subtest → indicative band + a general mental ability (**g**) composite. AI-generated items ([generate.ts](src/lib/psychometrics/generate.ts) `aiCognitive()`) with a 9-item bilingual deterministic deck fallback when `ANTHROPIC_API_KEY` is absent.
- **Big-Five personality (OCEAN)** — the public-domain **Mini-IPIP** (Donnellan, Oswald, Baird & Lucas, 2006; 20 items, 4/factor, bilingual EN/AR), 1–5 Likert, reverse-keyed → trait mean → band + sten, with lightweight **validity flags** (social-desirability + inconsistency). High Emotional Stability = low neuroticism.

### Security (mirrors Fluent/Technical exactly)
The full keyed test is held server-side in `psy_sessions` (single-use — `consumed` on score, ~3h TTL); the browser gets an answer-key-stripped copy (`stripAnswerKey`); grading is server-side (`computePsyResult`); `psy_results` is **admin-SELECT only**; every write goes through the service-role API route. `psy_sessions`/`psy_item_responses` carry **no RLS policy at all** (service-role only).

### Route namespace + key files
- Runner: `/ac/psychometrics` (optional `?candidateId=&engagementId=` to bind an admin-run test to a candidate record). Sidebar link "Psychometrics" (`adminNav.psychometrics`, BrainCircuit icon). Reachable from Guided Start (goal "certify" → context "ability").
- API: `/api/ac/psychometrics` — `{action:"start", kind:"cognitive"|"personality", lang}` inserts a session + returns the stripped test; `{action:"score", session_id, answers}` reloads the session, grades, writes `psy_results` + `psy_item_responses`, marks consumed. Tolerant: returns a helpful "apply migration 00065" error when the tables are absent.
- Lib: [src/lib/psychometrics/framework.ts](src/lib/psychometrics/framework.ts) (subtests + Big-Five + Mini-IPIP + bands; each scale declares the competencies it predicts), [scoring.ts](src/lib/psychometrics/scoring.ts) (pure `computePsyResult`), [generate.ts](src/lib/psychometrics/generate.ts) (AI cognitive + IPIP assembly + key-strip).

### The Foundations→competency bridge (migration 00066)
Each subtest, the **g** composite, and each Big-Five trait registers `predicts`/`foundations` rows in `construct_competency_links` (00064), resolved by competency **name** (non-matches skipped). `unified-profile.ts` reads the candidate's latest `psy_results` (one per kind), maps each scale (+ g) to a normalized value, and folds those links into per-competency signals — surfacing on the candidate skills page as a fuchsia (cognitive) / cyan (personality) `⤳ <scale> · <band>` chip carrying the "predicted, not measured" caveat (via `relationMeta`). Best-effort + tolerant: a missing `psy_results` / `construct_competency_links` yields no signal.

### DB tables (migration 00065) + links (00066)
- `psy_instruments` / `psy_scales` / `psy_items` — admin-managed bank metadata (the forward home for a future SME-reviewed, IRT-calibrated Tier-2 bank; Tier 1 generates from code, so the runner does not depend on seeded items). `psy_sessions` (keyed, single-use), `psy_results` (one row per completed test; `scales`/`overall`/`validity`/`result` jsonb), `psy_item_responses` (calibration substrate). **Honest limits:** indicative bands (no local norms), no IRT, no credential.

### Tier 2 — calibration substrate (migration 00067)
The engine that promotes the SAME instrument from INDICATIVE (Tier 1) to CALIBRATED (Tier 2: norm-referenced) once pilot/norm data exists — with a clean Tier-1 fallback (no norms ⇒ unchanged). Built; the *science* (a norm sample + a psychometrician's validity/fairness sign-off) is the remaining non-code work.
- **Schema (00067):** `psy_norms` (per `kind`×`scale_key`: `n`/`mean`/`sd`/`source` — the norm-group raw→standardized conversion; admin RLS) + `psy_items.irt_difficulty`/`irt_discrimination`/`calibrated_at` (Rasch/2PL params, estimated later from `psy_item_responses`; null until calibrated).
- **Math ([src/lib/psychometrics/calibration.ts](src/lib/psychometrics/calibration.ts), pure + unit-checked):** `standardize(raw, norm)` → z / percentile (normal CDF) / norm-referenced sten; `cronbachAlpha(matrix)` → internal-consistency reliability; `instrumentTier({approvedPerScale, minAlpha, normN})` → the honest gate (thresholds `PSY_TIER`: ≥8 approved items/scale, α ≥ .70, norm n ≥ 200); `applyNorms(result, norms)` enriches each scale with z/percentile/sten + sets `result.tier`.
- **Wiring:** the `score` route loads `psy_norms` for the kind and `applyNorms`-enriches before persisting/returning (tolerant — missing table/rows ⇒ stays indicative). `ScaleScore` gained optional `z`/`percentile`, `PsyResult` gained `tier`. The runner result shows a **Tier 1 · Indicative / Tier 2 · Norm-referenced** badge, per-scale percentiles, and a tier-appropriate disclaimer.
- **SME item-bank console (built) — `/admin/psychometrics`** ([page.tsx](src/app/admin/psychometrics/page.tsx) + [_components/bank-console.tsx](src/app/admin/psychometrics/_components/bank-console.tsx) + [actions.ts](src/app/admin/psychometrics/actions.ts), all `requireRole(["admin"])`). The workflow that fills the bank: per instrument → per scale it shows the **three-gate readiness** (≥8 approved · α ≥ .70 · norm n ≥ 200) with a live Tier-1/Tier-2 badge, **AI-drafts** a batch of bilingual items for one scale ([item-drafter.ts](src/lib/psychometrics/item-drafter.ts) → status `draft`), and runs the review lifecycle (approve / retire / restore / edit / delete) + manual authoring. Sidebar link `adminNav.psychometricsBank` under the Talent-Acquisition pillar. Self-bootstraps `psy_instruments`/`psy_scales` on first write (`resolveScaleId`) — no structure-only migration needed; tolerant of 00065/00067 not being applied.
  - **Readiness math ([bank.ts](src/lib/psychometrics/bank.ts)):** `loadPsyBank()` reads the bank + `psy_item_responses` (Cronbach's α computed **per scale from approved-bank items only** — mcq scored 0/1 from `correct`, likert reverse-keyed) + `psy_norms` (norm n) → `instrumentTier()` gate per scale; an instrument is "calibrated" only when **every** scale clears all three gates.
  - **Bank-driven assembly ([bank.ts](src/lib/psychometrics/bank.ts) `assembleFromBank` → [generate.ts](src/lib/psychometrics/generate.ts)):** `generatePsyTest` now prefers APPROVED bank items when every scale has ≥`ASSEMBLE_MIN` (4) — item ids are the real `psy_items` uuids, so the response log is calibratable — otherwise falls through to the Tier-1 source (Mini-IPIP / AI / static deck). Verified end-to-end: empty bank ⇒ runner start returns the Tier-1 deck with answer keys stripped (security preserved).
  - **Pilot norm-loader ([norms.ts](src/lib/psychometrics/norms.ts), "Norm group" panel on the console):** `computePilotNorms(kind)` reads the distribution of collected `psy_results` and upserts per-scale `{n, mean, sd}` (+ `g` for cognitive) into `psy_norms` as provisional `source='pilot'`; `clearNorms(kind)` reverts. The honest activation rule lives in `applyNorms`: a scale's norm is **ignored until n ≥ `PSY_TIER.minNormN` (200)**, so pilot norms accumulate without leaking premature percentiles to takers — a result is `calibrated` only when every scale (and g) is adequately normed. The score route now returns the **norm-enriched** result (bugfix — it previously persisted the enriched result but returned the un-normed one, so the runner never reflected calibration). Validated norms still need a representative sample + psychometrician sign-off (the non-code science).
  - **IPIP-50 longer validated form ([ipip50.ts](src/lib/psychometrics/ipip50.ts) + "Seed IPIP-50" banner on the console):** the public-domain IPIP Big-Five Factor Markers (Goldberg 1992; 10 items × 5 traits, bilingual, keyed to our scales with S = Emotional Stability = reverse-scored Neuroticism). `seedIpip50IntoBankAction` (idempotent) upserts all 50 as **approved** `psy_items` — clearing the ≥8/scale content gate for personality in one click; bank-driven assembly then serves the 50-item form (8/trait cap → 40-item test) and the response log makes each item calibratable. Arabic is best-effort MSA pending human review (project convention).
  - **Professional report PDF ([psychometric-report.tsx](src/lib/reports/psychometric-report.tsx) + route `/api/ac/psychometrics/[resultId]/report`):** React-PDF (EN), result-id-gated via the service client (mirrors the Fluent certificate). Per scale: raw band always; when the stored result is `calibrated`, a percentile + a 1–10 **sten band** + a percentile bar. Personality adds a **validity statement** (social-desirability / inconsistency / flag); cognitive adds the **g** composite. Every page states the tier and the "predicts, not measures / scores not a credential" framing. "Download report (PDF)" button on the runner results (captures `result_id`). Verified end-to-end through the live route: indicative result → 10.6 KB PDF; calibrated (transient n=250 norms) → 15.5 KB PDF with sten/percentile (raw at norm mean → 50th pct, sten 6); all test rows + norms deleted after.
- **Still to build for full Tier 2:** (engineering complete) — an even longer / adaptive form (IPIP-120 or IRT-CAT) is optional future work. **Non-code (the remaining science):** accumulate the norm sample, run the criterion-validity study (flips `construct_competency_links.validated` on the predicts rows) + DIF/fairness, and a psychometrician sign-off + technical manual. Psychometrics yields **scores + a defensible report, not a pass/fail credential.**

## VIFM Pre-Hire (commercial pre-employment screening)

A purely **additive** module that lets VIFM sell the Assessment Center + Fluent as a pre-employment **screening service to client organizations** (shortlisting professionals at all levels). It is an orchestration layer over the existing instruments — it never duplicates them; each stage soft-links to the instrument's own record. The existing four portals (Admin/Assessor/Candidate/Client) keep working exactly as before; nothing in their behaviour was modified.

### Positioning + the core guardrail
The composite is a **screening signal, never an auto-reject.** A human always makes the hiring decision — the scoring code deliberately has no "reject" path; a failed *required* stage only caps the advisory band at "review"/"hold". This is the linchpin of the module's defensibility.

### Non-breaking integration (mirrors ARA/Reflect/Fluent)
- Own `prehire_*` tables; own `/prehire/*` + `/api/prehire/*` namespace; own `/admin/prehire/*` recruiter UI.
- Middleware auth-bypasses the candidate flow: `pathname.startsWith("/prehire/apply/") || pathname.startsWith("/api/prehire/")` (token-based, no account). **Because that bypass is a broad prefix match, any non-token route must NOT live under `/api/prehire/`** — the ATS export is therefore at `/api/admin/prehire/[id]/export` (admin-gated) so it can't leak PII.

### Roles + access model
- **admin** (VIFM) — full access; runs requisitions, invites, records the human decision, exports, views the fairness/audit hub.
- **client** — SELECT only, scoped to their own organization (RLS).
- **candidate** — no account; reaches their flow via `prehire_candidates.access_token`, validated server-side by service-role routes only (`findCandidateByToken`, TOKEN_RE = `/^[0-9a-fA-F-]{36}$/`).

### Recruiter surface (`/admin/prehire`)
- List + 1-step requisition wizard (`createRequisitionAction`): pick client org, title, role profile, and an ordered **stage plan** (`[{kind, weight, cut_score, required}]`). Default plan: quiz 0.4 (cut 60) / fluent 0.3 (cut 50) / cbi 0.3 (cut 60).
- Detail page (`/admin/prehire/[id]`): ranked shortlist (per-stage normalized scores + composite + AI signal), Add Candidate (with optional Employee ID; does NOT auto-email — the admin invites per-row or "Invite all uninvited"), per-row **Invite link / Email** resend, per-candidate **screening report** (PDF download), **email-report-to-client** (`ClientReportCell` per row + `ClientReportControls` header: set the client recipient once, then "Send to client" / "Send all reports"; shows "Sent <date>"), and JSON/CSV **ATS export**. (VIFM is the assessor, not the decider: there is NO in-app hiring decision or handoff workflow — VIFM just delivers the report and the client decides.)
- Fairness & audit hub (`/admin/prehire/[id]/fairness`): guardrail statement, adverse-impact (4/5ths) tables per demographic dimension, and the immutable audit trail.

### Candidate flow (`/prehire/apply/[token]`, no account)
`ApplyFlow` runs the requisition's interactive stages in configured order: **consent gate → quiz → Fluent (full 4-skill) → CBI → optional voluntary self-ID** (shown on the completion screen, after scoring, so it's visibly decoupled). Each stage component is `{ token, onDone }`; `onDone()` advances. Stages reuse the existing engines verbatim:
- **quiz** — `generateQuizQuestions` (bilingual), answer key stripped from the client payload; normalized = round(100·correct/total).
- **fluent** — full 4-skill placement: reading + listening (Azure TTS audio, or browser-TTS / script fallback) + writing + speaking (browser Web Speech API transcription by default — free, no server; MediaRecorder → server Whisper only as the no-Web-Speech fallback → Claude CEFR scoring, optionally blended with Azure pronunciation). Answer key + listening scripts held server-side in `detail.fullTest`; CEFR → 0–100 (A1→0 … C2→100).
- **cbi** — `nextInterviewerTurn` / `scoreCbiInterview` (`MAX_CANDIDATE_ANSWERS = 4`); BARS 1–5 → 0–100 = round(((bars−1)/4)·100).

### Composite scoring ([src/lib/prehire/scoring.ts](src/lib/prehire/scoring.ts), pure/unit-testable)
`computeComposite(plan, results)` → weighted 0–100 composite (null until every weighted stage is scored) + per-stage pass/fail vs cut-score + advisory recommendation (`advance` / `review` / `hold` / `incomplete`, **never** reject). `rescoreCandidate(candidateId)` recomputes + persists composite/recommendation/status after each stage. `rankByComposite` orders the shortlist.

### Defensibility layer (migration 00051)
- **Report delivery, not a decision** — the in-app hiring decision was removed (VIFM is the assessor, not the decider); a brief handoff-tracker experiment (00062) was also removed. The real action is **delivering the report to the client**: `setRequisitionClientEmailAction` stores the client recipient on the requisition; `sendReportToClientAction` / `sendAllReportsToClientAction` (admin-gated, migration 00063) email the per-candidate PDF (built by the shared `buildPrehireCandidatePdf`, attached via the `prehire_client_report` template) and stamp `report_sent_at`/`report_sent_to`. The client always makes the actual hiring call from the report. (The legacy `decision` columns from 00051 remain in the DB but are unused.)
- **Immutable audit trail** — `prehire_audit_log` (append-only; UPDATE trigger raises). `logPrehireEvent` ([src/lib/prehire/audit.ts](src/lib/prehire/audit.ts)) is best-effort + tolerant, wired into 9 events: requisition_created, candidate_added, invitation_sent, consent_given, stage_completed, demographics_submitted, report_shared, decision_recorded (legacy), export_taken. Detail never contains demographic values or the recipient address (the trail is client-readable).
- **Adverse-impact (4/5ths rule)** — `computeAdverseImpact` ([src/lib/prehire/adverse-impact.ts](src/lib/prehire/adverse-impact.ts)): per-dimension selection rates (gender / age band / national-vs-expatriate), reference = highest-selected group, flags any group below 0.8 of it. Auto-picks the human-decision basis, falls back to the AI signal; small-sample/underpowered caveats; demographics never imputed. Monitoring signal only — a flag warrants reviewing job-relatedness, not an automatic change.
- **Voluntary demographics** — self-ID is optional, GCC-appropriate, decoupled from scoring, `prefer_not_to_say` first-class. Individual demographics never appear in the audit log, the ATS export, or any client surface — only the admin-only aggregate 4/5ths view.

### Invitation email + client report + ATS export
- `prehire_invitation` template in [src/lib/integrations/email.ts](src/lib/integrations/email.ts) (Microsoft Graph; console-mock when unconfigured). NOT auto-sent on add (the admin invites explicitly — per-row "Email" or "Invite all uninvited"; `invited_at` stays null until sent). `addCandidateAction` returns `emailed: false`; the per-row + bulk invite actions do the send.
- `prehire_client_report` template (same email module, now supports PDF **attachments** via `EmailAttachment`): emails the candidate's screening report straight to the client recipient (no public/token route — the PDF goes to the inbox, keeping PII out of any URL).
- Export at `/api/admin/prehire/[id]/export?format=json|csv` — admin-gated (`requireRole(["admin"])`) + service client; recomputes the composite (not a stale column); CSV carries a UTF-8 BOM for Excel/Arabic. JSON is self-describing (`vifm-prehire-export@v1`). No demographics in the export.

### DB tables
- **00050** — `prehire_requisitions` (stage_config jsonb), `prehire_candidates` (access_token, composite_score, recommendation, consent_at), `prehire_stage_results` (one row per stage; `source_id` soft-links the instrument's native record; `detail`/`flags` jsonb). RLS: admin all; client SELECT own org; candidates have NO table access (service-role routes only).
- **00051** — voluntary demographic columns + (legacy, now-unused) human-decision columns on `prehire_candidates`; `prehire_audit_log` (immutable, admin-all + client-scoped RLS).
- **00061** — `prehire_candidates.custom_fields` jsonb (recruiter metadata, e.g. `{employee_id}`; not scored, not candidate-visible).
- **00062** — (superseded) added handoff_* columns; the handoff tracker was dropped in 00063.
- **00063** — drops the 00062 handoff_* columns; adds `prehire_requisitions.client_recipient_email` + `prehire_candidates.report_sent_at`/`report_sent_to` (deliver-report-to-client).

### Tolerance
Every defensibility path is best-effort and tolerant of 00051 not being applied (audit no-ops, demographics route returns ok, fairness page shows an "apply 00051" hint, the shortlist's decision read is a separate query so a missing column can't empty the table) — mirrors the Fluent/Academy pattern. Verified end-to-end on the live DB (full pipeline + audit rows + demographics/decision persistence + export + adverse-impact on a real cohort + fairness page render).
