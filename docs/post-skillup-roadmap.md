# Post-Skillup-parity hardening roadmap

Anchor for the work that comes after the 2026-04-28 Skillup-parity sweep.
14 features shipped (P0.1, P0.2, P0.3, Learning Plan, G1, G2, G3, G4, G5,
G6, H1, H2, H3, H4) — the next phase is **hardening, not breadth**.

Source recommendation conversation: chat session 2026-04-28.

---

## 1. Verify the AI paths actually work — 15 min · status: in progress

Quiz generator (G3), bulk JD import (G4), and the original JD extractor (P0.1)
were only smoke-tested via the "AI is not configured" error path because
`ANTHROPIC_API_KEY` isn't set on this dev box.

**Steps:**
- [ ] Add `ANTHROPIC_API_KEY=...` to `.env.local`
- [ ] Restart `npm run dev` so Next.js picks up the env var
- [ ] Click "Start AI Quiz" on `/candidate/skills/<a candidate with a role profile>` — confirm 7 questions render, complete one, confirm results page shows AI explanations
- [ ] Visit `/admin/role-profiles/bulk-import`, upload one JD, confirm the recommendations table renders, click Create — confirm the new role profile appears in `/admin/role-profiles`
- [ ] If anything fails, fix before moving on

**Why this is first:** if the AI path is broken we shipped a placebo.

---

## 2. Auth + RLS audit on the new tables — ½ day · status: pending

