# Succession Readiness — Confidence Layer + IDP Linkage Handover for Claude Code

**Third in the series**, after `READINESS_ENGINE_HANDOVER.md` (Slice 1) and `READINESS_SLICES_2-4_HANDOVER.md` (Slices 2 to 4). Same conventions. Migration numbers continue; this doc uses `00085`.

This covers three additions that came out of the design review:
- **A. Engine v2 — advisory confidence flags** (delivered, verified).
- **B. Slice 5 — readiness to Individual Development Plan linkage.**
- **C. Optional — per-competency target proficiency** (bridges the SDAIA job-analysis inputs).

---

## A. Engine v2 — advisory confidence flags (delivered)

The delivered `readiness.ts` is **updated** and **replaces** the v1 you placed in `src/lib/scoring/`. It is backward-compatible: every tier result is identical (the original five test cases still pass), it only adds advisory signals that never change the tier. The updated `readiness.test.ts` adds two cases (F borderline, G low agreement); all seven pass.

What is new:
- **Config:** two fields, `borderlineBand` (default 0.10) and `raterAgreementSpreadMax` (default 3). Add both to `readiness_index_config` (Slice 1) and to the admin panel.
- **Input:** `ObservedCompetency.othersSpread?: number | null` — the spread of the Others ratings for a competency. Optional; when absent, the low-agreement flag is simply never raised.
- **Output:** on `ReadinessResult`, `borderline: boolean`, `borderlineNote: string | null`, `nearestCutoffDistance: number | null`, `lowAgreementCount: number`; and on each `CompetencyReadiness`, `lowAgreement: boolean`.

### A.1 Migration delta — IMPLEMENT EXACTLY (fold into 00078, or add 00085a)

```sql
ALTER TABLE readiness_index_config
  ADD COLUMN borderline_band            numeric(3,2) NOT NULL DEFAULT 0.10
    CHECK (borderline_band >= 0),
  ADD COLUMN rater_agreement_spread_max numeric(3,2) NOT NULL DEFAULT 3.00
    CHECK (rater_agreement_spread_max >= 0);
```

Map these to `borderlineBand` and `raterAgreementSpreadMax` when building the `ReadinessConfig` in `readiness-data.ts`.

### A.2 Supplying `othersSpread` — IMPLEMENT TO SPEC

In `readiness-data.ts` (Slice 1, step 4/5), when reading each competency from `computeParticipantScoring`, derive the spread from the per-group Others means already on `CompetencyScore.by_group` (manager / peer / direct_report / skip_level / other): `othersSpread = max(groupMeans) − min(groupMeans)` over the groups that have a value. The default `raterAgreementSpreadMax = 3` aligns with Reflect's own `CONSENSUS_FLAG_SPREAD` constant in `reflect/scoring.ts`, so the two systems flag disagreement on the same threshold.

### A.3 Surfacing in the report — IMPLEMENT TO SPEC

- When `result.borderline`, show a small caveat next to the tier badge ("near-call: " + `result.borderlineNote`), so a reader does not over-interpret a rounding-level difference.
- On the per-competency table, mark rows where `lowAgreement` is true (a quiet icon + tooltip "raters disagree"). Show `lowAgreementCount` in the header summary.
- These are caveats, not blockers. The tier still stands.

---

## B. Slice 5 — readiness to IDP linkage

**Goal:** turn a readiness verdict into a development plan. The engine already computes the per-competency gaps to the role bar and the blind spots; this pipes them into the IDP that Reflect already has (`reflect_idps`), so every "not Ready Now" candidate leaves with the specific competencies to work on. This is the step that makes it a succession **program**, not just a verdict. No new table.

### B.1 What to write

`reflect_idps` (keyed by `reflect_participants.id`) has:
- `top_priorities jsonb` — `[{competency_id, behaviors[], why}]`
- `action_plan jsonb` — `[{action, owner, deadline, support}]`
- `success_measures text`, `target_review_date date`, `status`.

Resolve the participant for the candidate via the candidate-to-participant bridge (`reflect_participants.candidate_id`, migration 00080).

### B.2 Priority selection rule — IMPLEMENT TO SPEC

From the engine's `ReadinessResult.competencies`, choose the development priorities in this order, capped at (say) the top 5:
1. Any competency with `knockoutTriggered` (must-haves below the bar) — always first.
2. Then the largest below-target gaps among covered competencies (most negative `gap`), preferring `priority === 'high'` on ties.
3. Include any `selfFlag === 'blind_spot'` competency (Others below target while Self at or above) — high coaching value.
Skip competencies already at or above target (`gap >= 0`).

For each chosen competency emit a `top_priorities` entry: `competency_id` (the **catalogue** id), a short `why` (for example "high-priority must-have, " + gap, or "blind spot: rated well below how it is seen by self"), and `behaviors` pulled from that competency's development tips (`development_tips` / behavioural indicators already seeded in the catalogue).

Scaffold `action_plan` with one row per priority (action and support blank for the coach to complete), set `status = 'draft'` and a `target_review_date` (for example +90 days), and leave it for the coach to finalise. Do not auto-finalise.

### B.3 Surface

Add a "Generate development plan" action on the per-candidate readiness report (Slice 3) that runs B.2 and upserts the `reflect_idps` draft, then links to the existing Reflect IDP editor so the coach can refine it. Keep it admin/coach-gated.

---

## C. Optional — per-competency target proficiency

**Why:** today the target is a single role-level proficiency (`role_profiles.default_target_proficiency`). A proper job analysis with SDAIA often sets a *different* bar per competency (a Compliance lead needs Ethical Conduct at 5, Digital Fluency at 3). The engine already supports this: `RoleCompetencyReq.target` is per-competency. This just gives those values a home.

### C.1 Migration — IMPLEMENT EXACTLY

**`00085_role_competency_target.sql`**

```sql
-- Optional per-competency target bar; falls back to role default when null.
ALTER TABLE role_profile_competencies
  ADD COLUMN target_proficiency numeric(2,1)
    CHECK (target_proficiency IS NULL OR target_proficiency BETWEEN 1 AND 5);
```

### C.2 Wiring — IMPLEMENT TO SPEC

In `readiness-data.ts` step 2, set each `RoleCompetencyReq.target = role_profile_competencies.target_proficiency ?? role_profiles.default_target_proficiency`. Surface the per-competency target as an optional field in the role-profile editor so SDAIA's job-analysis outputs can be entered. Nothing else changes; the engine already weights and gaps per-competency.

---

## Deployment order

1. Replace `readiness.ts` and `readiness.test.ts` with the delivered v2 (already in `src/lib/scoring/`). Run the suite — 7 cases pass.
2. Apply the config delta (A.1), regenerate types, add the two fields to the admin panel.
3. Add `othersSpread` derivation (A.2) and the report caveats (A.3).
4. Build the IDP linkage (B) on top of the Slice 3 report.
5. Optional: migration `00085` + role-profile editor field (C).

## Checklist

- [ ] readiness.ts v2 in; 7 tests pass; tiers unchanged from v1
- [ ] `borderline_band` + `rater_agreement_spread_max` columns + admin fields
- [ ] `othersSpread` derived from Reflect `by_group`; borderline + low-agreement shown in the report
- [ ] "Generate development plan" creates a `reflect_idps` draft from the gaps/blind spots; coach-editable
- [ ] (Optional) per-competency `target_proficiency` column + editor field; engine uses it when set
