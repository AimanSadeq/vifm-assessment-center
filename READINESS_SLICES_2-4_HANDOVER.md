# Succession Readiness — Slices 2 to 4 Handover for Claude Code

**Companion to** `READINESS_ENGINE_HANDOVER.md` (Slice 1: the engine, config, admin panel, and scoring glue). Do Slice 1 first; these build on it.

**Order (as requested):** Slice 2 (38-competency 360 seed) → Slice 3 (report) → Slice 4 (behavioral runner).

**Conventions** are the same as the Slice 1 doc: IMPLEMENT EXACTLY for schema/seeds, IMPLEMENT TO SPEC for UI. Reuse `createServiceClient`, `force-dynamic`, the i18n helpers, `auth_role() = 'admin'` RLS, and the existing admin/report/Reflect patterns. Migration numbers continue from Slice 1 (00078–00082); this doc uses 00083–00084. Renumber if taken.

**Verified facts this build relies on** (checked in the repo):
- The catalogue holds the live v2 framework: 8 clusters `c1000001-0000-0000-0000-00000000000N` and 38 competencies `a0000001-0000-0000-0000-0000000000NN` (NN = 01–38), names applied by UUID in `00070`. Domains/clusters/competencies all carry `name_ar`; competencies also carry `description` / `description_ar`.
- Reflect stores its framework in `reflect_frameworks` → `reflect_competencies` → `reflect_behaviors`. Rater roles: self, manager, peer, direct_report, skip_level, other. "Others" excludes self.
- The 360 scorer `computeParticipantScoring(participantId)` returns per-competency `others_mean` / `self_mean` keyed by the **Reflect** competency id and `name_en`.

---

## Slice 2 — 38-competency 360 framework seed

**Goal:** the 360 measures the same 38 competencies as the behavioral assessment, with each Reflect competency hard-linked to its catalogue competency.

### 2.1 The seed — IMPLEMENT EXACTLY (delivered, runnable)

Apply the delivered `supabase/migrations/00083_reflect_38_competency_360_framework.sql`. It:
- creates a template framework (stable id `f1000001-0000-0000-0000-000000000001`),
- inserts 38 `reflect_competencies` by **selecting from the catalogue** (names, Arabic, descriptions), setting `ac_competency_id` on each (the reliable mapping the engine uses),
- inserts one starter observer behavior per competency (the catalogue description, which is already third-person), so the 360 is immediately runnable.

It is idempotent and depends on `00079` (the `ac_competency_id` column). Run it after `00079`.

### 2.2 Expand behaviors from the shared item bank — IMPLEMENT TO SPEC

The starter gives one item per competency. Replace/extend to the full bank so the 360 has proper item coverage.

- **Source:** `docs/competency-self-report-cluster1.md` (Form A, normative Likert, 4 items per competency) and the clusters 2 to 8 companion. These are the same items the behavioral assessment serves.
- **Transform self → observer:** rewrite each first-person stem to third person. "I set direction beyond the immediate task" becomes "This person sets direction beyond the immediate task." Keep meaning and the reverse-keyed flag identical (note reverse items in a comment; the 360 form scores them the same way, `6 − raw`).
- **Insert** four behaviors per competency, aligned by `ac_competency_id`. Template:

```sql
-- One competency's four observer items (repeat per competency).
INSERT INTO reflect_behaviors (competency_id, level_tier, text_en, text_ar, source, display_order)
SELECT rc.id, 'all', v.text_en, v.text_ar, 'manual', v.ord
FROM reflect_competencies rc
JOIN (VALUES
  ('This person ...item 1...',        'يُظهر ...', 1),
  ('This person ...item 2 (R)...',    'يُظهر ...', 2),
  ('This person ...item 3...',        'يُظهر ...', 3),
  ('This person ...item 4...',        'يُظهر ...', 4)
) AS v(text_en, text_ar, ord) ON true
WHERE rc.framework_id = 'f1000001-0000-0000-0000-000000000001'
  AND rc.ac_competency_id = 'a0000001-0000-0000-0000-000000000001'; -- Forward Strategy Setting
-- Then delete the starter row (display_order = 1 placeholder) if you replaced it.
```

- After loading, sanity-check: every competency in the framework has 4 behaviors, and every `reflect_competencies.ac_competency_id` is non-null.

### 2.3 Combined-mode variant

For a **combined** engagement (the self lever), clone this template per engagement and disable the self-rater path so no self items are served in the 360. Standalone 360s keep the self-rater. This is the same lever wired in Slice 1 (`engagements.assessment_mode`).

---

