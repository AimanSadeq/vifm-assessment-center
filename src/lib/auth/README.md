# Authentication & Authorization - Implementation Guide

## Current State (Development)
- Auth middleware is **disabled** in `src/middleware.ts`
- Login page uses **bypass buttons** (no real authentication)
- All pages use `createServiceClient()` which **bypasses RLS**
- API routes have **no auth checks** (TODO comments in place)

## Production Checklist

### Step 1: Enable Supabase Auth
1. Uncomment `updateSession(request)` in `src/middleware.ts`
2. Implement real login form in `src/app/(auth)/login/page.tsx` using `supabase.auth.signInWithPassword()`
3. Create user registration flow or admin user creation

### Step 2: Switch to RLS-Aware Client
Replace `createServiceClient()` with `createClient()` in all page.tsx files:
- `src/app/admin/*.tsx` - requires user with `admin` role
- `src/app/assessor/*.tsx` - requires user with `lead_assessor` or `associate_assessor` role
- `src/app/candidate/*.tsx` - requires user with `candidate` role
- `src/app/client/*.tsx` - requires user with `client` role

Keep `createServiceClient()` ONLY for:
- Server actions that need elevated privileges
- Seed scripts and admin operations

### Step 3: Add Auth Guards to API Routes
- `src/app/api/reports/*/route.tsx` - verify user is admin, client (own org), or candidate (own report, released)
- `src/app/api/consent/*/route.ts` - verify user is the candidate

### Step 4: Fix Organization Scoping
- Client pages use `getClientOrgId()` from `src/lib/auth/get-org-id.ts`
- Update this function to read from authenticated user's profile
- All client queries are already filtered via this helper

### Step 5: Fix User Identity
- Replace "Administrator", "Assessor", "Client" placeholders in layouts with `session.user.full_name`
- Replace `created_by: null` in engagement creation with `auth.uid()`
- Replace dev assessor ID fallback in integration worksheet with `auth.uid()`

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
