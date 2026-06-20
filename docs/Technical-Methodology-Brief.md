# VIFM Technical Certification - Methodology Brief

How the technical certification test was built, where the items come from, and how the passing standard is set.

---

## 1. Why this exists

Clients ask three questions about any certification test: *Where did the items come from? How do you know the test covers the job? How was the pass mark set?* This brief answers those questions for the VIFM Technical Certification programme. It follows the structure of the AI Readiness Compass, Assessment Center and Fluent briefs so the product family reads consistently.

---

## 2. Construct definitions

Technical Certification measures **job-relevant knowledge and applied skill** within a defined technical domain. The content model is a taxonomy of **domains** (`tech_assessment_items.domain_key`), each broken into **skills** (`skill`). Every item targets exactly one domain and one skill, so a certificate maps to an explicit blueprint of what was tested.

The construct here is *content-defined*: the test claims to measure mastery of the domain's specified knowledge, not a latent psychological trait. That framing determines which validity evidence matters most - content validity and a defensible standard, rather than factor structure.

---

## 3. Item development

### Sourcing & format

Items are four-option single-best-answer multiple-choice questions (`question_en`, `options_en`, `correct_index`), optionally bilingual (`question_ar`, `options_ar`), with an `explanation_en` capturing why the key is correct (a review aid and learner-feedback payload). Each item has a `difficulty` (easy / medium / hard).

### Review workflow

Items move through an explicit SME review workflow - `draft → in_review → approved → rejected → retired` (`status`) - with the reviewer, reviewer name and timestamp recorded (`reviewed_by`, `reviewer_name`, `reviewed_at`, `review_notes`). Only `approved` items are eligible for a live certification test. `source` distinguishes `ai_generated` from `human_authored`; AI-generated items are never administered without passing human review.

### Research anchors (new)

Every item now carries a per-item **validation-evidence trail** (`tech_assessment_items.validation_evidence`, migration 00069). It anchors the item's domain to the content-validity / standard-setting literature (§6) from a curated, closed bibliography, records a confidence level, and is **human-verified** before it reaches any client-facing surface. Coverage is tracked in the Evidence & Validity Map and managed at `/admin/evidence/technical`.

### Light psychometrics

Each item accumulates administration statistics (`times_administered`, `times_correct`), giving a running p-value (difficulty) and the raw material for item analysis (discrimination, distractor performance) as volume grows.

---

## 4. Validity

### Content validity

This is the core defensibility of a knowledge test, and the programme's strongest evidence. Every item is domain- and skill-tagged against the taxonomy, and items pass SME review before they can be used. The next documented step is a formal content-validity ratio (Lawshe CVR) panel per domain, for which the SME-review trail already captures the necessary judgements.

### Face validity

Items are reviewed by subject-matter experts for realism and relevance; we mark this *partial* until a structured face-validity review is documented separately from the approval workflow.

### Criterion validity & the passing standard

The passing standard is documented per domain in `tech_assessment_cut_scores`: a minimum passing percentage (`pass_pct`), a defensibility floor on test length (`min_items` - a 3-item "test" cannot certify), and the **method and rationale** for how the standard was set (e.g., a modified-Angoff SME panel). A documented, criterion-referenced standard is the appropriate validity claim for a certification decision; we do not make a separate predictive claim against downstream job performance.

### Construct validity

Where item banks are large enough, **Rasch calibration** provides item-level construct evidence (difficulties ordering sensibly on a single scale). This is treated as supporting, not primary, evidence for a content-defined test.

---

## 5. Reliability

### Internal consistency

Cronbach's alpha (or KR-20 for dichotomous items) is **computable from the item bank** once a domain has enough administrations, and will be reported per domain. Pre-threshold, reliability is treated as a property of the item-development and review process.

### Inter-rater reliability

Scoring is **automated** (keyed MCQ), so inter-rater reliability is *n/a* for scoring. Rater agreement is relevant only to the standard-setting panel, which is documented in the cut-score rationale.

### Test–retest reliability

Stability across repeated administrations is **not currently tracked** - a disclosed gap (mitigated in practice by drawing fresh items from the bank per attempt).

---

## 6. Reference frameworks & published instruments

Items content-align with the works below; this is content alignment, not republication. The per-item validation-evidence trail anchors to these.

### Content validity & job analysis

- Lawshe, C. H. (1975). *A quantitative approach to content validity.* Personnel Psychology, 28(4), 563–575.
- Raymond, M. R. (2001). *Job analysis and the specification of content for licensure and certification examinations.* Applied Measurement in Education, 14(4), 369–415.
- Kane, M. T. (2013). *Validating the interpretations and uses of test scores.* Journal of Educational Measurement, 50(1), 1–73.
- American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). *Standards for educational and psychological testing.* AERA.
- National Commission for Certifying Agencies (2014). *Standards for the accreditation of certification programs.* Institute for Credentialing Excellence.

### Item writing & test construction

- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). *A review of multiple-choice item-writing guidelines for classroom assessment.* Applied Measurement in Education, 15(3), 309–333.
- Crocker, L., & Algina, J. (1986). *Introduction to classical and modern test theory.* Holt, Rinehart & Winston.
- Anderson, L. W., & Krathwohl, D. R. (Eds.) (2001). *A taxonomy for learning, teaching, and assessing: A revision of Bloom's taxonomy of educational objectives.* Longman.

### Standard setting / cut scores

- Cizek, G. J., & Bunch, M. B. (2007). *Standard setting: A guide to establishing and evaluating performance standards on tests.* Sage.
- Angoff, W. H. (1971). *Scales, norms, and equivalent scores.* In R. L. Thorndike (Ed.), Educational measurement (2nd ed., pp. 508–600). American Council on Education.

---

## 7. Limitations & honest disclosures

- **Content validity is process-based today.** The SME-review trail supports it; a formal per-domain CVR panel is the next documented step.
- **Cut-score quality depends on the panel.** A documented modified-Angoff (or equivalent) panel is required per domain; domains without a recorded method/rationale should not certify.
- **No fairness/DIF analysis yet.** Planned, not run.
- **No test–retest evidence yet.**

---

## 8. Update cadence

- Item bank: items added, reviewed and retired continuously; item statistics refresh as administrations accrue.
- Cut scores: re-set when a domain's blueprint changes; each standard records its method and date.
- Methodology brief: re-issued as the programme matures. This document is v1.0.
- Validation-evidence trails: reviewed in `/admin/evidence/technical`; coverage tracked in `/admin/evidence-map`.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

*VIFM Technical Certification · Methodology Brief v1.0 · Last updated 2026-06-07.*
