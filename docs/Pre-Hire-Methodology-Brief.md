# VIFM Pre-Hire - Methodology Brief

*What Pre-Hire measures, how the composite is scored, what the screening report is for, and the one rule that governs every part of it: VIFM recommends, the client decides.*

---

## 1. Why this exists

Whenever an assessment informs a hiring decision, three questions follow it into the room: *What does the instrument actually measure? How is a single number derived from a candidate's answers? And what weight should the number be allowed to carry?* This brief answers those questions for VIFM Pre-Hire, the commercial pre-employment screening service that lets VIFM sell the Assessment Center instruments to client organisations as a structured, defensible shortlisting layer.

Pre-Hire produces a screening signal that supports a human decision. It is deliberately not a hiring decision, not an auto-reject, and not a standalone verdict on a candidate. The single most important design choice in the entire module is this: **the scoring code has no reject path.** A candidate is never declined by software. VIFM is the assessor and delivers a report; the engaged client makes the actual hiring call. Every other design choice documented below flows from that positioning.

---

## 2. What Pre-Hire measures

### An orchestration, not a new instrument

Pre-Hire does not invent a new test. It is an orchestration layer over instruments that already exist on the VIFM platform, assembled into a client-scoped, role-specific hiring funnel. Each stage in a requisition reuses an existing engine verbatim and soft-links back to that engine's own native result record rather than duplicating it. The three interactive screening stages are:

- **Quiz** - a competency and knowledge screen built by the VIFM quiz generator, bilingual, with the answer key stripped from the client payload so grading happens server-side. The normalised stage score is `round(100 * correct / total)`.
- **Fluent** - the full four-skill English placement (reading, listening, writing, speaking). Reading and listening are auto-scored; writing and speaking are scored against a CEFR rubric, optionally blended with pronunciation assessment. The CEFR outcome maps to a 0-100 scale (A1 toward 0, C2 toward 100).
- **CBI** - a structured competency-based interview run by the AI interviewer, capped at four candidate answers, producing a BARS 1-5 rating that maps to `round(((bars - 1) / 4) * 100)`.

A requisition's stage plan is an ordered list of entries, each carrying a `kind`, a `weight`, a `cut_score`, and a `required` flag. The default plan weights quiz 0.4 (cut 60), Fluent 0.3 (cut 50), and CBI 0.3 (cut 60), but a recruiter configures the plan per role.

### Defining "good" per role

What counts as a strong screening signal is defined per role, not globally. Each requisition is bound to a role profile and an explicit competency set, so the quiz items, the cut-scores, and the weighting all reflect the specific opening. This per-role calibration is what makes the composite meaningful rather than a generic aptitude number.

---

## 3. How it is scored

### From stages to a composite

Each completed stage contributes a normalised 0-100 score. The composite is a weighted average of those stage scores, computed in `computeComposite` ([src/lib/prehire/scoring.ts](../src/lib/prehire/scoring.ts)). Only stages with a positive weight contribute. Weights are normalised against the total weight of the weighted stages, so the applied weight for a stage is `weight / totalWeight`, and the composite is the sum of each weighted stage's `normalized * appliedWeight`, clamped to 0-100 and rounded to one decimal place.

The composite is **null until every weighted stage has been scored.** A partial profile produces no headline number. This is deliberate: a weighted average over an incomplete set of stages would understate or overstate a candidate, so the module shows no composite at all until the picture is complete.

### Per-stage pass and fail against the cut-score

Each stage is independently marked against its cut-score. A stage with no cut-score always passes; a scored stage passes when its normalised score is at or above the cut-score, and is `null` (not yet evaluated) until it has been scored. A stage marked `required` that falls below its cut-score is recorded as a required failure.

### The advisory recommendation (and the absence of "reject")

From the composite and the required-failure check, `recommendationFor` derives one of exactly four advisory bands - `advance`, `review`, `hold`, `incomplete` - using the default thresholds (advance at 70, review at 50):

