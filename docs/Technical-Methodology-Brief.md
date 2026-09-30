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

Two further controls apply to AI-drafted items. Every numerical item passes an automatic **key verification**: the generator recomputes the worked answer and drops any item whose key does not reproduce (added after reviewers found three wrong keys in a trial). And the SME review itself runs through structured workbooks: each item carries its ID, the reviewer records a verdict, their own answer and any correction, and an importer applies approvals and rejections while holding anything that changes a stem, an option or a key for a person to confirm. Every applied decision is written to an immutable review log (`sme_review_log`).

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

The passing standard is documented per domain in `tech_assessment_cut_scores`: a minimum passing percentage (`pass_pct`), a defensibility floor on test length (`min_items` - a 3-item "test" cannot certify), and the **method and rationale** for how the standard was set. A documented, criterion-referenced standard is the appropriate validity claim for a certification decision; we do not make a separate predictive claim against downstream job performance.

As at 30 September 2026, seven of the ten domains have a standard set by a subject-matter expert who worked through every approved item and estimated, for each, the share of barely competent practitioners who would answer it correctly, then averaged those estimates: the modified-Angoff procedure. The recorded standards are Accounting, Business Reporting and Finance at 70% with a minimum of 8 items, and Banking Operations and Risk Management 78%, Investment 76%, Real Estate 74% and Treasury 73%, each with a minimum of 10 items. Each expert's reasoning is stored with the standard. The experts advised against making any single skill must-pass while a domain has only about 15 items, to be revisited once a domain reaches 30 or more. Artificial Intelligence, Analytics and Business Intelligence are still in review.

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
- **Cut-scores rest on a single expert per domain.** The seven recorded standards were set by one subject-matter expert each, using a modified-Angoff procedure with the reasoning recorded. A multi-judge panel per domain is the next step; domains without a recorded method and rationale do not certify.
- **Item banks are small.** Certified domains hold 14 to 15 approved items each. Tests draw from the whole approved bank, so with banks this size a candidate may see only one or two items on a given skill, which is why no skill is yet mandatory.
- **No fairness/DIF analysis yet.** Planned, not run.
- **No test–retest evidence yet.**

---

## 8. Update cadence

- Item bank: items added, reviewed and retired continuously; item statistics refresh as administrations accrue.
- Cut scores: re-set when a domain's blueprint changes; each standard records its method and date.
- Methodology brief: re-issued as the programme matures. This document is v1.1.
- Validation-evidence trails: reviewed in `/admin/evidence/technical`; coverage tracked in `/admin/evidence-map`.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

## Reliability & Validity Evidence

Two kinds of evidence: **(A)** established coefficients for the *method* (work-sample and job-knowledge testing), from the published meta-analytic literature; and **(B)** VIFM's own reliability procedures and their honest current status.

**A. Established coefficients for the method (published literature)**

- **Work-sample / performance tests:** among the highest-fidelity predictors of job performance. The classic meta-analytic table places work samples at operational validity **ρ ≈ .54** (Schmidt & Hunter, 1998); a more conservative re-estimate reports **ρ ≈ .33** (Roth, Bobko & McFarland, 2005). We cite both honestly - the true value sits in this band.
- **Job-knowledge tests** (the MCQ layer): operational validity **ρ ≈ .48** (Schmidt & Hunter, 1998).
- Work samples also tend to show **lower adverse impact** than cognitive-only tests (Roth et al., 2005).

**B. VIFM's own reliability - method, threshold, and current status**

- **Item statistics:** per-item difficulty (**p-values**) and pass/fail counts are tracked, behind an SME approve / reject / retire review workflow. Status: light classical statistics only; **IRT / Rasch calibration is the documented Tier-2 path, not yet run**.
- **Cut-scores:** documented per domain with method and rationale; the CERTIFIED path assembles only SME-approved items above the cut, otherwise the result is explicitly INDICATIVE. Status: 7 of 10 domains certifiable (SME-set standards recorded 28-30 September 2026).
- **Key verification:** every AI-drafted numerical item has its key recomputed before it enters the bank; a whole-bank recheck of worked explanations on 28 September 2026 found one wrong key in 148 servable items, since corrected.
- **Delivery integrity:** single-use sessions, server-held answer key, options re-randomised per administration.

---

*VIFM Technical Certification · Methodology Brief v1.1 · Last updated 2026-09-30 (SME-set standards for seven domains; key verification; review log).*