## Slice 3 — Readiness report (per-candidate + cohort)

**Goal:** the surface stakeholders see. The engine computes; the report renders. No new tables (uses Slice 1's `readiness_results` if present, else computes live via `computeCandidateReadiness`).

### 3.1 Per-candidate report — IMPLEMENT TO SPEC

Route: `src/app/admin/engagements/[id]/readiness/[candidateId]/page.tsx` (server component). It calls the Slice 1 function and renders the result. Skeleton (adapt styling to the existing report/card components and i18n):

```tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { computeCandidateReadiness } from "@/lib/scoring/readiness-data";
import { READINESS_TIER_META } from "@/lib/scoring/readiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: { id: string; candidateId: string } };

export default async function ReadinessReportPage({ params }: Props) {
  const t = await getServerT();
  const r = await computeCandidateReadiness(params.id, params.candidateId);
  if (!r) return notFound();

  const meta = READINESS_TIER_META[r.status];

  return (
    <div className="space-y-6">
      {/* Headline tier (+ optional year label) */}
      <Card>
        <CardHeader><CardTitle>{meta.label}</CardTitle></CardHeader>
        <CardContent>
          <p>{meta.blurb}</p>
          {r.yearLabel && <p>Horizon: {r.yearLabel}</p>}
          {r.status !== "insufficient_data" && (
            <p>
              Weighted Others {r.weightedOthers?.toFixed(2)} vs target{" "}
              {r.weightedTarget?.toFixed(2)} (gap {r.overallGap?.toFixed(2)}).
              {r.knockoutApplied && " Capped by a high-priority knockout."}
            </p>
          )}
          <p>Coverage {(r.coveragePct * 100).toFixed(0)}% ({r.coveredCount}/{r.totalCount}).</p>
        </CardContent>
      </Card>

      {/* Per-competency: Others vs target, gap, knockout, self-vs-others flag */}
      <Card>
        <CardHeader><CardTitle>Competency detail</CardTitle></CardHeader>
        <CardContent>
          <table>
            <thead>
              <tr>
                <th>Competency</th><th>Priority</th><th>Others</th><th>Target</th>
                <th>Gap</th><th>Self</th><th>Self vs Others</th><th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {r.competencies.map((c) => (
                <tr key={c.competencyId}>
                  <td>{c.name}</td>
                  <td>{c.priority}</td>
                  <td>{c.othersMean?.toFixed(2) ?? "—"}</td>
                  <td>{c.target.toFixed(1)}</td>
                  <td>{c.gap?.toFixed(2) ?? "—"}</td>
                  <td>{c.selfMean?.toFixed(2) ?? "—"}</td>
                  <td>{c.selfOthersGap?.toFixed(2) ?? "—"}</td>
                  <td>{c.knockoutTriggered ? "knockout" : (c.selfFlag ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

Then style it: tier badge tone from `READINESS_TIER_META[...].tone` (emerald/sky/amber/rose/slate, the same tokens `talent-map.ts` uses), an SVG-only icon set, bilingual labels via `t(...)`, and a "blind spot" / "hidden strength" callout list built from `competencies.filter(c => c.selfFlag === "blind_spot" | "hidden_strength")`. For a downloadable version, reuse the PDF path used by `candidate_reports` / Reflect reports.

### 3.2 Cohort view — IMPLEMENT TO SPEC

Extend the existing Talent Map page `src/app/admin/engagements/[id]/talent-map/page.tsx`. It already renders the 9-box and heatmap from `consensus_ratings` + the legacy OAR. Add a readiness column sourced from the new engine:

- For each candidate in the engagement, get the tier from `readiness_results` (if Slice 1 persists snapshots) or by calling `computeCandidateReadiness`.
- Add a "Succession readiness" panel: count per tier (Ready Now / Ready Soon / Developing / Not Ready / Insufficient Data) and a per-candidate chip, using `READINESS_TIER_META` for labels and tones.
- Leave the existing 9-box axis maths (`PERFORMANCE_DOMAINS` / `POTENTIAL_DOMAINS`) untouched. The engine readiness and the 9-box are complementary: the box is performance-vs-potential, the tier is observed-vs-role-bar.

---

## Slice 4 — Behavioral self-assessment runner

**Goal:** the candidate-facing "I…" Likert on the 38, producing the per-competency self scores that combined mode reads (Slice 1, `readiness-data.ts` step 6). Heaviest build; the readiness tier does not wait on it (Others drive the tier).

### 4.1 Storage — IMPLEMENT EXACTLY

**`00084_behavioral_assessment.sql`**

```sql
-- Candidate self-assessment sessions + item responses + per-competency rollup.
CREATE TYPE behavioral_assessment_status AS ENUM ('not_started','in_progress','submitted');

CREATE TABLE behavioral_assessment_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status        behavioral_assessment_status NOT NULL DEFAULT 'not_started',
  started_at    timestamptz,
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, candidate_id)
);