- **incomplete** - the candidate has not finished every weighted stage, so no composite exists yet.
- **advance** - composite at or above 70 and every required stage at or above its cut-score.
- **review** - composite between 50 and 69, *or* a required stage below its cut-score. A failed required stage caps the signal here; it never drops the candidate out.
- **hold** - composite below 50. "Hold" means "low signal, a person should review," never "rejected."

There is no fifth band. A failed required stage caps the advisory signal at "review" or "hold" but never produces a decline. `rescoreCandidate` ([src/lib/prehire/candidate-access.ts](../src/lib/prehire/candidate-access.ts)) recomputes and persists the composite, recommendation, and status after each stage completes, and `rankByComposite` orders the shortlist highest-composite first with unscored candidates placed last. The ranking orders candidates for a human reviewer's attention; it does not gate anyone.

---

## 4. Deliverables

### The per-candidate screening report

The primary deliverable is a per-candidate screening report ([src/lib/reports/prehire-candidate-html.ts](../src/lib/reports/prehire-candidate-html.ts)), rendered as bilingual HTML and produced as a PDF. VIFM is the assessor, not the client, so this is the document VIFM downloads or emails to the engaged client. It surfaces:

- The advisory composite and the recommendation band, colour-toned for quick reading.
- A by-stage table: each stage's weight, normalised score, cut-score, and pass / below-cut / not-taken outcome.
- A "How this score is calculated" section that states the composite formula and lists all four advisory bands with the exact condition that triggers each one. Because the signal is derived automatically, the client is told precisely how.
- An explicit disclaimer on the face of the report: this is an advisory screening signal, not a hiring decision; a qualified VIFM reviewer interprets it alongside other evidence; no decision is ever made automatically.

The report is also marked confidential, for VIFM and the engaged client only.

### ATS export

A self-describing JSON or CSV export is available to administrators for handing structured results to a client's applicant-tracking system. The export recomputes the composite at export time rather than reading a stale stored value, and the CSV carries a UTF-8 byte-order mark so Arabic and accented names render correctly in spreadsheet tools. The export deliberately contains no demographic data.

---

## 5. What Pre-Hire is, and what it is not

- **It is a screening signal that supports a human decision.** It combines several existing instruments into a transparent, role-weighted composite to help a reviewer prioritise attention. That is genuinely useful, and it is all it is.
- **It is not a hiring decision and not an auto-reject.** The scoring code has no reject path. The advisory band caps how a screening conversation starts; it never closes one. A person makes every decision, and VIFM delivers a report - the client decides.
- **It does not duplicate the underlying instruments.** Each stage soft-links to its native record (quiz attempt, Fluent result, CBI session). Pre-Hire orchestrates; it does not re-implement.
- **Fluent is a screening signal until it is calibrated and proctored.** Per the build blueprint, the English placement is treated as an indicative screen, not a hard gate, until calibration evidence (target QWK at or above 0.70 against human raters) and a proctoring decision are in place.
- **Predictive validity is not claimed before it is evidenced.** The blueprint gates selling beyond the pilot on a completed validity and fairness study; the service does not overclaim a prediction it has not yet demonstrated.

These are not caveats added at the end. The "screening signal, not a hiring decision" line is printed on the face of every report, in both languages.

---

## 6. Defensibility: decoupled demographics, adverse-impact monitoring, and an immutable audit trail

The defensibility layer is what makes Pre-Hire sellable as a selection-context instrument, and it has three load-bearing parts.

### Voluntary, decoupled demographics

Self-identification is optional, GCC-appropriate (gender, age band, national-versus-expatriate), and entirely decoupled from scoring. It is collected on the completion screen *after* scoring, so it is visibly separated from any result. `prefer_not_to_say` is a first-class option. Individual demographic values never appear in the audit log, the ATS export, or any client-facing surface; they exist only to power the aggregate fairness view, and they are never imputed.

### Adverse-impact monitoring (the 4/5ths rule)

