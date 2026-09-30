# VIFM Assessment Center - Methodology Brief

How the assessment-centre framework was built, where the competencies come from, and what we're doing about validity.

---

## 1. Why this exists

Consultants and clients ask three questions about any assessment-centre programme: *Where did the competencies and exercises come from? How do you know they measure what you say they measure? How will accuracy improve over time?* This brief answers those three questions for the VIFM Assessment Center (VIFM-AC).

It is the AC counterpart to the AI Readiness Compass methodology brief (`docs/ARA-Methodology-Brief.md`) and follows the same structure so the two products read consistently.

---

## 2. Construct definitions

### The framework

VIFM-AC measures behaviour against **21 competencies** (framework v2, active since 27 September 2026), each elaborated by behavioural indicators (**225 in total**, positive and negative) and development tips (**117**), organised into **8 clusters** under **four domains**:

- **THINKING** - reasoning, problem-solving, judgement, strategy.
- **RESULTS** - achievement, drive, execution, accountability.
- **PEOPLE** - interpersonal effectiveness, leadership, influence, communication.
- **SELF** - integrity, adaptability, resilience, self-management.

The domain → cluster → competency → indicator hierarchy is held in the database (`competency_domains`, `competency_clusters`, `competencies`, `behavioral_indicators`), so every competency has an explicit place in the model and every behavioural indicator rolls up to exactly one competency.

Framework v2 consolidated the earlier 41-competency, 9-cluster model (v1): 8 competencies carried over unchanged, 12 new ones each absorbed two or three v1 competencies, two knowledge competencies moved to the Technical pillar, and the Adaptability and Change cluster was retired. Nothing was deleted: a v1 competency is marked retired with a pointer to its successor, so results recorded against v1 still render, and every sitting records the framework version it was scored on. The v2 definitions, Arabic and behavioural indicators are with a chartered psychologist and subject-matter reviewers; any change they make becomes v3 the same way. Each competency also carries descriptive anchors for the points of the rating scale (see §3), currently under expert review.

### Why a behavioural framework

An assessment centre is a *method*, not a single test: trained assessors observe candidates in job-relevant exercises (in-trays, role-plays, group discussions, case analyses, presentations) and rate the behaviours they see against defined competencies. The validity of the method rests on (a) competencies defined before exercises are designed, (b) each exercise mapped to the competencies it is built to elicit, and (c) multiple independent observations per competency. The VIFM-AC framework encodes all three.

---

## 3. Competency & exercise development

### Sourcing

The competency model was authored by VIFM consultants drawing on the competency-modelling literature (§6) and refined against the behaviours consultants already use with clients. Each competency carries a definition and a set of positive/negative behavioural indicators that tell an assessor what "good" and "poor" look like in observable terms.

### Exercise–competency mapping

Exercises are linked to the competencies they are designed to elicit through an explicit matrix (`exercise_competency_matrix`), so no competency is assessed by a single exercise and no exercise is scored against a competency it was not designed to surface. This matrix is the backbone of content validity (§4).

### Research anchors (new)

Every competency now carries a per-competency **validation-evidence trail** in the database (`competencies.validation_evidence`, migration 00068). Each trail anchors the competency to one or more published instruments / works from a curated, closed bibliography (§6), records a confidence level (`direct adaptation` / `construct-aligned` / `novel`), and is **human-verified** before it is surfaced on any client-facing deliverable. AI-proposed anchors stay internal until an admin signs off - the hallucination guard. Coverage is tracked live in the admin Evidence & Validity Map (`/admin/evidence-map`) and managed at `/admin/ac-evidence`.

### Rating format

Behaviours are rated on a **5-point competency rubric** (1–5), criterion-referenced to the behavioural-indicator anchors rather than to a norm group, with a descriptive anchor for each scale point per competency (`competency_scale_anchors`) and exercise-specific indicator examples for assessors. Ratings are stored per competency per assessor (`ratings`), preserving the raw observations behind every score. Competency ratings are agreed at a chaired integration meeting; for a **selection** centre the overall rating is then **calculated** as the weighted average of the agreed competency ratings, with weights fixed and approved before the centre, while development and succession centres reach it by discussion. This follows the BPS standard's requirement for an arithmetic integration rule in selection (§4).

---

## 4. Validity

### Content validity

Every exercise maps to defined competencies via `exercise_competency_matrix`, and every competency is elaborated by behavioural indicators. The framework was reviewed by VIFM consultants and the framework owner before exercises were accepted. This is the strongest evidence the programme holds today.

### Face validity

Competencies are expressed as observable behaviours (the indicators) rather than abstract traits, which is the bar for face validity. We have **not** yet run a formal face-validity study (structured respondent/assessor interviews documenting that each indicator is interpreted as intended); the map records this cell as *partial* until that study is documented.

