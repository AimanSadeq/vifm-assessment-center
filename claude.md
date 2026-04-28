# VIFM Assessment Center Digital Portal

## Project Overview
Custom-built Assessment Center management platform for Virginia Institute of Finance and Management (VIFM). The portal operationalizes the VIFM-AC Framework across four user interfaces: Admin, Assessor, Candidate, and Client. Target market: GCC and MENA region (banking, government, corporate).

## Current Status
All 5 development phases are **complete**. The portal is functionally ready with auth disabled for development. To go to production, flip `AUTH_ENABLED = true` in `src/middleware.ts` and follow `src/lib/auth/README.md`.

**ARA module status:** VIFM ARA (AI Readiness Assessment) is built out on branch `feature/ara-module`. M1–M5 complete (respondent flow, scoring, distortion, peer benchmarks, year-on-year, bilingual consultant notes, EN/AR/bilingual Puppeteer PDF report, Phase 2 consultant guide, regulatory doc upload with Claude extraction). Three items still open: M2.1 respondent invitation email, M3.3 consultant notification email, M6 annual reassessment + retention scheduler + sandbox cleanup. See "ARA Module" section below for the current deferred-items list.

**AC Skillup-MENA parity status:** Eleven features inspired by the Skillup MENA AC walkthrough are shipped on `master` (P0.1 JD-to-competency extractor, P0.2 role profile library, P0.3 gap-severity badges, Learning Plan PDF, G1 candidate→role-profile binding, G2 learner skill dashboard, G3 self-serve AI quiz flow with MCQ + cognitive items + per-question AI explanations, H1 JD-extractor domain tally card, H2 personal-statistics donut + bar charts on /candidate/skills, H3 in-app notification bell, H4 admin "view as candidate" banner). Remaining open: G4 bulk JD import, G5 bulk user-persona linking, G6 JSON export, G7 retake/re-assessment workflow. Full second-pass analysis (158-frame video sweep) lives in `.tmp/skillup-gap-analysis.md`; see "AC Skillup-MENA Upgrades" section below.

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
        [id]/             # Engagement detail with role-profile-aware candidates table
      exercises/          # Exercise library with briefing, timing, role player guides
        [id]/             # Exercise detail editor (4 tabs)
      role-profiles/      # Reusable competency packs per role (list, new, [id] editor)
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
    client/               # Client portal (top nav, process map)
      engagements/        # Org-scoped engagement list
        [id]/             # Candidate results with OAR and PDF download
      reports/            # Cross-engagement report viewer
      analytics/          # Cohort strengths/development areas
    api/
      reports/[engId]/[candId]/                # Full assessment report PDF
      reports/[engId]/[candId]/learning-plan/  # Personalized 30/60/90 Learning Plan PDF
      consent/[candId]/                        # Consent submission endpoint
  components/
    ui/                   # 17 Shadcn/UI components
    shared/               # Process map, BackLink, LanguageSwitcher, VifmLogo, EngagementPicker, LogoutButton
  lib/
    supabase/             # Server client, browser client, middleware, service client
    auth/                 # getClientOrgId helper, README migration guide
    ai/                   # AI client, observation assistant, report writer, dev recommender, bias detector, JD competency extractor (P0.1), quiz generator (G3)
    notifications/        # Publish + load + mark-read helpers (H3)
    constants/            # Exercise type labels
    i18n/                 # Config, provider, English + Arabic locale files
    integrations/         # Email (6 templates), Video (Daily.co placeholder)
    reports/              # Candidate report PDF (6 pages) + Learning Plan PDF (3 pages), data fetcher, report types
    scoring/              # ICC calculation, bias detection, gap-severity computation (P0.3)
    validations/          # Zod schemas for engagement, assessor, washup
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
- No third-party assessment tool references (no SHL, no competitor names) anywhere in the codebase.
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
- **PDF reports:** Puppeteer + `@sparticuz/chromium` for Vercel — Arabic shaping + landscape bilingual side-by-side layout. Keep React-PDF for AC candidate reports. Endpoint: `/api/ara/reports/[assessmentId]/pdf?language=en|ar|bilingual`.
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
- **M6 (open):** Annual reassessment workflow, scheduled retention purge, sandbox cleanup

### ARA deferred items (from earlier milestones)
Track here - pick up as scope allows. Do NOT delete without user confirmation. Items in this list are confirmed un-shipped; items previously listed and now shipped have been removed.
- **M2.1 - Respondent invitation email send:** `ara_respondents.access_token` is generated and the link is previewable in the consultant dashboard, but no email is actually sent. Needs a server action that hits the existing Microsoft Graph wrapper (`src/lib/integrations/email.ts`) with a bilingual welcome template, respects `is_sandbox` → SANDBOX_EMAIL_REDIRECT env var, and writes to `ara_email_log`.
- **M3.3 - Consultant notification email** on respondent completion / all-complete. Hook into `markAraRespondentComplete` and write to `ara_email_log`.
- **AUTH_ENABLED flip:** still `false` in `src/middleware.ts`. Production switch on requires real Supabase Auth wiring per `src/lib/auth/README.md`.

### Critical ARA business rules
- Reports are **never** auto-sent to clients - consultant controls delivery
- No file size limits on supporting material uploads
- Desktop only - no mobile layouts required
- UAE/Saudi framework isolation enforced at query and report layer

## AC Skillup-MENA Upgrades

A separate workstream alongside ARA, started after a competitor walkthrough of skillupone.com revealed several capabilities worth porting to the VIFM AC. Reconstructed gap analysis lives in `.tmp/skillup-gap-analysis.md` (the analysis file is not checked in but the conclusions are). Items are tagged P0.x / Gn for traceability.

