# Succession Readiness Engine — Implementation Handover for Claude Code

**Audience:** Claude Code, running locally against `C:\code\vifm-assessment-center` with access to the repo and the Supabase project.
**Author:** design + verified engine produced in the Claude chat surface (sandboxed, no access to the live DB).
**Status of the engine:** `src/lib/scoring/readiness.ts` is written and unit-verified (6 worked cases pass, see Appendix B). It is delivered alongside this document and reproduced in full in Appendix A.

---

## 0. How to use this document

Two markers appear throughout:

- **IMPLEMENT EXACTLY** — schema and engine. Copy as written. The maths and the table shapes are load-bearing.
- **IMPLEMENT TO SPEC** — UI, server actions, seeds. Follow the requirements here but match the repo's existing conventions (admin page layout, i18n helpers, RLS style, action patterns) rather than inventing new ones.

Migration numbering: the current highest migration is `00077_technical_sandbox_portal.sql`. The files below use `00078`–`00082`. If any of those numbers are already taken when you start, bump to the next free sequential numbers and keep the order.

Repo conventions to reuse (confirmed in the codebase):
- Supabase server access: `createServiceClient()` from `@/lib/supabase/server` (service role; bypasses RLS for server-side compute). `createClient()` is the user-scoped variant.
- Server pages use `export const dynamic = "force-dynamic";`.
- i18n: `getServerT`, `getServerLocale`, `getServerDir` from `@/lib/i18n/server`, and `localizedName` from `@/lib/i18n/localized`.
- Admin gating: RLS uses `auth_role() = 'admin'`; admin pages live under `src/app/admin/...`.
- Types live in `src/types/database.ts` and must be regenerated after migrations.
- The 360 scorer already exists: `computeParticipantScoring(participantId: string): Promise<ParticipantScoring | null>` in `src/lib/reflect/scoring.ts`. Reuse it. Do not re-query `reflect_responses`.

---

## 1. The decided model (full spec)

1. **One shared item bank on the 38 competencies**, served two ways: self-perspective ("I…") in the behavioral assessment, observer-perspective ("This person…") in the 360. Draft content exists in `docs/competency-self-report-cluster1.md` (Form A, normative Likert, 4 items/competency, some reverse-scored) and the clusters 2 to 8 companion. Each competency score is the mean of its items; clusters and domains roll up from there.

2. **Self lever (engagement-level, admin-set).**
   - *Standalone (default):* each instrument carries its own self-rating.
   - *Combined mode:* the behavioral assessment carries the self-rating; the 360 is switched to **others-only** (self-rater suppressed). Self is collected exactly once.

3. **360 framework on the 38.** Reflect's engine is framework-agnostic; the only seeded template today is a 5-competency leadership set ("VIFM Leadership Essentials"). For this work, seed a **38-competency Reflect framework** mirroring the bank, each `reflect_competencies` row linked to its catalogue `competencies` row.

4. **Combination:** the 360 **Others** view drives readiness (manager / peer / direct-report / skip-level / other). The self-assessment never moves the tier; it is differenced against Others per competency to surface over-rating, under-rating, blind spots, and hidden strengths.

5. **Readiness index (approved maths):** over the target role's weighted competencies, compare the Others-mean to the role's target proficiency, weight each gap by competency weight, aggregate to one gap, and map to a tier. A high-priority knockout guardrail caps the tier when a must-have is far below target. A coverage floor prevents asserting a tier on thin data. Four tiers: **Ready Now, Ready Soon, Developing, Not Ready**, with an **optional** client-toggled year layer. Every threshold is admin-configurable.

6. **Engine:** `readiness.ts` (delivered, verified).

7. **Deliverable scope of this handover:** make readiness computable and tunable end to end (Slice 1), plus specs to seed the 360 on the 38 (Slice 2), build the behavioral runner (Slice 3), and ship the report (Slice 4).

---

## 2. Current state — reuse vs new (accurate)