### Construct validity

A formal construct-validity study (e.g., confirmatory factor analysis or a multitrait–multimethod analysis testing whether assessors rate *competencies* rather than *exercises* - the classic AC "exercise effect") has **not** been run. The framework is treated as a content-validated model, not an empirically confirmed factor structure, until that work is done. This is an honest, disclosed gap.

### Criterion validity

We rely on the published **meta-analytic** evidence for the criterion-related validity of the assessment-centre method (Gaugler et al., 1987; Arthur et al., 2003 - §6) rather than a local predictive study against VIFM client outcomes. We do not yet make a site-specific predictive-validity claim.

The structure for a local study now exists. For every rated participant the platform schedules a **6- and 12-month outcome follow-up** (`ac_outcome_followups`): whether the person went into the role, and the line manager's rating of their performance on the centre's own 1-5 scale, collected by VIFM from the client. The correlation between centre rating and later performance is computed from these and reported with its sample size: no figure is shown below 10 participants, it is marked an early indication below 30, and provisional below the standard's guide of about 100. Whether a client agrees to this collection is recorded per centre in the evaluation plan (`engagements.evaluation_plan`) and in the centre agreement.

### Alignment with the BPS standard

The programme was mapped clause by clause against the British Psychological Society's *Design and Delivery of Assessment Centres* (Division of Occupational Psychology, 2015; 195 clauses). Every requirement that can be met in the platform now is: purpose recorded per centre and driving the integration rule; a centre agreement and plan generated from the design; a participant joining pack, consent, adjustments, concerns and appeals; centre roles with competence records; staffing rules; a delivery log; exercise quality checks; fairness monitoring; a guidance note for decision makers with every set of reports; and the validity evidence described above, summarised per centre in an evidence pack. The clauses that remain open are those only data can close: a validation sample and the evaluations that run once centres have been delivered.

---

## 5. Reliability

### Inter-rater reliability

The platform records each assessor's rating per competency (`ratings`), so inter-rater agreement (ICC(2,1), two-way random, single measure) is **computed** from the audit trail, on complete cases only: the pair of assessors who co-rated the most participants, with no imputation of missing ratings. It is reported per centre in the evidence pack and pooled across centres in the assessor analytics console. This is the reliability evidence most natural to an observational method.

### Internal consistency

Cronbach's alpha is **not applicable** in the usual sense: AC scores are observational competency ratings, not responses to a multi-item scale. We therefore do not report alpha for AC and mark the cell *n/a* rather than *missing*.

### Test–retest reliability

Stability of competency ratings across repeated assessments is **not currently tracked**. A disclosed gap.

---

## 6. Reference frameworks & published instruments

Items, competencies and exercises were authored to content-align with established works; this is *content alignment*, not republication of a validated instrument, so we do not claim the source instruments' coefficients. The list below is what every per-competency validation-evidence trail anchors back to. Citations are deliberately limited to seminal / textbook-stable works to keep the bibliography defensible against spot-checks.

### Assessment-centre method & standards

- International Taskforce on Assessment Center Guidelines (2015). *Guidelines and ethical considerations for assessment center operations* (6th ed.). Journal of Management, 41(4), 1244–1273.
- Thornton, G. C., III, & Rupp, D. E. (2006). *Assessment centers in human resource management: Strategies for prediction, diagnosis, and development.* Lawrence Erlbaum.
- Gaugler, B. B., Rosenthal, D. B., Thornton, G. C., & Bentson, C. (1987). *Meta-analysis of assessment center validity.* Journal of Applied Psychology, 72(3), 493–511.
- Arthur, W., Jr., Day, E. A., McNelly, T. L., & Edens, P. S. (2003). *A meta-analysis of the criterion-related validity of assessment center dimensions.* Personnel Psychology, 56(1), 125–153.
- ISO 10667-1/2 (2020). *Assessment service delivery - Procedures and methods to assess people in work and organizational settings.* International Organization for Standardization.
- American Educational Research Association, American Psychological Association, & National Council on Measurement in Education (2014). *Standards for educational and psychological testing.* AERA.

### Competency modelling

- Spencer, L. M., & Spencer, S. M. (1993). *Competence at work: Models for superior performance.* Wiley.
- Boyatzis, R. E. (1982). *The competent manager: A model for effective performance.* Wiley.
- Campion, M. A., Fink, A. A., Ruggeberg, B. J., Carr, L., Phillips, G. M., & Odman, R. B. (2011). *Doing competencies well: Best practices in competency modeling.* Personnel Psychology, 64(1), 225–262.
- Bartram, D. (2005). *The Great Eight competencies: A criterion-centric approach to validation.* Journal of Applied Psychology, 90(6), 1185–1203.