### Shipped (first pass — P0.x and G1 / G2)
- **P0.1 - JD-to-competency extractor** ([src/lib/ai/jd-competency-extractor.ts](src/lib/ai/jd-competency-extractor.ts) + [jd-extractor.tsx](src/app/admin/engagements/new/_components/jd-extractor.tsx)): paste/upload JD (Arabic or English, text or PDF) → Claude returns the most relevant 6–10 VIFM competencies with weight, priority, and reasoning. Surfaces in engagement wizard step 2.
- **P0.2 - Role profile library** (`/admin/role-profiles/`, migrations 00014 + 00015): reusable competency packs per role with admin-scoped RLS and an authenticated read policy that respects org isolation. Six GCC banking + government profiles seeded.
- **P0.3 - Gap-severity badges** ([src/components/shared/gap-badge.tsx](src/components/shared/gap-badge.tsx) + [src/lib/scoring/competency-gap.ts](src/lib/scoring/competency-gap.ts)): "Significant Gap (N levels)" / "On Target" / "Strength" chips with a six-tier tone palette. Server-renderable; mirrored as `GapPill` in PDFs. Applied across client engagement results, score matrix, candidate report Summary, and per-competency cards.
- **Personalized Learning Plan PDF** ([src/lib/reports/learning-plan.tsx](src/lib/reports/learning-plan.tsx)): 3-page React-PDF — Cover, 30/60/90 Day Roadmap, per-competency action cards (uses GapPill), reflection prompts. Endpoint: `/api/reports/[engId]/[candId]/learning-plan` with the same auth + OAR-finalised gate as the main report. Surfaced as a secondary download on the candidate report and client engagement results pages.
- **G1 - Candidate ↔ role-profile binding** (migration 00016): nullable `candidates.role_profile_id` FK. Engagement detail's candidates table has a per-row Role Profile dropdown; the Add Candidate dialog has the same picker. Permissive UUID-shape regex on the validator so seeded synthetic UUIDs pass Zod.
- **G2 - Learner skill dashboard** (`/candidate/skills/[candidateId]/`): 4 stat cards (Total / Assessed / Skills with Gaps / Average Score) + per-skill cards grouped by VIFM domain (THINKING / RESULTS / PEOPLE / SELF). Shows target, current BARS score from `consensus_ratings`, and a `<GapBadge>`. Empty-state placeholder when no profile is bound (mirrors Skillup's "No Position Assigned"). Linked from the post-consent welcome page.

### Shipped (second pass — H1–H4 + G3)
- **H1 - JD-extractor domain tally card** ([jd-extractor.tsx](src/app/admin/engagements/new/_components/jd-extractor.tsx) `<DomainTallyCard />`): four colored chips (THINKING blue / RESULTS green / PEOPLE orange / SELF violet) with per-domain counts and a "{total} total · {N} unclassified" footer above the recommendations list. Helps admins sanity-check that the AI didn't return an unbalanced profile.
- **H2 - Personal-statistics charts** ([personal-statistics.tsx](src/app/candidate/skills/[candidateId]/_components/personal-statistics.tsx)): three Recharts on the candidate skills page — Assessment Progress donut (Assessed vs Not Assessed), Skills by Domain donut (4-segment), Average Score by Domain bar chart (0–5). Domain colors match the H1 palette so admins and candidates see the same colour for the same VIFM domain everywhere.
- **G3 - Self-serve AI quiz flow** (migration 00017, [src/lib/ai/quiz-generator.ts](src/lib/ai/quiz-generator.ts), `/candidate/quiz/[attemptId]/`, `/candidate/quiz/[attemptId]/results/`): launched per-competency from the G2 skill cards. AI generates 7 questions mixing 4 multiple-choice + 2 true/false + 1 cognitive pattern-recognition. Mixed difficulty (Easy/Medium/Hard pills), 5-minute timer, "End Session" graceful exit. Results page shows score circle + 3 stat cards + per-question review with **AI-generated explanations in a Lightbulb tip box** — the highest-value learning moment from the Skillup walkthrough. Questions + answers stored as JSONB on `candidate_quiz_attempts` so the deck is reproducible.
- **H3 - In-app notification bell** (migration 00018, [src/lib/notifications/publish.ts](src/lib/notifications/publish.ts), [notification-bell-client.tsx](src/components/shared/notification-bell-client.tsx)): bell with rose unread badge in admin + candidate headers. Popover lists the 20 newest items with title / body / relative time. Click marks read (optimistic, RLS-protected), "Mark all read" CTA when unread > 0. Publishers wired in: candidate notified on role-profile binding, all admins notified on quiz completion. Tolerant of the table not existing yet (renders disabled).
- **H4 - Admin "view as candidate" banner** ([impersonation-banner.tsx](src/components/shared/impersonation-banner.tsx)): amber strip at the top of any /candidate/* page when `?asAdmin=1` is in the URL, showing candidate name + email + "Exit view" CTA back to the source engagement. Per-row Eye icon on the engagement detail's candidates table opens the candidate portal in a new tab with the query pre-applied.

### Open (not yet shipped)
- **G4 - Bulk JD import:** folder upload → batch extract → bulk-create role profiles. ~1 day.
- **G5 - Bulk user-to-persona linking:** CSV (email,role_profile_id) → server action upsert. ~½ day; depends on user accounts existing as durable entities (today candidates are per-engagement).
- **G6 - JSON export of role profile / skill mapping:** Download button on role-profile detail. ~1h.
- **G7 - Retake / re-assessment requests:** New request workflow + admin queue. Pairs with the existing ARA reassessment design.

### Skipped intentionally
- **Cert Builder** (no certificate concept yet — defer)
- **Color Control / Sidebar customization** (conflicts with VIFM brand kit per "Brand Kit" section)
- **Index card show/hide** (admin UX nice-to-have, low ROI)