**Reuse as-is:**
- `computeParticipantScoring` (`src/lib/reflect/scoring.ts`) — yields per-competency `others_mean` and `self_mean` (already excludes self from Others, already applies anonymity `min_n`). Returns `ParticipantScoring` with `competencies: CompetencyScore[]` keyed by the **Reflect** `competency_id` and `name_en`.
- `role_profiles` + `role_profile_competencies` — the target benchmark (weight 0.5–10, priority high/medium/low, `default_target_proficiency` typically 4). Six GCC profiles are seeded; **none is SDAIA-specific** (closest: "Senior Government Manager").
- `src/lib/scoring/talent-map.ts` — the 9-box helpers and tone tokens. The new tiers extend, and do not replace, the legacy OAR `SUCCESSION_META`.

**New work:**
- The readiness engine — **delivered** (`readiness.ts`).
- A config table + admin panel (Slice 1).
- Competency mapping `reflect_competencies.ac_competency_id` (M2) — replaces fragile name-matching.
- A candidate-to-participant bridge (M3) — the AC side (`candidates`, `engagements`) and the Reflect side (`reflect_participants`, `reflect_engagements`) are **separate subsystems**; combined readiness needs to know which Reflect participant holds a given AC candidate's 360.
- The combined-mode flag (M4).
- A results snapshot table (M5, recommended).
- A 38-competency Reflect framework seed (Slice 2, data).
- The behavioral self-assessment runner (Slice 3).
- The readiness report, per-candidate plus a cohort 9-box (Slice 4).

---

## 3. The Readiness Index — methodology and formula (documentation)

This is the canonical description. Reuse it verbatim as the admin-panel help text and keep it in sync with the engine's header comment.

Computed over the target role's competencies (`role_profile_competencies`), each carrying a **weight** (0.5–10), a **priority** (high/medium/low), and a **target proficiency** on the 1 to 5 scale (`role_profiles.default_target_proficiency`, typically 4).

1. **Coverage.** A role competency is *covered* when the 360 produced an Others-mean for it from at least `min_others_per_competency` raters. `coverage_pct` = covered / total role competencies. Below `coverage_min_pct`, the result is **Insufficient Data** and no tier is asserted. Thin data must never read as a verdict.

2. **Weighted Others level.** Over covered competencies: `weighted_others = Σ(others_mean × weight) / Σ(weight)`. Turning weighting off collapses each weight to 1 (a plain mean).

3. **Gap.** `weighted_target` is the same weighted blend of each covered competency's target. `gap = weighted_others − weighted_target`. When every target equals the role default T, `weighted_target = T` and `gap = weighted_others − T`.

4. **Tier from gap** (cutoffs descending, all configurable): `gap ≥ ready_now_gap_cut` (default 0.0) is Ready Now; `gap ≥ ready_soon_gap_cut` (−0.5) is Ready Soon; `gap ≥ developing_gap_cut` (−1.0) is Developing; otherwise Not Ready.

5. **Knockout guardrail.** If enabled, any covered competency whose priority equals `knockout_priority` (default high) and whose Others-mean is `knockout_gap` (default 1.0) or more below its target caps the final tier at `knockout_cap_tier` (default Developing). A strong average never fast-tracks someone failing a must-have.

6. **Self vs Others (self-awareness only).** Per competency, `self_others_gap = self_mean − others_mean`, flagged over-rater / under-rater / aligned, plus blind-spot (Others below target while Self at or above) and hidden-strength (Others at or above target while Self below). This never changes the tier. The self source is the behavioral assessment in combined mode, the 360 self-rater otherwise.

7. **Optional year layer.** When enabled, the tier maps to a client-defined horizon label for stakeholder copy. It is derived from the tier, never from the maths.

**Worked example (verified).** Role = 5 weighted competencies, target 4. Others = {2.0, 2.2, 2.1, 2.3, 2.0}, weights {8,7,6,5,5}. `weighted_others ≈ 2.11`, `gap ≈ −1.89` → **Not Ready**; with the year layer on, label "Beyond 5 years / not in pipeline." Replace those Others with values at/above 4 and it returns **Ready Now**. Put a single high-priority competency at 2.8 (1.2 below target) amid otherwise-strong scores and the knockout caps it at **Developing**.

