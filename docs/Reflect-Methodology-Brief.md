# VIFM Reflect 360 - Methodology Brief

How the 360-degree feedback instrument was built, where the competencies and behaviours come from, and what we're doing about validity.

---

## 1. Why this exists

Clients ask three questions about any 360 feedback tool: *Where do the competencies and behaviour items come from? How do you protect rater anonymity and data quality? What can - and can't - a 360 score be used for?* This brief answers those questions for VIFM Reflect 360. It follows the structure of the AI Readiness Compass, Assessment Center, Fluent and Technical briefs so the product family reads consistently.

---

## 2. Construct definitions

Reflect 360 measures **observable workplace behaviour** as seen by multiple rater perspectives (self, manager, peers, direct reports). The content model is a **framework → competency → behaviour** hierarchy:

- **Frameworks** (`reflect_frameworks`) - a competency set, either a reusable library template or an engagement-specific framework.
- **Competencies** (`reflect_competencies`) - the behavioural dimensions being rated.
- **Behaviours** (`reflect_behaviors`) - the concrete, observable items raters respond to, each tied to one competency and optionally scoped to a level tier.

Reflect is explicitly a **developmental feedback** instrument. It tells a participant how their behaviour is perceived across rater groups, to drive an individual development plan - not to rank or select people.

---

## 3. Competency & behaviour development

### Sourcing & format

Competencies carry a name and definition (`name_en`, `description_en`); behaviours are observable statements (`text_en`) tied to a competency via `competency_id`. Each behaviour records its `source` (`manual` vs `ai_generated`); AI-suggested behaviours carry a rationale (`ai_rationale`) and are reviewed before use. Behaviours can be scoped by `level_tier` so a framework can present level-appropriate items.

### Research anchors (new)

Every competency now carries a per-competency **validation-evidence trail** (`reflect_competencies.validation_evidence`, migration 00069). It anchors the competency to the multisource-feedback / competency-modelling literature (§6) from a curated, closed bibliography, records a confidence level, and is **human-verified** before it appears on any client-facing report. Coverage is tracked in the Evidence & Validity Map and managed at `/admin/evidence/reflect`.

### Behavioural anchoring

Items are written as observable behaviours rather than trait adjectives, following the behaviourally-anchored rating-scale (BARS) tradition (§6). This keeps ratings grounded in what a rater actually saw, which is the foundation of both face validity and rater reliability.

---

## 4. Validity

### Content validity

Every behaviour maps to exactly one competency, and competencies are defined before behaviours are written. The framework owner reviews the competency set per engagement. This is the strongest evidence the product holds today.

### Face validity

Behavioural anchors give raters concrete statements to respond to; we mark this *partial* until a structured face-validity review (documenting that raters interpret each behaviour as intended) is recorded.

### Construct validity

A formal construct-validity study (factor structure of the competency model; convergent/discriminant patterns across rater sources - multitrait–multimethod) has **not** been run. The framework is content-validated, not empirically confirmed - an honest, disclosed gap.

### Criterion validity

Reflect is a **developmental** instrument; we make no selection or job-performance prediction claim, so criterion validity is *n/a* by design. The published 360 literature is candid that multisource ratings are best used for development, not high-stakes decisions (§6).

---

## 5. Reliability

### Inter-rater reliability

This is the reliability dimension most natural to a 360. Multiple raters respond per participant, and reports are gated by an **anonymity threshold (≥ 3 raters per group)** so individual raters can't be identified and rating candour is protected. Within-group agreement (and the meaningful self–other gap) is computable from the response data (`reflect_responses`) and is interpreted per the multisource-feedback literature (raters in different roles legitimately see different behaviour, so perfect agreement is neither expected nor desirable).

### Internal consistency

Per-competency internal consistency is **not currently computed**; it can be derived from behaviour-level responses once response volume per framework is sufficient. A disclosed gap.

### Test–retest reliability

Stability across repeated 360 cycles is **not currently tracked** - a disclosed gap (re-survey cycles make it computable in future).

---

## 6. Reference frameworks & published instruments

Competencies and behaviours content-align with the works below; this is content alignment, not republication. The per-competency validation-evidence trail anchors to these.

### Multisource (360) feedback method & psychometrics

