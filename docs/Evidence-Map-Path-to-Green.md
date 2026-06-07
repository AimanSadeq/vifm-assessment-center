# Evidence & Validity Map — Path to Green

A working plan for closing the remaining non-green cells on the admin Evidence & Validity Map (`/admin/evidence-map`). It is deliberately honest: some cells close with a document, some close themselves once data accrues, and some need a real empirical study and cannot be written into existence. A few "red" cells are arguably *not applicable* and should be reclassified rather than chased.

The map's cell vocabulary: **documented** (defensible evidence today) · **partial** (some evidence / computable but not signed off) · **missing** (a genuine gap) · **n/a** (not applicable to this instrument's design/use). Cells marked *live* compute their own status from the database and flip automatically when a threshold is met.

Instruments: AC (Assessment Center) · ARC-Org · ARC-Ind · Fluent · Technical · Reflect · Psy (Psychometrics).

---

## Snapshot (12 categories × 7 instruments = 84 cells)

| Bucket | Count | Closes by |
|---|---:|---|
| Documented (static) | 23 | — already green |
| Live / data-driven | 13 | accruing data + (for anchors) human verification |
| Partial | 16 | a document, a sign-off, or a threshold |
| Missing | 21 | an empirical study, data, or reclassification |
| n/a (by design) | 11 | — not a gap |

The fastest, highest-leverage move is **Bucket 1** — it's entirely within your control today and turns the 7 "research anchors" cells green without waiting for anything.

---

## Bucket 1 — Verify the research anchors (do now, no waiting)

**Cells:** "Item / competency research anchors" — all 7 instruments (live).
**Goes green when:** ≥ 80% of each instrument's constructs have a *human-verified* anchor (`anchorCell` ratio ≥ 0.8). Below that it shows amber (some verified) or red (none).
**Action:** the bulk-generate + verify workflow is built and deployed. For each instrument: open its console (`/admin/ac-evidence`, `/ara/admin/questions`, `/admin/evidence/{fluent|technical|reflect|psy}`), tap **Generate AI drafts**, then **Accept & verify** each (spot-checking the citations). Requires `ANTHROPIC_API_KEY` on the server.
**Owner:** VIFM admin. **Effort:** hours, not weeks. **Dependency:** none.

---

## Bucket 2 — Closeable with a document or sign-off (writeable now)

These need no new data — just a written artefact, like the methodology briefs we just shipped.

| Cell(s) | Now | To green |
|---|---|---|
| Face validity — AC, Technical, Reflect, Psy | partial | Run + document a structured face-validity review (3–5 SME/respondent interviews per instrument confirming each item/indicator is interpreted as intended). Log it as `docs/{Instrument}-Face-Validity-Review.md`. A shared protocol template would make this repeatable. |
| Technical manual — Psy | partial | Promote `docs/psychometrics-proposal.md` from draft to a finished `Psychometrics-Methodology-Brief.md` matching the other six briefs. |

**Owner:** consulting team (interviews) + admin (write-up). **Effort:** ~1 day per instrument. **Dependency:** access to a few SMEs/respondents.

---

## Bucket 3 — Automatic once data accrues (already wired)

These cells are already live; they flip themselves when the sample threshold is reached (`THRESHOLDS` in `metrics.ts`). No code needed — only volume.

| Cell(s) | Threshold | Driver |
|---|---|---|
| Construct validity / CFA — ARC-Ind | N ≥ 200 completed individual responses | Free Personal Snapshot intake |
| Internal consistency (α) — ARC-Org | N ≥ 50 org assessments | Org engagements |
| Internal consistency (α) — ARC-Ind, Psy | N ≥ 200 responses | Snapshot / psy sessions |
| Inter-rater (ICC) — AC | ≥ 1 rating present (then report ICC) | Assessor sessions logged |
| Norms — Psy | norm rows loaded (target N ≥ 200/group) | Norming intake (see Bucket 4) |

**Note:** reaching the threshold makes the statistic *computable* (cell → partial). Turning it fully green still needs the computed coefficient to clear the quality bar (e.g. α ≥ .80) and be signed off. Wiring the actual α/CFA/ICC computation to run on the accrued data is a small follow-up once volume exists.
**Owner:** automatic. **Effort:** none (data collection only).

---

## Bucket 4 — Needs a real empirical study (plan + data + analysis)

These are the honest red cells. They can't be documented away; they require accumulated responses and a statistical analysis. Group them into one validation programme rather than chasing cell-by-cell.

| Category | Instruments still missing | What it takes |
|---|---|---|
| Construct validity / CFA | AC, ARC-Org, Reflect, Psy | N ≥ ~200 per model; run CFA / MTMM; publish loadings, fit indices, any item revisions. For AC this is the classic exercise-vs-dimension study. |
| Test–retest reliability | AC, Fluent, Technical, Reflect, Psy (+ compute for ARC) | Re-administer to a stable subsample ~2–4 weeks apart; correlate. ARC already has the re-administration *links* (`prior_assessment_id` / `prior_attempt_id`) — it needs the computation, not new plumbing. |
| Fairness / DIF | AC, ARC-Org, ARC-Ind, Fluent, Technical, Psy | Collect a demographic field; run DIF (Mantel-Haenszel / logistic / Rasch DIF). The Psy adverse-impact engine is reusable across instruments. |
| Criterion validity | Psy | A predictive study against an outcome (job performance / supervisor rating). Only worth it if Psy is used for selection. |
| Norms (GCC) | ARC-Org, ARC-Ind | Accumulate a representative GCC reference sample; publish percentiles per band. |

**Owner:** VIFM + (ideally) an external psychometric reviewer. **Effort:** quarters, gated on data volume. **Sequencing:** prioritise CFA on whichever instrument hits N first (likely ARC-Ind via the free Snapshot), since the analysis pipeline then transfers to the others.

---

## Bucket 5 — Honest reclassification candidates (your call)

A few cells are marked **missing** but are arguably **n/a by design** — reclassifying them is more honest than leaving a red "gap" we never intend to close. These are claims judgements, so they need your sign-off before I change the map:

| Cell | Now | Proposed | Rationale |
|---|---|---|---|
| Criterion validity — ARC-Org, ARC-Ind | missing ("not claimed — developmental tool") | **n/a** | Identical rationale to Reflect's criterion cell, which is already `na("developmental feedback")`. If the Compass is developmental, criterion validity isn't a gap — it's out of scope. |

Everything else currently red is a real, intended-to-close gap and should stay red until the work in Buckets 2–4 is done.

---

## Recommended order

1. **Bucket 1 now** — verify anchors across all seven instruments (turns 7 cells green this week).
2. **Bucket 5** — confirm the two reclassifications (turns 2 cells from red to honest grey).
3. **Bucket 2** — face-validity reviews + finish the Psy brief (turns ~5 cells green over a few days each).
4. **Bucket 3** — keep intake flowing; wire the α/CFA/ICC computation when the first instrument crosses threshold.
5. **Bucket 4** — stand up one validation programme, CFA-first on the highest-N instrument, and let the pipeline transfer.

---

## What this does *not* claim

This plan does not turn the whole map green on paper. The empirical cells (Bucket 4) stay red until the science is done — and that honesty is itself the credibility signal. A reviewer trusts a map that openly shows what's still missing far more than one that's uniformly green.

---

*VIFM Evidence & Validity Map · Path to Green · Last updated 2026-06-07.*
