# VIFM Assessment Center Digital Portal

## Project Overview
Custom-built Assessment Center management platform for Virginia Institute of Finance and Management (VIFM). The portal operationalizes the VIFM-AC Framework Blueprint across four user interfaces: Admin, Assessor, Candidate, and Client. Target market: GCC and MENA region (banking, government, corporate).

## Tech Stack
- **Framework:** Next.js 14 with App Router and TypeScript (strict mode)
- **Styling:** Tailwind CSS with Shadcn/UI component library
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
- **Auth:** Supabase Auth with Row-Level Security (RLS) per role
- **File Storage:** Supabase Storage (exercise materials, reports, video recordings)
- **Real-Time:** Supabase Realtime (live wash-up collaboration, notifications)
- **Reporting:** React-PDF for candidate reports, Recharts for analytics charts
- **Video:** Daily.co SDK for embedded virtual assessment center sessions
- **i18n:** react-i18next with RTL support for Arabic
- **Email:** SendGrid or Resend for transactional emails
- **Deployment:** Vercel (frontend) + Supabase Cloud (backend)

## Project Structure
```
src/
  app/
    (auth)/           # Login, register, password reset, magic link
    admin/            # Admin portal (sidebar nav, org selector)
      dashboard/
      clients/
      engagements/
      exercises/
      assessors/
      analytics/
      settings/
    assessor/         # Assessor portal (top nav, exercise tabs)
      assignments/
      observation/
      integration/
      washup/
    candidate/        # Candidate portal (minimal nav, progress stepper)
      welcome/
      consent/
      assessments/
      report/
    client/           # Client portal (dashboard nav, report viewer)
      dashboard/
      engagements/
      reports/
      analytics/
  components/
    ui/               # Shadcn/UI components
    shared/           # Cross-portal shared components
    admin/
    assessor/
    candidate/
    client/
  lib/
    supabase/         # Supabase client, types, helpers
    auth/             # Auth utilities, middleware, role guards
    competencies/     # Competency framework data and helpers
    exercises/        # Exercise types, templates, matrix logic
    scoring/          # BARS rating logic, ICC calculation, bias detection
    reports/          # PDF generation, report templates
    integrations/     # SHL API, video, email, HRIS connectors
    i18n/             # Translation files and RTL utilities
    compliance/       # Consent, data retention, audit logging
  types/              # TypeScript type definitions
  hooks/              # Custom React hooks
  utils/              # General utility functions
```

## Four User Roles (with RLS policies)
1. **admin** - VIFM staff. Full access to all modules. Can create engagements, manage clients, assign assessors.
2. **lead_assessor** / **associate_assessor** - External or internal assessors. See only their assigned candidates and engagements. Can record observations and ratings.
3. **candidate** - Assessment participants. See only their own data, consent forms, test links, and reports.
4. **client** - Sponsoring organizations. See only their own engagements and candidate reports once released.

## Key Domain Concepts
- **Engagement:** A single assessment center project for a client (e.g., "ADNOC Senior Manager AC - April 2026")
- **Competency:** A measurable behavioral dimension (e.g., Strategic Thinking, Decision Quality). VIFM framework has 4 domains, 8 clusters, 33 competencies with positive/negative behavioral indicators.
- **Exercise:** A simulation or test activity (In-Basket, Role Play, Group Exercise, Case Study, Oral Presentation, Competency-Based Interview)
- **Exercise-to-Competency Matrix:** Maps which competencies are observed in which exercises. Each competency must appear in at least 2 exercises (International Taskforce Guidelines requirement).
- **Observation:** An assessor's behavioral notes for a specific candidate in a specific exercise, organized by competency.
- **BARS Rating:** 1-5 Behavioral Anchored Rating Scale (1=Significant Development Needed, 2=Development Needed, 3=Competent, 4=Strength, 5=Significant Strength)
- **Wash-Up:** Structured data integration discussion where assessors compare ratings, present evidence, and agree on consensus ratings competency-by-competency.
- **ICC:** Intraclass Correlation Coefficient measuring inter-rater reliability. Target: >0.70 Year 1, >0.80 Year 3.
- **OAR:** Overall Assessment Rating (1-5) with recommendation: Ready Now / Ready with Development / Not Ready.

## Reference Documents (in project root)
- `VIFM_Assessment_Center_Blueprint.docx` - Full framework: competency model, exercise library, assessor model, delivery models, scoring methodology, commercial model, implementation roadmap
- `VIFM_Assessor_Packet.docx` - Operational assessor tools: observation forms for 6 exercise types, competency dictionary with behavioral indicators, BARS scales, integration worksheets, role player prompt sheets, wash-up protocol
- `VIFM_AC_Portal_Project_Plan.docx` - This development plan: 5 phases, 7 propositions, database schema, Claude Code prompts per module

## Development Phases (current plan)
- **Phase 1 (Weeks 1-4):** Foundation - DB schema, auth, 4 portal shells, compliance module
- **Phase 2 (Weeks 5-10):** Core Engine - Engagement wizard, digital assessor packet, observation forms, wash-up engine
- **Phase 3 (Weeks 11-14):** Reporting & Integration - Candidate portal, PDF reports, analytics, SHL/video/email integration
- **Phase 4 (Weeks 15-17):** Bilingual - Arabic/RTL, client portal
- **Phase 5 (Weeks 18-21):** AI Enhancements - Voice observation assistant, bias detection, AI report writer, development recommender (using Anthropic Claude Sonnet 4 API)

## Coding Conventions
- TypeScript strict mode. No `any` types.
- Server Components by default. Use `"use client"` only when React hooks or browser APIs are needed.
- All database access through Supabase client in server components or API routes.
- Use Zod for form validation and API input validation.
- Use Shadcn/UI components as the base. Do not install other UI libraries.
- Tailwind CSS only for styling. No CSS modules or styled-components.
- File naming: kebab-case for files, PascalCase for components.
- Commit messages: imperative mood, under 72 characters.
- Every table must have RLS policies. Never bypass RLS with service role key in client-facing code.
- All user-facing text must use i18n keys (not hardcoded strings) from Phase 4 onward.

## Compliance Requirements
- UAE Federal Decree-Law No. 45 of 2021 (Data Protection)
- Saudi Arabia Personal Data Protection Law (PDPL)
- GDPR for EU/UK operations
- ISO 10667 alignment (Assessment of People in Work and Organizational Settings)
- International Taskforce on Assessment Center Guidelines (6th Edition)
- Data retention: maximum 2 years unless contractually extended
- Candidate consent required before any data collection
- Audit trail on all significant actions (immutable log)

## Commands
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - ESLint check
- `npx supabase db push` - Push schema changes to Supabase
- `npx supabase gen types typescript` - Generate TypeScript types from DB schema

## Important Notes
- The Wash-Up Engine (Module 6) is the single most important differentiator. No competitor does this well. Invest extra effort here.
- SHL TalentCentral integration requires a commercial license (API credentials not available without contract). Build the integration layer with mock data first.
- Arabic competency translations must be human-reviewed. Use placeholder Arabic text during development.
- Each Claude Code session should produce one working, testable feature. Follow the prompt sequence in the Project Plan.