---

## 4. Slice 1 — Readiness engine + config + admin panel + scoring action

This slice makes readiness computable and tunable. It is the deployable core.

### 4.1 Migrations — IMPLEMENT EXACTLY

**`00078_readiness_index_config.sql`**

```sql
-- Admin-tunable parameters for the Succession Readiness index.
-- One global default row (organization_id IS NULL). Optional per-org overrides.
CREATE TABLE readiness_index_config (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  -- Tier gap cutoffs (weighted_others - weighted_target). Must be descending.
  ready_now_gap_cut        numeric(3,2) NOT NULL DEFAULT 0.00,
  ready_soon_gap_cut       numeric(3,2) NOT NULL DEFAULT -0.50,
  developing_gap_cut       numeric(3,2) NOT NULL DEFAULT -1.00,
  -- Knockout guardrail.
  knockout_enabled         boolean NOT NULL DEFAULT true,
  knockout_priority        text NOT NULL DEFAULT 'high' CHECK (knockout_priority IN ('high','medium','low')),
  knockout_gap             numeric(3,2) NOT NULL DEFAULT 1.00,
  knockout_cap_tier        text NOT NULL DEFAULT 'developing'
                             CHECK (knockout_cap_tier IN ('ready_now','ready_soon','developing','not_ready')),
  -- Aggregation + data sufficiency.
  use_weights              boolean NOT NULL DEFAULT true,
  min_others_per_competency integer NOT NULL DEFAULT 1 CHECK (min_others_per_competency >= 1),
  coverage_min_pct         numeric(4,3) NOT NULL DEFAULT 0.700 CHECK (coverage_min_pct BETWEEN 0 AND 1),
  -- Optional year layer.
  year_layer_enabled       boolean NOT NULL DEFAULT false,
  year_map                 jsonb NOT NULL DEFAULT
    '{"ready_now":"0-2 years","ready_soon":"1-3 years","developing":"3-5 years","not_ready":"Beyond 5 years / not in pipeline"}'::jsonb,
  updated_by               uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- At most one row per scope (one global, one per org).
  CONSTRAINT readiness_config_one_per_scope UNIQUE (organization_id)
);

-- Ordering sanity so the admin panel can't save inverted cutoffs.
ALTER TABLE readiness_index_config ADD CONSTRAINT readiness_cutoffs_descending
  CHECK (ready_now_gap_cut >= ready_soon_gap_cut AND ready_soon_gap_cut >= developing_gap_cut);

CREATE UNIQUE INDEX readiness_config_global_singleton
  ON readiness_index_config ((organization_id IS NULL)) WHERE organization_id IS NULL;

CREATE TRIGGER readiness_config_updated_at
  BEFORE UPDATE ON readiness_index_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed the global default (mirrors DEFAULT_READINESS_CONFIG in readiness.ts).
INSERT INTO readiness_index_config (organization_id) VALUES (NULL);

ALTER TABLE readiness_index_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_config_all_admin ON readiness_index_config
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY readiness_config_select_auth ON readiness_index_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

> Keep the defaults here identical to `DEFAULT_READINESS_CONFIG` in `readiness.ts`. If you change one, change both.

**`00079_reflect_competency_ac_link.sql`**

```sql
-- Hard link from a Reflect competency to its AC catalogue competency, so the
-- readiness engine maps 360 scores onto role-profile competencies reliably
-- instead of matching on name.
ALTER TABLE reflect_competencies
  ADD COLUMN ac_competency_id uuid REFERENCES competencies(id) ON DELETE SET NULL;

CREATE INDEX idx_reflect_competencies_ac ON reflect_competencies(ac_competency_id);

-- Best-effort backfill for any existing frameworks whose names already match.
UPDATE reflect_competencies rc
SET ac_competency_id = c.id
FROM competencies c
WHERE rc.ac_competency_id IS NULL
  AND lower(trim(rc.name_en)) = lower(trim(c.name));