`computeAdverseImpact` ([src/lib/prehire/adverse-impact.ts](../src/lib/prehire/adverse-impact.ts)) applies the standard four-fifths screen used in employment selection. For each demographic dimension it computes the selection rate per group, takes the highest-selected group as the reference, and flags any group whose impact ratio (its rate divided by the reference rate) falls below 0.8. The framing is explicit and built into the analysis:

- It is a **monitoring signal, not proof of discrimination.** A flag warrants reviewing the instrument's job-relatedness, not an automatic change.
- **Small samples are surfaced, not hidden.** A group smaller than five members is marked as a small sample, and a dimension is marked underpowered when the pool is below thirty (the informal EEOC floor for a meaningful impact ratio), when any group is small, or when there are fewer than two groups. The module surfaces n and the underpowered caveat rather than implying false precision.
- The analysis basis prefers real human decisions and falls back to the advisory recommendation only when no decisions exist, and non-disclosed demographics are excluded from group rates rather than guessed at.

### Immutable audit trail

`logPrehireEvent` ([src/lib/prehire/audit.ts](../src/lib/prehire/audit.ts)) writes an append-only record of significant actions - requisition created, candidate added, invitation sent, consent given, stage completed, demographics submitted, report shared, export taken, and the legacy decision-recorded event. The underlying table is made immutable by a database update trigger; this module only ever inserts and reads. Crucially, the audit detail never contains demographic values, so the trail can be made readable to the client without leaking personal self-ID data. Logging is best-effort: it never throws and never blocks the primary operation, so an audit-write failure can never derail an assessment.

---

## 7. Access model, fairness, confidentiality and retention

### Candidate access without an account

Candidates have no platform account. Identity is always derived server-side from a per-candidate access token validated against a strict 36-character pattern ([src/lib/prehire/candidate-access.ts](../src/lib/prehire/candidate-access.ts)), and every read and write for the candidate flow goes through the service-role client - the same pattern the platform uses for its anonymous respondent flows. The candidate flow is auth-bypassed in middleware by prefix, which is why the administrator-only ATS export is deliberately placed outside that prefix so it cannot leak candidate data.

### Standards the service is held to

Pre-Hire is designed and operated in line with the recognised standards for the proper use of assessment in selection:

- **ITC Guidelines on Test Use** - on the responsibilities of those who select, administer and interpret assessments.
- **Standards for Educational and Psychological Testing** (AERA / APA / NCME, 2014) - for the discipline of matching claims to evidence and for the validity and fairness evidence the pilot is built to gather.
- **EEOC Uniform Guidelines on Employee Selection Procedures** - the four-fifths adverse-impact screen is implemented directly from the Uniform Guidelines, and the human-decides rule keeps the instrument on the right side of how a screening tool may be used in selection.

### Proper use and confidentiality

The human-in-the-loop control is structural, not cosmetic. There is no reject path in the code; the report states the corroborate-before-deciding rule on its face; the ATS export carries no demographics; and the fairness view is admin-only and aggregate. The screening report is a controlled deliverable that VIFM hands to the engaged client; per-candidate scores and answers are handled as confidential personal data throughout.

### Retention

Pre-Hire data follows the platform's default retention rule - a maximum of two years unless a contract extends it - consistent with UAE Federal Decree-Law No. 45 of 2021, the Saudi PDPL, and GDPR where applicable, and with the platform's consent-before-collection commitment. Consent is captured as a gate at the start of the candidate flow, before any stage runs, and the consent event is recorded in the audit trail.

---

## 8. Bilingual availability

Pre-Hire is fully bilingual. The candidate-facing stages run in English or Arabic, and the screening report is rendered in English and Gulf-appropriate Arabic, mirroring the same underlying data - the same composite, the same per-stage scores, the same band methodology - so a report reads identically in either language and a bilingual cohort is scored on one consistent basis. The CSV export carries a UTF-8 byte-order mark so Arabic names survive the round trip into spreadsheet tools. Arabic content is best-effort pending human review before high-stakes use, per project convention.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

*VIFM Pre-Hire - Commercial Pre-Employment Screening - Methodology Brief v1.0.*