- Bracken, D. W., Timmreck, C. W., & Church, A. H. (Eds.) (2001). *The handbook of multisource feedback.* Jossey-Bass.
- Conway, J. M., & Huffcutt, A. I. (1997). *Psychometric properties of multisource performance ratings: A meta-analysis of subordinate, supervisor, peer, and self-ratings.* Human Performance, 10(4), 331–360.
- Smither, J. W., London, M., & Reilly, R. R. (2005). *Does performance improve following multisource feedback? A theoretical model, meta-analysis, and review of empirical findings.* Personnel Psychology, 58(1), 33–66.
- Atwater, L. E., & Yammarino, F. J. (1992). *Does self–other agreement on leadership perceptions moderate the validity of leadership and performance predictions?* Personnel Psychology, 45(1), 141–164.
- DeNisi, A. S., & Kluger, A. N. (2000). *Feedback effectiveness: Can 360-degree appraisals be improved?* Academy of Management Executive, 14(1), 129–139.

### Behavioural rating scales & rater accuracy

- Smith, P. C., & Kendall, L. M. (1963). *Retranslation of expectations: An approach to the construction of unambiguous anchors for rating scales.* Journal of Applied Psychology, 47(2), 149–155.
- Woehr, D. J., & Huffcutt, A. I. (1994). *Rater training for performance appraisal: A quantitative review.* Journal of Occupational and Organizational Psychology, 67(3), 189–205.
- Murphy, K. R., & Cleveland, J. N. (1995). *Understanding performance appraisal: Social, organizational, and goal-based perspectives.* Sage.

### Competency modelling

- Campion, M. A., Fink, A. A., Ruggeberg, B. J., Carr, L., Phillips, G. M., & Odman, R. B. (2011). *Doing competencies well: Best practices in competency modeling.* Personnel Psychology, 64(1), 225–262.
- Bartram, D. (2005). *The Great Eight competencies: A criterion-centric approach to validation.* Journal of Applied Psychology, 90(6), 1185–1203.
- American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). *Standards for educational and psychological testing.* AERA.

---

## 7. Limitations & honest disclosures

- **Developmental use only.** Reflect is not validated for selection, promotion or pay decisions, and should not be used for them.
- **Self-report and rater perception.** Scores reflect *perceptions* of behaviour; rater leniency, politics and halo are real. Anonymity gating and behavioural anchors mitigate but do not eliminate them.
- **No empirical factor structure or internal-consistency report yet.** Both are computable as response volume grows; neither is published today.
- **No test–retest evidence yet.**
- **No fairness/DIF analysis** - marked *n/a* given the non-selection use, but group-difference reporting would need care if use ever changed.

---

## 8. Update cadence

- Frameworks & behaviours: curated per engagement; library templates revised as the competency models evolve.
- Methodology brief: re-issued as the product matures. This document is v1.0.
- Validation-evidence trails: reviewed in `/admin/evidence/reflect`; coverage tracked in `/admin/evidence-map`.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

## Reliability & Validity Evidence

Two kinds of evidence: **(A)** established coefficients for the *method* (multi-source / 360-degree feedback), from the published meta-analytic literature; and **(B)** VIFM's own reliability procedures and their honest current status.

**A. Established coefficients for the method (published literature)**

- **Self-other agreement:** meta-analytic self-supervisor / self-peer **r ≈ .35** (Harris & Schaubroeck, 1988). Low-to-moderate agreement is expected and *informative* in 360 feedback - the self-vs-others gap is the signal, not measurement error.
- **Multi-source design** reduces single-rater bias and idiosyncrasy (Bracken, Timmreck & Church, 2001).
- **Impact:** 360 feedback produces small but reliable performance improvement, moderated by feedback acceptance and follow-up (Smither, London & Reilly, 2005, meta-analysis).

**B. VIFM's own reliability - method, threshold, and current status**

- **Content validity:** behaviours are decomposed from the *client's own* values / competencies (consultant-reviewed), then rated by Self, Manager, Peer and Direct Report on a 5-point frequency scale.
- **Anonymity threshold (min-n, default 3):** group means and verbatims are withheld until a rater group reaches the threshold - protecting rater candour and data quality.
- **Internal consistency** per competency (across its behaviours) is computable as rater volume accrues; target **α ≥ .70**. Self-vs-others gap and year-on-year deltas are computed today.

---

*VIFM Reflect 360 · Methodology Brief v1.0 · Last updated 2026-06-07.*