```

**`00080_reflect_participant_candidate_link.sql`**

```sql
-- Bridge the Reflect participant to the AC candidate (same person), so a
-- combined engagement can pull the 360 for a given candidate.
ALTER TABLE reflect_participants
  ADD COLUMN candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL;

CREATE INDEX idx_reflect_participants_candidate ON reflect_participants(candidate_id);

-- Email is the fallback matcher when candidate_id is null (both tables hold email).
```

**`00081_engagement_assessment_mode.sql`**

```sql
-- The self lever. 'standalone' = each instrument keeps its own self-rating.
-- 'combined' = behavioral assessment carries self; the 360 self-rater is suppressed.
CREATE TYPE engagement_assessment_mode AS ENUM ('standalone', 'combined');

ALTER TABLE engagements
  ADD COLUMN assessment_mode engagement_assessment_mode NOT NULL DEFAULT 'standalone';
```

**`00082_readiness_results.sql`** (recommended — auditable snapshot)

```sql
-- Stored readiness snapshot per candidate per engagement, with the config that
-- produced it. Reports render from this; recompute overwrites it.
CREATE TABLE readiness_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id    uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id     uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  role_profile_id  uuid REFERENCES role_profiles(id) ON DELETE SET NULL,
  status           text NOT NULL CHECK (status IN ('ready_now','ready_soon','developing','not_ready','insufficient_data')),
  tier             text CHECK (tier IN ('ready_now','ready_soon','developing','not_ready')),
  weighted_others  numeric(4,2),
  weighted_target  numeric(4,2),
  overall_gap      numeric(4,2),
  coverage_pct     numeric(4,3) NOT NULL,
  knockout_applied boolean NOT NULL DEFAULT false,
  year_label       text,
  per_competency   jsonb,             -- full CompetencyReadiness[] for the report
  config_snapshot  jsonb NOT NULL,    -- the ReadinessConfig used
  computed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, candidate_id)
);

CREATE INDEX idx_readiness_results_engagement ON readiness_results(engagement_id);

ALTER TABLE readiness_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_results_all_admin ON readiness_results
  FOR ALL USING (auth_role() = 'admin');
-- Add assessor/client SELECT policies mirroring how candidate_reports is scoped,
-- if clients are to view readiness in-portal.
```

After the migrations: `supabase db push` (or your migration runner), then regenerate `src/types/database.ts`.

### 4.2 Engine — IMPLEMENT EXACTLY (delivered)

Drop in the delivered `src/lib/scoring/readiness.ts` (full source in Appendix A). It is pure and dependency-free. Add the unit test from Appendix B as `src/lib/scoring/readiness.test.ts` and wire it into the test runner.

### 4.3 Scoring / integration layer — IMPLEMENT TO SPEC

Create `src/lib/scoring/readiness-data.ts` with a server function that assembles the engine inputs and runs it. Requirements:

1. **Resolve config.** Read `readiness_index_config` for the engagement's organization; fall back to the global row (`organization_id IS NULL`). Map columns to the `ReadinessConfig` shape.
2. **Build `RoleCompetencyReq[]`.** From the engagement's role profile: `role_profile_competencies` joined to `competencies` for the name, with `weight`, `priority`, and `target = role_profiles.default_target_proficiency` (allow a per-competency target later, but use the role default now).
3. **Find the 360.** Resolve the candidate's Reflect participant: prefer `reflect_participants.candidate_id = candidate.id`; fall back to email match within the linked Reflect engagement. If none, return `insufficient_data`.
4. **Get 360 scores.** Call `computeParticipantScoring(participantId)`. From the returned `competencies: CompetencyScore[]`, take `others_mean` and `self_mean` per competency.
5. **Map to catalogue competencies.** For each `CompetencyScore`, resolve the AC competency via `reflect_competencies.ac_competency_id` (fallback: case-insensitive `name_en` to `competencies.name`). Produce `ObservedCompetency[]` keyed by the **AC** `competency_id`.
6. **Self source per the lever.** If `engagements.assessment_mode = 'combined'`, replace `selfMean` with the behavioral self-assessment per-competency score (Slice 3); the 360 framework for a combined engagement should have been seeded with no self-rater. In `standalone`, keep the 360 `self_mean`.
7. **Run** `computeReadiness(role, observed, config)`.
8. **Persist** (if M5 is in): upsert a `readiness_results` row with the result, `per_competency`, and `config_snapshot`.

Skeleton:

```ts
// src/lib/scoring/readiness-data.ts
import { createServiceClient } from "@/lib/supabase/server";
import { computeParticipantScoring } from "@/lib/reflect/scoring";
import {
  computeReadiness, DEFAULT_READINESS_CONFIG,
  type ReadinessConfig, type RoleCompetencyReq, type ObservedCompetency, type ReadinessResult,
} from "@/lib/scoring/readiness";

