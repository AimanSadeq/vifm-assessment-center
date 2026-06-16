# Authentication & Authorization - Implementation Guide

## Current State (Auth ENABLED)

Auth is gated by one flag: `AUTH_ENABLED` in `src/lib/auth/config.ts` (currently
`true` - enabled 2026-06-13, commit `1092c28`), consumed by `src/middleware.ts`
and `src/lib/ara/auth-guards.ts`. Unauthenticated requests to non-public routes
redirect to `/login` (verified: `/admin/*`, `/candidate/*` → `/login`); the
token-gated routes below and `/login` stay open, and the demo quick-login
dropdown is hidden outside development.

- **Middleware:** while `AUTH_ENABLED` is `false`, `src/middleware.ts` lets every
  request through without a session; when `true`, it enforces auth via
  `updateSession(request)`. (Token-gated routes — ARA respondents, Reflect raters,
  public `/courses` and `/verify` — are always bypassed by design.)
- **Login is real, not a stub.** `src/app/(auth)/login/page.tsx` calls
  `supabase.auth.signInWithPassword()` for both the quick-role dropdown and the
  email/password form. Demo accounts (all password `admin123`):
  `admin@viftraining.com`, `assessor@viftraining.com`,
  `candidate@viftraining.com`, `client@viftraining.com`.
- **Page reads are RLS-aware.** Pages read through `createClient()`
  (session-scoped). `createServiceClient()` (bypasses RLS) is reserved for server
  actions needing elevated rights, token-gated flows (ARA/Reflect), API routes,
  and seed scripts.

### You must log in to see data in dev
Because reads are RLS-scoped, a portal opened **without a session shows empty
data** even though `AUTH_ENABLED=false` lets you reach the page. RLS policies
(`supabase/migrations/00001_*`) require `auth.uid() IS NOT NULL` or a specific
`auth_role()` (which resolves the role from `profiles` by `auth.uid()`). No
session → `anon` → every read denied. Log in via a demo account to get a session.

## Production Checklist

### Step 1: Flip the auth gate - DONE (2026-06-13, commit `1092c28`)
1. `AUTH_ENABLED = true` is set; middleware enforces via `updateSession(request)`
   and the login form uses `signInWithPassword()`. ✅
2. Provision **real** users + matching `profiles` rows - run `scripts/create-admin.ts`
   (defaults to ahmad.rashid@viftraining.com; override via `ADMIN_EMAIL`/`ADMIN_NAME`).
   Demo accounts are dev-only; **rotate or disable** the `admin123` demo credential
   in production.
3. The quick-login demo dropdown is hidden outside development. ✅

### Step 2: Audit data-access clients (largely done)
Page reads already use the RLS-aware `createClient()`. The remaining work is an
audit, not a sweep: confirm every `createServiceClient()` reachable from a page
render is justified — an elevated server action, a token-gated flow (ARA/Reflect),
or an admin-only operation — and is not sidestepping RLS on user-facing data.

### Step 3: Add Auth Guards to API Routes - DONE (2026-06-16)
- `src/app/api/reports/*/route.tsx` + `learning-plan` - `guardCandidateReportAccess` (admin / own-org client / own-record candidate), `src/lib/auth/report-access.ts`.
- `src/app/api/consent/*/route.ts` - owning candidate or admin.
- Reflect report routes (`participant`/`cohort` PDF, `framework.pdf`, `needs-scheduling.csv`) - `guardReflectEngagementAccess` (admin or owning consultant), `src/lib/reflect/report-access.ts`.
- Academy action routes (`enroll`, `lesson/start`, `lesson/[id]/save`, `lesson/[id]/complete`, `complete`) - `guardAcademyCandidate` (admin or owning candidate), `src/lib/academy/access.ts`.
- Credential PDF - admin or owning candidate; role-profiles export - `requireRole(["admin"])`.
- Adequate as-is (no guard needed): ARA report PDF (`requireAssessmentOwner`), ARA-personal + tech-sandbox (unguessable token), Fluent cert / psychometrics / standalone Persona report (UUID-secret + anonymous takers), prehire export (`requireRole(admin)`), credential verify (public-by-design).

### Step 4: Fix Organization Scoping
- Client pages use `getClientOrgId()` from `src/lib/auth/get-org-id.ts`
- Update this function to read from authenticated user's profile
- All client queries are already filtered via this helper

### Step 5: Fix User Identity
- Replace "Administrator", "Assessor", "Client" placeholders in layouts with `session.user.full_name`
- Replace `created_by: null` in engagement creation with `auth.uid()`
- Replace dev assessor ID fallback in integration worksheet with `auth.uid()`

### Step 6: Provisioning candidate logins (go-live)
AC candidates need a REAL Supabase auth account to sign in to `/candidate/*`
(unlike Pre-Hire / ARA respondents, which are token-based and need no account).
New candidate rows are created with `profile_id = NULL`, so a candidate cannot
log in and see their own report/skills/credentials until provisioned. Three
pieces must line up: an `auth.users` row, a `profiles` row with `role='candidate'`,
and `candidates.profile_id` pointing at it.

- **Core:** `provisionCandidateLogin()` in `src/lib/auth/provision-candidate.ts`
  (find-or-create user -> upsert profile -> link every candidate row sharing the
  email). Refuses to touch an email that already has a non-candidate profile.
- **In-app:** the "Invite to portal" (KeyRound) button on each candidate row of
  the engagement detail page calls `inviteCandidateToPortalAction`, which
  provisions + emails the `candidate_invitation` template with a set-password
  link (recovery link via `generateCandidateSetupLink`; copy-link fallback when
  Microsoft Graph email is unconfigured).
- **Batch:** `npx tsx scripts/provision-candidate-logins.ts` (dry-run by default;
  `--apply` to execute; pass specific emails to scope). Prints a set-password link
  per candidate. Do NOT provision seeded `@adnoc.ae` demo rows, and do NOT
  provision an email intended to be an admin (e.g. ahmad.rashid) as a candidate.
- **Clients** are already provisioned the normal way: a `profiles` row with
  `role='client'` + `organization_id` (the client-org guard reads it via
  `getClientOrgId()`).

### Files with TODO Comments
Search for `// TODO:` to find all auth-related placeholders:
- `src/middleware.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/admin/engagements/new/actions.ts`
- `src/app/admin/engagements/[id]/actions.ts`
- `src/app/assessor/assignments/[engagementId]/page.tsx`
- `src/app/assessor/integration/[engagementId]/[candidateId]/page.tsx`
- `src/app/assessor/layout.tsx`
- `src/app/client/layout.tsx`
- `src/app/admin/layout.tsx`
- `src/app/api/reports/*/route.tsx`
- `src/app/api/consent/*/route.ts`
- `src/lib/auth/get-org-id.ts`
- `src/app/candidate/consent/[candidateId]/page.tsx`
