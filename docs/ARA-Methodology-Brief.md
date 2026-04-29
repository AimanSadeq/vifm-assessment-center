# VIFM AI Readiness Compass — Methodology Brief

How the assessment was built, where the items come from, and what we're doing about validity.

---

## 1. Why this exists

Consultants and clients ask three questions about any psychometric instrument: *Where did the items come from? How do you know they measure what you say they measure? How will accuracy improve over time?* This brief answers those three questions for the VIFM AI Readiness Compass.

---

## 2. Construct definitions

### Two scoring planes

The Compass measures AI readiness on two distinct planes:

**Organisational (8 pillars).** *Strategy · Data · Technology · Talent · Culture · Governance · Operations · Model Management.* Used for Department, Division, and Enterprise stages. A respondent answering on this plane reports on the organisation's posture, not their own.

**Individual (4 factors).** *AI Sense-Check · AI Working Practice · AI Collaboration · AI Adaptive Mindset.* Used for the Personal Snapshot, the consultant-led Personal Deep-Dive, and the optional individual layer in any organisational engagement (Mode C). A respondent answering on this plane reports on their own behaviour.

### Why two planes

The org-side instrument fits widely-used GCC regulatory and industry frameworks (UAE PDPL, NCA ECC, SDAIA NDGF, etc.) — readiness here is largely a property of policy, capability, and governance. The individual-side instrument captures the behavioural skills literature on workplace AI adoption — readiness here is a property of how a person engages with the tools in front of them. The two planes inform each other but answer different questions.

---

## 3. Item development

### Sourcing

The current production bank (v1.1, 218 items) was developed through three rounds:

1. **Initial drafting.** Items were authored by VIFM consultants drawing on (a) the VIFM-AC behavioural framework — 38 competencies × 249 indicators — for face validity to consultants who already use that framework with clients, (b) reference frameworks listed in §6, and (c) field questions consultants frequently ask in pre-assessment workshops.
2. **AI-assisted expansion.** A subset of items was generated with the assistance of large language models against a structured prompt that supplied the construct definition and forced specific answer-anchor patterns. Every AI-suggested item was reviewed by at least one consultant before inclusion. Items that didn't pass review were discarded — no AI-only items shipped.
3. **Bilingual rewrite.** Every item was authored or rewritten in Gulf Arabic (not pan-Arabic) to keep idiom and register suitable for the GCC audience. Arabic is the source of truth for the AR field, not a back-translation.

### Coverage

Items are tagged at the database level to a pillar (org-side) or a factor (individual-side). The mapping is enforced as a foreign-key constraint, so every active item has a known target construct — no orphan items.

For the individual-side, the four factors map onto the existing VIFM-AC four-domain framework (THINKING / RESULTS / PEOPLE / SELF), and each factor lists the 3–4 behavioural competencies it draws from. This explicit competency lineage lets a consultant trace any factor score back to the development tips that exist for those AC competencies (the same tips that drive the AC Learning Plan PDF).

### Format

All items are 5-point Likert (`1 — Strongly Disagree` through `5 — Strongly Agree`) for the individual-side, and a 5-point capability rubric (initial · developing · defined · managed · optimised) for the organisational-side. Score maps live in the same `ara_questions` row as the option labels, so scoring is reproducible from the question bank version snapshot taken at assessment creation.

---

## 4. Validity

### Content validity

Every item is mapped to exactly one construct (a pillar or a factor). The construct definitions in §2 were reviewed by VIFM consultants and the AC framework owner before items were accepted. A second-round review checked that each construct had at least four items measuring it, so the score is not over-reliant on a single behavioural facet.

### Face validity

Items use observable behaviours (e.g., "I check AI-generated content for factual errors before relying on it") rather than abstract attributes. Respondents and consultants in pre-pilot workshops reported they could explain in their own words what each item was asking, which is the bar for face validity.

### Construct validity

Construct validity (does the four-factor model actually carve nature at its joints?) requires a confirmatory factor analysis with N ≥ 200 completed responses on the individual-side bank. We are accumulating responses passively through the free Personal Snapshot at `/ara/personal/start` and will run the CFA — and publish the loadings, fit indices, and any item revisions that result — once the threshold is met. Pre-CFA, the four-factor model is treated as a content-validated heuristic, not an empirically validated structure. Deep-dive (Mode B) and Mode C reports already note this disclosure.

### Criterion validity

The Compass is a developmental and diagnostic instrument, not a hiring screen. We do not currently make claims about predictive validity (does an Embedded score predict on-the-job AI productivity?) and we do not recommend the Compass be used for selection decisions until that work is done.

---

## 5. Reliability

### Internal consistency

Cronbach's alpha will be reported per factor and per pillar once N ≥ 200 individual responses and N ≥ 50 organisational responses. Pre-publication, we treat reliability as a property of the item-development process (multiple items per construct, expert-reviewed) rather than a property of an empirical sample.

### Inter-rater reliability (org-side Phase 2)

Where two or more consultants validate scores in the Phase 2 workshop, the system records both the auto-scored maturity band and the consultant-validated band. Inter-rater agreement is measurable from this audit trail and will be reported in the consultant analytics console once N ≥ 30 multi-rater Phase 2 sessions are complete.

### Test-retest reliability

The platform supports annual reassessment via the `prior_assessment_id` link (org-side) and the `prior_attempt_id` link (individual-side). Once we have multiple reassessments per organisation, test-retest correlations will be computed and surfaced in the year-on-year comparison page of the report.

---

## 6. Reference frameworks

### Regulatory frameworks calibrated against

**UAE (7):** Federal Decree-Law No. 45 of 2021 (PDPL) · NCA Essential Cybersecurity Controls · DCAI · ADDA · UAE AI Strategy 2031 · NESA · TDRA AI Ethics

**Saudi Arabia (9):** SDAIA NDGF · NCA ECC · NDGA · DCAI Health · SDAIA AI Ethics · Vision 2030 · Cyber Security Framework · Cloud Computing Regulatory Framework · NDMO

Each framework is mapped to specific organisational pillars; the report's Compliance section shows per-framework coverage based on the pillar scores.

### Underlying assessment-design standards

- ISO 10667 — Assessment of People in Work and Organisational Settings (Parts 1 and 2)
- International Taskforce on Assessment Center Guidelines (6th Edition) — applied to the related VIFM-AC product, framework consistency carries forward
- Standards for Educational and Psychological Testing (AERA / APA / NCME, 2014) — referenced for evidence-based item development

---

## 7. Limitations & honest disclosures

- **Self-report bias.** Both the org-side and individual-side instruments are self-report. We provide a perception-vs-reality analysis on Stage 2/3 reports (where consultants run a validation workshop) and a distortion-detection layer that flags uniform-tap or speed-clicking patterns. Neither fully eliminates the bias inherent to self-report.
- **Norm-group is GCC-skewed.** The reference distribution is being accumulated across UAE and Saudi respondents. Comparing a non-GCC respondent against the norm group may produce misleading percentile claims; we don't render such comparisons today.
- **The AI landscape moves fast.** The bank version is dated. The active version is recorded on every assessment so reports remain reproducible, but we re-author roughly half the items every 12–18 months as the underlying technology and norms shift.

---

## 8. Update cadence

- Question bank: re-versioned annually. Each version is immutable once activated; assessments lock to the version active at their creation time.
- Methodology brief: re-issued with each bank version. This document is v1.1.
- Norm groups: refreshed quarterly once the size threshold is reached.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

*VIFM AI Readiness Compass · Methodology Brief v1.1 · Last updated 2026-04-30.*