### Domain-specific anchors

- **THINKING** - Schmidt, F. L., & Hunter, J. E. (1998). *The validity and utility of selection methods in personnel psychology.* Psychological Bulletin, 124(2), 262–274; Mumford, M. D., et al. (2000). *Leadership skills for a changing world.* Leadership Quarterly, 11(1), 11–35.
- **RESULTS** - McClelland, D. C. (1973). *Testing for competence rather than for intelligence.* American Psychologist, 28(1), 1–14; Locke, E. A., & Latham, G. P. (2002). *Building a practically useful theory of goal setting and task motivation.* American Psychologist, 57(9), 705–717.
- **PEOPLE** - Mayer, J. D., Salovey, P., & Caruso, D. R. (2008). *Emotional intelligence: New ability or eclectic traits?* American Psychologist, 63(6), 503–517; Yukl, G. (2012). *Effective leadership behavior.* Academy of Management Perspectives, 26(4), 66–85.
- **SELF** - Barrick, M. R., & Mount, M. K. (1991). *The Big Five personality dimensions and job performance: A meta-analysis.* Personnel Psychology, 44(1), 1–26; Pulakos, E. D., et al. (2000). *Adaptability in the workplace.* Journal of Applied Psychology, 85(4), 612–624.

> **A note on confidence.** Every competency was authored against its definition, not by lifting wording from these sources. The per-competency validation-evidence trail flags each anchor as `direct adaptation` vs `construct-aligned` vs `novel`, and is human-reviewed before publication.

---

## 7. Limitations & honest disclosures

- **No empirical factor structure yet.** Construct validity (incl. the exercise-vs-dimension question) and fairness/DIF analyses have not been run. The framework is content-validated, not empirically confirmed.
- **Criterion validity is method-level, not site-level.** We rely on published AC meta-analyses. The follow-up structure for a local study exists, but no centre has yet accumulated the follow-ups to report from, and about 100 participants are needed for a study with reasonable power.
- **Framework v2 content is under expert review.** Competency definitions, behavioural indicators and rating-scale anchors were drafted with AI assistance and are being reviewed by subject-matter experts and a chartered psychologist. Each report states the review status of the content used.
- **Rater effects are real.** Observational ratings carry leniency/halo risk. Assessor training and multi-assessor designs mitigate but do not eliminate it; inter-rater agreement is the reliability metric we report.
- **Test–retest stability is not yet tracked.**

---

## 8. Update cadence

- Competency framework: re-versioned as the framework owner revises it; the active framework is the source of truth for new assessments.
- Methodology brief: re-issued with each framework revision. This document is v1.1 (framework v2).
- Validation-evidence trails: reviewed continuously in `/admin/ac-evidence`; coverage tracked in `/admin/evidence-map`.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

## Reliability & Validity Evidence

Two kinds of evidence: **(A)** established coefficients for the *method* (the assessment-centre method and BARS), from the published meta-analytic literature; and **(B)** VIFM's own reliability procedures and their honest current status. We report (A) as evidence for the method, not as a claim about a VIFM-specific coefficient.

**A. Established coefficients for the method (published literature)**

- **Assessment-centre overall criterion validity:** meta-analytic operational validity **ρ ≈ .37** for predicting job performance (Gaugler, Rosenthal, Thornton & Bentson, 1987).
- **Dimension-level validity:** AC dimensions show meaningful but modest criterion validities (~**.25-.39** for the strongest), with the well-documented exercise-vs-dimension construct-variance caveat (Arthur, Day, McNelly & Edens, 2003).
- **Rating method:** Behaviourally Anchored Rating Scales reduce halo and leniency relative to graphic scales (Smith & Kendall, 1963).

**B. VIFM's own reliability - method, threshold, and current status**

- **Inter-rater reliability:** Intraclass Correlation (**ICC**; Shrout & Fleiss, 1979) across assessors, integrated to a consensus wash-up; target **ICC ≥ .70** (good agreement). Status: ICC is computed live per engagement wherever **≥ 2** assessors rate the same candidate-exercise; a stable cross-engagement figure will be published once **≥ 30** multi-rater engagements accrue.
- **Content validity:** each of the 21 competencies is observed in **≥ 2** exercises (the exercise-competency matrix; enforced at design time) - the documented coverage design. Criteria overlap is checked once 10 or more participants are rated on a pair (pairs correlating above 0.7 are flagged for merging, per the standard).
- **Criterion validity:** the correlation between centre rating and the 6/12-month manager performance rating, per centre, reported only with its sample size. Status: structure live since 30 September 2026; no follow-ups collected yet.

---

*VIFM Assessment Center · Methodology Brief v1.1 · Last updated 2026-09-30 (framework v2; BPS alignment; validity evidence structure).*
