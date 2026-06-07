# VIFM Fluent (English) — Methodology Brief

How the English proficiency test was built, where the items come from, and what we're doing about validity.

---

## 1. Why this exists

Clients ask three questions about any proficiency test: *Where did the items come from? How do you know a "B1" really means B1? How does the test improve over time?* This brief answers those questions for VIFM Fluent, the CEFR-aligned English reading and listening assessment. It follows the structure of the AI Readiness Compass and Assessment Center briefs so the product family reads consistently.

---

## 2. Construct definitions

Fluent measures **receptive English proficiency** on two skills:

- **Reading** — comprehension of written passages (main idea, detail, inference, vocabulary in context).
- **Listening** — comprehension of spoken scripts at natural register.

Proficiency is reported against the **Common European Framework of Reference (CEFR)** bands (A1–C2). CEFR is a *criterion-referenced* scale: a level describes what a learner can do ("can-do" descriptors), not a percentile against other test-takers. Each item is tagged to a skill and carries an assigned CEFR band (`eng_fluent_items.skill`, `cefr_label`).

---

## 3. Item development

### Sourcing & format

Items are stored as structured stems (`eng_fluent_items.stem` — passage/script + question + options + correct index) tagged by skill and CEFR band. Each item is a single-best-answer multiple-choice question keyed to one correct option, the standard objective format for receptive-skill testing.

### CEFR alignment

Every item is authored or reviewed against the CEFR descriptors and the Companion Volume so the difficulty label is anchored to a published standard rather than an author's intuition. This is the primary content-validity claim (§4).

### Research anchors (new)

Every item now carries a per-item **validation-evidence trail** (`eng_fluent_items.validation_evidence`, migration 00069). It anchors the item's skill + level to the language-testing / CEFR literature (§6) from a curated, closed bibliography, records a confidence level, and is **human-verified** before it appears on any client-facing surface. Coverage is tracked in the Evidence & Validity Map and managed at `/admin/evidence/fluent`.

### Empirical calibration

The bank is designed for **Rasch (item-response-theory) calibration**: each item accumulates responses (`n_responses`) and, once enough data exists, receives a difficulty estimate (`irt_b`) and standard error (`irt_se`). Items move through a `draft → calibrating → live` status as they earn their statistics. Calibrated difficulties let the test report ability on a single interpretable scale and underpin adaptive item selection.

---

## 4. Validity

### Content validity

Each item is skill-tagged and CEFR-anchored, and the construct (receptive proficiency per skill) is defined before items are written. This is the strongest evidence the product holds today.

### Face validity

CEFR can-do statements give the test transparent face validity: a stakeholder can read the level descriptor and see what a score implies.

### Construct validity

We treat **Rasch item calibration** as the working construct-validity evidence: item difficulties ordering as the CEFR model predicts is empirical support for the difficulty construct. A full dimensionality study (confirming reading and listening behave as intended) is planned as the calibrated bank grows.

### Criterion validity

Fluent is a **proficiency measure**, not a selection predictor; we make no job-performance prediction claim, so criterion validity is marked *n/a* by design.

---

## 5. Reliability

### Internal consistency / measurement precision

Reliability is reported per skill from the Rasch model (test information / person separation reliability) once a skill's bank is calibrated. Pre-calibration we treat reliability as a property of the item-development process.

### Human–AI rating agreement

Where items or scoring are quality-checked against human ratings (`eng_fluent_human_ratings`), human–AI agreement (quadratic-weighted kappa) is logged with a ≥ .70 target, giving an auditable agreement statistic.

### Test–retest reliability

Stability across repeated administrations is **not currently tracked** — a disclosed gap.

---

## 6. Reference frameworks & published instruments

Items content-align with the works below; this is content alignment, not republication. The per-item validation-evidence trail anchors to these.

### Frameworks & general language-testing validity

- Council of Europe (2001). *Common European Framework of Reference for Languages: Learning, teaching, assessment.* Cambridge University Press.
- Council of Europe (2020). *CEFR — Companion volume.* Council of Europe Publishing.
- North, B. (2000). *The development of a common framework scale of language proficiency.* Peter Lang.
- Bachman, L. F. (1990). *Fundamental considerations in language testing.* Oxford University Press.
- Bachman, L. F., & Palmer, A. S. (2010). *Language assessment in practice.* Oxford University Press.
- Weir, C. J. (2005). *Language testing and validation: An evidence-based approach.* Palgrave Macmillan.
- Messick, S. (1989). *Validity.* In R. L. Linn (Ed.), Educational measurement (3rd ed., pp. 13–103). Macmillan.
- McNamara, T. F. (1996). *Measuring second language performance.* Longman.
- American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). *Standards for educational and psychological testing.* AERA.

### Reading

- Alderson, J. C. (2000). *Assessing reading.* Cambridge University Press.
- Khalifa, H., & Weir, C. J. (2009). *Examining reading: Research and practice in assessing second language reading.* Cambridge University Press.

### Listening

- Buck, G. (2001). *Assessing listening.* Cambridge University Press.
- Field, J. (2013). *Cognitive validity.* In A. Geranpayeh & L. Taylor (Eds.), Examining listening (pp. 77–151). Cambridge University Press.

---

## 7. Limitations & honest disclosures

- **Calibration is data-dependent.** Items without enough responses carry no empirical difficulty yet; their CEFR label is an authored judgement until `irt_b` is estimated.
- **Productive skills not covered.** Fluent assesses reading and listening (receptive skills). It does not measure speaking or writing.
- **No fairness/DIF analysis yet.** Differential item functioning across first-language groups is planned, not yet run.
- **No test–retest evidence yet.**

---

## 8. Update cadence

- Item bank: items are added and recalibrated continuously; difficulty estimates refresh as responses accrue.
- Methodology brief: re-issued as the bank matures. This document is v1.0.
- Validation-evidence trails: reviewed in `/admin/evidence/fluent`; coverage tracked in `/admin/evidence-map`.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

*VIFM Fluent (English) · Methodology Brief v1.0 · Last updated 2026-06-07.*
