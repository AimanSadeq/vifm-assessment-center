# VIFM Assessment Center Digital Portal

## Project Overview
Custom-built Assessment Center management platform for Virginia Institute of Finance and Management (VIFM). The portal operationalizes the VIFM-AC Framework across four user interfaces: Admin, Assessor, Candidate, and Client. Target market: GCC and MENA region (banking, government, corporate).

## Current Status
All 5 development phases are **complete**. The portal is functionally ready with auth disabled for development. To go to production, flip `AUTH_ENABLED = true` in `src/middleware.ts` and follow `src/lib/auth/README.md`.

**New module in progress:** VIFM ARA (AI Readiness Assessment) — see "ARA Module" section below. M1 (schema + consultant role + nav) complete on branch `feature/ara-module`.

## Tech Stack
- **Framework:** Next.js 14 with App Router and TypeScript (strict mode)
- **Styling:** Tailwind CSS with Shadcn/UI component library (New York style)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth:** Supabase Auth with Row-Level Security (RLS) per role — toggle in middleware.ts
- **Real-Time:** Supabase Realtime (live wash-up collaboration)
- **Reporting:** React-PDF for candidate reports (6-page professional format), Recharts for analytics
- **AI:** Anthropic Claude API (observation classifier, report writer, development recommender, bias detector)
- **i18n:** react-i18next with RTL support for Arabic
- **Email:** SendGrid or Resend for transactional emails (6 templates ready)
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
        new/              # Engagement creation wizard (5 steps)
        [id]/             # Engagement detail (candidates, assignments, matrix, reports)
      exercises/          # Exercise library with briefing, timing, role player guides
        [id]/             # Exercise detail editor (4 tabs)
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
      report/[id]/        # Report viewer (gated behind release status)
    client/               # Client portal (top nav, process map)
      engagements/        # Org-scoped engagement list
        [id]/             # Candidate results with OAR and PDF download
      reports/            # Cross-engagement report viewer
      analytics/          # Cohort strengths/development areas
    api/
      reports/[engId]/[candId]/  # PDF generation endpoint
      consent/[candId]/          # Consent submission endpoint
  components/
    ui/                   # 17 Shadcn/UI components
    shared/               # Process map, BackLink, LanguageSwitcher, VifmLogo, EngagementPicker, LogoutButton
  lib/
    supabase/             # Server client, browser client, middleware, service client
    auth/                 # getClientOrgId helper, README migration guide
    ai/                   # AI client, observation assistant, report writer, dev recommender, bias detector
    constants/            # Exercise type labels
    i18n/                 # Config, provider, English + Arabic locale files
    integrations/         # Email (6 templates), Video (Daily.co placeholder)
    reports/              # PDF template (6 pages), data fetcher, report types
    scoring/              # ICC calculation, bias detection
    validations/          # Zod schemas for engagement, assessor, washup
  types/                  # TypeScript types for all database tables
  hooks/                  # Custom React hooks (placeholder)
  utils/                  # General utilities (placeholder)
supabase/
  migrations/
    00001_initial_schema.sql    # 25 tables + RLS policies + enums + triggers
    00002_seed_competencies.sql # 4 domains, 8 clusters, 38 competencies
    00003_seed_behavioral_indicators.sql  # 249 behavioral indicators
    00004_seed_development_tips.sql       # 114 development tips (3 per competency)
    00005_create_engagement_rpc.sql       # Atomic engagement creation function
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

# Optional — enable AI features
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional — enable email notifications
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM_ADDRESS=noreply@vifm.ae

# Optional — enable video conferencing
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
- All new DB tables prefixed `ara_` — no existing table modified
- All new pages under `/ara/*` route namespace
- All new API routes under `/api/ara/*`
- Added `consultant` to the `user_role` enum (existing values unchanged)
- Added single nav link "AI Readiness" to admin sidebar — no other nav changes
- Middleware bypasses auth for `/ara/respond/[token]` routes (token-based access)

### ARA roles
- **admin** — reuses existing role. Manages question bank, regulatory docs, sandbox.
- **consultant** — new role. Owns their own assessments; scoped RLS.
- **respondent** — no account; accesses via `ara_respondents.access_token` validated by service-role API routes.

### ARA tech choices (differ from AC where necessary)
- **PDF reports:** Puppeteer (not React-PDF) — Arabic shaping + landscape bilingual side-by-side layout. Keep React-PDF for candidate reports.
- **Languages:** full bilingual EN + Gulf Arabic with RTL. Translation fields on all content tables (`_en` / `_ar` suffixes).
- **Region-driven content:** UAE clients see UAE frameworks only, Saudi sees Saudi only — never mixed.

### Key ARA database objects
- 8 pillars (strategy, data, technology, talent, culture, governance, operations, model_management)
- Question bank versioning via `ara_question_bank_versions` — one active at a time (partial unique index)
- Regulatory frameworks seeded: 7 UAE + 9 Saudi from handover Section 11
- Helper function `ara_is_assessment_owner(uuid)` for consultant-scoped RLS

### ARA build order (milestones)
- **M1 (done):** Schema, consultant role, nav link
- **M2:** Consultant dashboard + question bank admin + invitation emails
- **M3:** Client respondent form + scoring engine (Levels 1–7)
- **M4:** Regulatory engine + Phase 2 consultant tools
- **M5:** Email automation + 27-page bilingual PDF report
- **M6:** Annual reassessment, data retention, sandbox cleanup

### Critical ARA business rules
- Reports are **never** auto-sent to clients — consultant controls delivery
- No file size limits on supporting material uploads
- Desktop only — no mobile layouts required
- UAE/Saudi framework isolation enforced at query and report layer