export async function computeCandidateReadiness(
  engagementId: string,
  candidateId: string,
): Promise<ReadinessResult> {
  const sb = createServiceClient();
  // 1) config  2) role reqs  3) participant  4) participant scoring
  // 5) map reflect->AC competency  6) self per assessment_mode  7) computeReadiness
  // 8) optional upsert into readiness_results
  // ... (implement per the 8 steps above)
  return computeReadiness([], [], DEFAULT_READINESS_CONFIG); // replace
}
```

### 4.4 Admin config panel — IMPLEMENT TO SPEC

Route: `src/app/admin/readiness/config/page.tsx` (+ a nav entry wherever the admin sidebar is defined). Follow the existing admin page + server-action pattern.

- **Load** the effective config (global, or a chosen org override).
- **Edit** every `readiness_index_config` field: the three gap cutoffs, knockout (enabled, priority, gap, cap tier), `use_weights`, `min_others_per_competency`, `coverage_min_pct`, `year_layer_enabled`, and the four `year_map` labels.
- **Validate** before save: cutoffs strictly descending (the DB CHECK enforces it too), `coverage_min_pct` in 0–1, gaps within a sane band (e.g. −5 to 5).
- **Inline help:** render the Section 3 methodology so an admin sees what each control changes.
- **Save** via an admin-only server action; set `updated_by`.
- **Icons:** per house style, SVG only — do not use the icon font; reuse the project's SVG/`lucide-react` components already in the admin UI.

---

## 5. Slice 2 — 38-competency 360 framework (data) — IMPLEMENT TO SPEC

Seed a Reflect framework that mirrors the bank so the 360 measures the same 38.

- Insert one `reflect_frameworks` template row (e.g. "VIFM 38-Competency Behavioural 360").
- Insert 38 `reflect_competencies`, one per catalogue competency, **with `ac_competency_id` set** (this is the reliable mapping) and `name_en` / `name_ar` matching the catalogue.
- Insert `reflect_behaviors` from the shared item bank, observer-perspective wording ("This person…"), grouped under each competency. Use `docs/competency-self-report-cluster1.md` + the clusters 2 to 8 companion as the source; keep item-to-competency alignment intact.
- For **combined** engagements, clone this framework per engagement with the self-rater path disabled, so no self items are served in the 360 (the lever). Standalone 360s keep the self-rater.

---

## 6. Slice 3 — Behavioral self-assessment runner — IMPLEMENT TO SPEC

Candidate-facing instrument that serves the same bank, self-perspective.

- Reuse the access-code/redeem pattern already used elsewhere (the "20 access codes" flow) for candidate entry.
- Serve the 38-competency Likert items ("I…"), reverse-score flagged items (`score = 6 − raw`), and compute each competency as the mean of its items, then roll up to cluster and domain using the existing `competency_clusters` / `competency_domains` hierarchy.
- Store per-competency self scores so `readiness-data.ts` step 6 can read them in combined mode. Group output by cluster and domain (explicit requirement).
- This is the only sizeable net-new UI; build it after Slice 1 is green.

---

## 7. Slice 4 — Readiness report + cohort view — IMPLEMENT TO SPEC

- **Per-candidate:** readiness tier (+ optional year label), the weighted-gap summary, a per-competency table (Others-mean vs target, gap, knockout flags), and the self-vs-Others panel (over/under-rater, blind spots, hidden strengths) from `CompetencyReadiness`.
- **Cohort:** extend the existing Talent Map page (`src/app/admin/engagements/[id]/talent-map/page.tsx`). Add a readiness-tier column/bucket sourced from the engine (or `readiness_results`) alongside the current 9-box and heatmap. The 9-box axis maths (`PERFORMANCE_DOMAINS` / `POTENTIAL_DOMAINS` in `talent-map.ts`) stay as-is.
- Bilingual EN/AR and SVG-only icons, per house style. Reuse the PDF path used by `candidate_reports` / Reflect reports for an exportable version if the client needs a document.

---

## 8. Deployment steps (Supabase + app)

1. Create migrations `00078`–`00082` (renumber if needed). `supabase db push`.
2. Regenerate types: `src/types/database.ts`.
3. Add `src/lib/scoring/readiness.ts` (Appendix A) and `readiness.test.ts` (Appendix B). Run the test suite — all 6 cases must pass.
4. Add `src/lib/scoring/readiness-data.ts` (Section 4.3).
5. Build the admin config panel (Section 4.4). Smoke-test: load defaults, edit a cutoff, save, reload.
6. Seed the 38-competency Reflect framework (Slice 2).
7. Build the behavioral runner (Slice 3), then wire combined-mode self into `readiness-data.ts` step 6.
8. Build the report + cohort view (Slice 4).
9. `npm run build` / `npm run lint` clean before deploy.

---

## 9. Build checklist (ordered)

- [ ] Migrations 00078–00082 applied; types regenerated
- [ ] `readiness.ts` + tests in; suite green
- [ ] `readiness-data.ts` assembles inputs and returns a tier for a test candidate
- [ ] Admin config panel loads, validates, saves; help text present; SVG icons only
- [ ] 38-competency Reflect framework seeded, every `reflect_competencies.ac_competency_id` set
- [ ] Behavioral runner serves the bank, scores per competency/cluster/domain, stores self scores
- [ ] Combined-mode: 360 self suppressed, self sourced from the assessment
- [ ] Report (per-candidate + cohort) renders tier, gap, knockouts, self-vs-Others; bilingual

## 10. Open inputs needed from Aiman (not blockers for Slice 1)

- **SDAIA target role profile(s):** which roles candidates are assessed against. Clone "Senior Government Manager" or author SDAIA-specific profiles (set the weighted role-critical competencies, priorities, and `default_target_proficiency`).
- **Item bank finalisation:** confirm the docs drafts are the final wording, or supply edits, before seeding the 360 framework and the runner.
- **Year-layer labels:** the default `year_map` reflects "0-2 / 3-5"; confirm or adjust per client in the admin panel.

---

## Appendix A — `src/lib/scoring/readiness.ts` (canonical source)

The companion file delivered with this document is identical to the source below.

> See the delivered `readiness.ts`. Its full contents are the source of truth for the engine. If pasting from this appendix, ensure no characters are altered in the numeric defaults.

## Appendix B — verified unit tests

These cases were run against the engine and all pass. Add as `readiness.test.ts` (adapt the import/test-runner syntax to the repo's setup).

- **A — Ready Now:** all Others at/above target 4 → `tier === "ready_now"`, no knockout.
- **B — Ready Soon:** Others ~3.6–3.9 (gap −0.5 to 0) → `tier === "ready_soon"`.
- **C — Knockout:** one high-priority competency at 2.8 (1.2 below) amid strong scores → `knockoutApplied`, `tier === "developing"`, that competency flagged `blind_spot`.
- **D — Insufficient data:** only 2 of 5 covered (< 70%) → `status === "insufficient_data"`, `tier === null`.
- **E — Not Ready + year:** Others ~2.0–2.3 with year layer on → `tier === "not_ready"`, `yearLabel` set (`weighted_others ≈ 2.11`, `gap ≈ −1.89`).