CREATE TABLE behavioral_assessment_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES behavioral_assessment_sessions(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  item_key      text NOT NULL,                 -- stable id of the item within the bank
  raw_score     smallint NOT NULL CHECK (raw_score BETWEEN 1 AND 5),
  is_reverse    boolean NOT NULL DEFAULT false,
  answered_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_key)
);
CREATE INDEX idx_bx_responses_session ON behavioral_assessment_responses(session_id);

-- Per-competency self rollup the readiness engine reads in combined mode.
CREATE TABLE behavioral_competency_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  self_score    numeric(3,2) NOT NULL,         -- mean of items, reverse already applied
  item_count    smallint NOT NULL,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, candidate_id, competency_id)
);
CREATE INDEX idx_bx_scores_candidate ON behavioral_competency_scores(engagement_id, candidate_id);

ALTER TABLE behavioral_assessment_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_assessment_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_competency_scores     ENABLE ROW LEVEL SECURITY;
-- Admin full access; add candidate self-access policies mirroring how the
-- existing candidate-facing tables (e.g. candidate_quiz_attempts) are scoped.
CREATE POLICY bx_sessions_admin  ON behavioral_assessment_sessions  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY bx_responses_admin ON behavioral_assessment_responses FOR ALL USING (auth_role() = 'admin');
CREATE POLICY bx_scores_admin    ON behavioral_competency_scores    FOR ALL USING (auth_role() = 'admin');
```

### 4.2 Scoring rule — IMPLEMENT EXACTLY

On submit: for each competency, `self_score = mean(item raw, with reverse items mapped 6 − raw)`. Upsert one `behavioral_competency_scores` row per competency. Cluster and domain rollups are means of competency scores via the existing `competencies` → `competency_clusters` → `competency_domains` hierarchy (do not store them; derive for display).

### 4.3 Runner UI — IMPLEMENT TO SPEC

- **Entry:** reuse the access-code / redeem pattern already used for candidate entry (the "20 access codes" flow). One session per candidate per engagement.
- **Items:** serve the shared bank, self-perspective ("I…"), grouped by competency, ideally one cluster per step. Save responses as the candidate progresses (`in_progress`), allow resume.
- **Submit:** set `submitted`, run 4.2, write `behavioral_competency_scores`.
- **i18n + icons:** bilingual EN/AR, RTL-aware, SVG-only icons.

### 4.4 Wire into combined mode — IMPLEMENT TO SPEC

In `readiness-data.ts` step 6 (Slice 1): when `engagements.assessment_mode = 'combined'`, set each `ObservedCompetency.selfMean` from `behavioral_competency_scores` (by engagement + candidate + competency) instead of the 360 self. In `standalone`, keep the 360 `self_mean`. The 360 Others-mean is unchanged either way.

---

## Deployment order

1. Slice 1 (engine + config + admin + glue), per its handover.
2. Migration `00083` (360 framework seed) after `00079`. Expand behaviors (2.2). Verify 38 competencies, 4 behaviors each, all `ac_competency_id` set.
3. Slice 3 report: per-candidate page, then the cohort panel on the talent-map page.
4. Migration `00084` (behavioral storage). Build the runner (4.3), then wire combined-mode self (4.4).
5. `npm run build` / `npm run lint` clean. Regenerate `database.ts` after each migration batch.

## Checklist

- [ ] 00083 applied; 38 competencies linked by `ac_competency_id`; behaviors expanded to 4/competency
- [ ] Combined-mode 360 clone serves no self items
- [ ] Per-candidate readiness report renders tier, gap table, self-vs-Others, blind spots; bilingual; SVG icons
- [ ] Cohort panel on talent-map shows tier counts + per-candidate chips; 9-box maths untouched
- [ ] 00084 applied; runner serves the bank, scores per competency with reverse handling, writes `behavioral_competency_scores`
- [ ] Combined mode reads self from `behavioral_competency_scores`; standalone reads 360 self

## Open inputs from Aiman

- **Item bank sign-off** before 2.2 and Slice 4 (both serve the same bank).
- **SDAIA role profile(s)** before any real readiness verdict (Slice 1 open item).
- **Arabic item wording** for the 360 behaviors and the runner.