Five new tables / extensions added in the parity sweep. ARA already had a
dedicated [auth-hardening commit](https://github.com/AimanSadeq/vifm-assessment-center/commit/4012054)
(`4012054`); the AC parity tables owe the same scrutiny.

**New surfaces to audit:**
- `candidates.role_profile_id` (migration 00016)
- `candidate_quiz_attempts` (migration 00017) — questions/answers JSONB
- `notifications` (migration 00018)

**Specific scenarios to verify:**
- [ ] Candidate A can NOT read Candidate B's `candidate_quiz_attempts` rows
      via UUID guessing
- [ ] Candidate A can NOT write to `notifications` with another user's
      `profile_id` — current policy allows this (no `WITH CHECK`); needs a
      `WITH CHECK (profile_id = auth.uid())` to lock it down
- [ ] `setCandidateRoleProfileAction` notification publisher tolerates a
      candidate whose `profile_id` is null (it currently no-ops, verify)
- [ ] Client role can read quiz attempts only for candidates in their org's
      engagements (existing policy, but the JOIN-through-engagements path
      hasn't been exercised)
- [ ] `bulkAssignRoleProfilesAction` and `bulkExtractJdsAction` work under
      RLS — i.e. an admin's session has the right policy hits when iterating
      thousands of rows

**Output:** an `00019_ac_auth_hardening.sql` migration with any policy
fixes, plus a checklist commit message similar to `4012054`.

---

## 3. Bilingual EN/AR translations for the new UI — ~1 week · status: pending

CLAUDE.md: "All user-facing text should use i18n keys from Phase 4 onward."
The 14 parity surfaces shipped this week are English-only.

**Surfaces missing Arabic:**
- G1 — Role Profile column header + dropdown labels in engagement detail
- G2 — `/candidate/skills/[id]` (My Skills, Total Skills, Assessed, gap
  badge labels, empty-state copy, domain group titles)
- G3 — Quiz interface chrome (AI POWERED badge, "Question N of 7",
  difficulty pills, "End Session", "Next") + Results page chrome ("Keep
  Learning!", stat card labels, "Questions for Review", "Your answer",
  "Correct answer", "Explanation"). Note: AI-generated questions and
  explanations are already bilingual when the generator is invoked with
  `bilingual: true` — currently we don't pass the flag, so add that path.
- G4 — `/admin/role-profiles/bulk-import` chrome
- G5 — `/admin/role-profiles/bulk-assign` chrome
- G6 — "Export JSON" button label
- H1 — "AI Mapping Summary" eyebrow + domain chip headings
- H2 — Chart titles + tooltips ("Assessment Progress", "Skills by Domain",
  "Average Score by Domain")
- H3 — Notification bell aria-label, popover header, "Mark all read",
  empty-state copy, relative-time strings ("just now", "5m ago", etc.)
- H4 — "Admin view · Viewing as", "Exit view"

**Existing patterns:** `src/lib/i18n/locales/{en,ar}.json` +
`useTranslation()` hook. Each surface is ½ day; total ~1 week.

**Tip:** ARA already has full bilingual support — copy the pattern from
`/ara/respond/[token]/page.tsx` for any client component, and from the
existing AC bilingual screens (e.g. login, candidate welcome) for server
components.

---

## 4. Wire ARA M2.1 + M3.3 emails — ½ day · status: ✅ shipped 2026-04-28

Shipped in commit `3b190cc`. New `src/lib/ara/email.ts` module with
bilingual templates (en / ar / bilingual HTML) for both events.
Honours `assessment.is_sandbox` → SANDBOX_EMAIL_REDIRECT, falls back
to a console mock when AZURE_* env vars are unset, always writes
to `ara_email_log` (even mocks). New `<SendInvitationButton />` per
respondent row in `/ara/consultant/assessments/[id]` Respondents tab.
`markAraRespondentComplete` now fires the consultant notification via
a fire-and-forget dynamic import — failures logged, never thrown.

---

## 5. AUTH_ENABLED flip — ½ day + careful testing · status: PENDING (user-paused 2026-04-28)

Items 2, 3, and 4 are all shipped — the prerequisites are clear. User
explicitly asked to defer this step, with a reminder. Don't auto-start
without explicit go-ahead.

When picking this back up, the simplified plan (per the chat session
that paused this):
- [ ] Flip `AUTH_ENABLED = true` in [src/middleware.ts](../src/middleware.ts)
- [ ] Hide the 4 quick-login role buttons on `/login` in production
      builds (gate to `process.env.NODE_ENV === "development"`)
- [ ] Create 4 test user accounts in Supabase Auth (admin, lead_assessor,
      candidate, client) and seed matching `profiles` rows with the
      correct `role` value
- [ ] Log in as the candidate, attempt cross-candidate reads — confirm
      the migration 00019 hardening blocks them
- [ ] `npm run build` — make sure the production build passes
- [ ] Run [scripts/verify-rls.ts](../scripts/verify-rls.ts) against the
      fresh test DB
- [ ] Smoke the new parity surfaces (G2 / G3 / H1–H4) under each role
- [ ] Commit; revert path is `git revert` since the change is one file

Production deployment (separate from the local flip): coordinate with
client onboarding so test accounts exist before the flip lands on the
deployed environment.

---

## Polish items (post-roadmap, all shipped or explicitly deferred)

| Item | Status |
|---|---|
| Bilingual AI quiz output (set `bilingual: true`, render *_ar fields) | ✅ Shipped 2026-04-28 (commit `3fdaeee`) |
| Candidate layout chrome translation (Portal subtitle, Sign Out, footer) | ✅ Shipped 2026-04-28 (commit `3fdaeee`) |
| Defence-in-depth `requireRole(["admin"])` on key AC admin actions | ✅ Shipped 2026-04-28 — `addCandidateAction`, `setCandidateRoleProfileAction`, `bulkAssignRoleProfilesAction`, `bulkExtractJdsAction`, `bulkCreateRoleProfilesAction` |
| Quiz finalisation as SECURITY DEFINER Postgres RPC | **Deferred — gold-plating.** Migration 00019's `candidate_quiz_attempts_immutable_check` trigger already blocks candidate-side score writes; service-role completion goes through a separate path that bypasses the trigger. Moving scoring to a SECURITY DEFINER RPC would eliminate one remaining attack-shape (candidate calls the action via DevTools fetch with a crafted payload) but the action's auth-aware read-then-service-role-write pattern already validates ownership before the score lands. Reopen if a real attack surfaces. |

## Explicitly skipped

| Item | Reason |
|---|---|
| Mobile / responsive | CLAUDE.md is desktop-only by design |
| Skillup blind-spot pages (Dashboard, Skill Visualization, Report Manager, 11 Control Panel sub-tabs) | No recording available; guessing would waste effort |
| Color customisation / Sidebar reordering | Brand kit is fixed |
| Full AC re-engagement workflow (G7) | Quiz retake covers the candidate side; product input needed for the admin queue |
| Cert builder | No certificate concept yet |
