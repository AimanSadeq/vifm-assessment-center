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

## 6. Reference frameworks & published instruments

### Regulatory frameworks calibrated against

**UAE (7):** Federal Decree-Law No. 45 of 2021 (PDPL) · NCA Essential Cybersecurity Controls · DCAI · ADDA · UAE AI Strategy 2031 · NESA · TDRA AI Ethics

**Saudi Arabia (9):** SDAIA NDGF · NCA ECC · NDGA · DCAI Health · SDAIA AI Ethics · Vision 2030 · Cyber Security Framework · Cloud Computing Regulatory Framework · NDMO

Each framework is mapped to specific organisational pillars; the report's Compliance section shows per-framework coverage based on the pillar scores.

### Underlying assessment-design standards

- ISO 10667 — Assessment of People in Work and Organisational Settings (Parts 1 and 2)
- International Taskforce on Assessment Center Guidelines (6th Edition) — applied to the related VIFM-AC product, framework consistency carries forward
- Standards for Educational and Psychological Testing (AERA / APA / NCME, 2014) — referenced for evidence-based item development

### Published instruments the items content-align with

For every construct the Compass measures, items were authored to content-align with one or more established measurement instruments from the published research literature. This is *content alignment* — items adapt the construct, not the wording — so we do not claim the same psychometric coefficients as the source instruments. The list below is what every per-item validation-evidence trail anchors back to. Citations are deliberately limited to seminal / textbook-stable works to keep the bibliography defensible against spot-checks.

#### Individual layer — four factors

**AI Sense-Check (THINKING).** Critical evaluation of AI output, hallucination detection, domain validation.
- Long, D., & Magerko, B. (2020). *What is AI literacy? Competencies and design considerations.* Proceedings of the 2020 CHI Conference on Human Factors in Computing Systems, 1–16.
- Ng, D. T. K., Leung, J. K. L., Chu, S. K. W., & Qiao, M. S. (2021). *Conceptualizing AI literacy: An exploratory review.* Computers and Education: Artificial Intelligence, 2, 100041.

**AI Working Practice (RESULTS).** Productive hands-on use of AI in real workflows.
- Davis, F. D. (1989). *Perceived usefulness, perceived ease of use, and user acceptance of information technology.* MIS Quarterly, 13(3), 319–340.
- Venkatesh, V., Morris, M. G., Davis, G. B., & Davis, F. D. (2003). *User acceptance of information technology: Toward a unified view (UTAUT).* MIS Quarterly, 27(3), 425–478.
- Brynjolfsson, E., Li, D., & Raymond, L. R. (2025). *Generative AI at work.* Quarterly Journal of Economics. — productivity outcomes from real-world AI use.

**AI Collaboration (PEOPLE).** Helping the team move with AI; shaping shared norms.
- Venkatesh, V., Thong, J. Y. L., & Xu, X. (2012). *Consumer acceptance and use of information technology: Extending the unified theory of acceptance and use of technology (UTAUT2).* MIS Quarterly, 36(1), 157–178. — social influence in tech adoption.
- Wenger, E. (1998). *Communities of practice: Learning, meaning, and identity.* Cambridge University Press. — knowledge sharing within practice communities.

**AI Adaptive Mindset (SELF).** Curiosity, openness to relearning, responsible posture.
- Parasuraman, A., & Colby, C. L. (2015). *An updated and streamlined Technology Readiness Index: TRI 2.0.* Journal of Service Research, 18(1), 59–74.
- Dweck, C. S. (2006). *Mindset: The new psychology of success.* Random House. — growth-mindset theory.

#### Organisational layer — eight pillars

**Strategy.** AI vision, business alignment, executive sponsorship.
- Davenport, T. H., & Ronanki, R. (2018). *Artificial intelligence for the real world.* Harvard Business Review, 96(1), 108–116.
- Iansiti, M., & Lakhani, K. R. (2020). *Competing in the age of AI.* Harvard Business Review Press.

**Data.** Quality, accessibility, lineage, governance, sovereignty.
- DAMA International (2017). *DAMA-DMBOK: Data Management Body of Knowledge* (2nd ed.). Technics Publications.
- EDM Council (2020). *Data Management Capability Assessment Model (DCAM).* Enterprise Data Management Council.

**Technology.** Compute, MLOps platforms, integration, vendor selection.
- Sculley, D., Holt, G., Golovin, D., et al. (2015). *Hidden technical debt in machine learning systems.* Advances in Neural Information Processing Systems (NeurIPS) 28, 2503–2511.
- Lwakatare, L. E., Raj, A., Bosch, J., Olsson, H. H., & Crnkovic, I. (2019). *A taxonomy of software engineering challenges for machine learning systems: An empirical investigation.* International Conference on Agile Software Development (XP).

**Talent.** Skills inventory, hiring, retention, training programmes.
- World Economic Forum (2025). *Future of Jobs Report 2025.* WEF, Geneva. — workforce skills demand projections.
- OECD (2024). *AI, data governance and privacy: Synergies and areas of international co-operation.* OECD Publishing.

**Culture.** Adoption mindset, change readiness, psychological safety with AI.
- Westerman, G., Bonnet, D., & McAfee, A. (2014). *Leading Digital: Turning Technology into Business Transformation.* Harvard Business Review Press.
- Tellis, G. J., Prabhu, J. C., & Chandy, R. K. (2009). *Radical innovation across nations: The preeminence of corporate culture.* Journal of Marketing, 73(1), 3–23.

**Governance.** Ethics, risk frameworks, model cards, audit trail.
- National Institute of Standards and Technology (2023). *AI Risk Management Framework 1.0 (AI RMF 1.0).* NIST AI 100-1.
- ISO/IEC 42001:2023. *Information technology — Artificial intelligence — Management system.* International Organization for Standardization.

**Operations.** Day-to-day AI deployment patterns; incident response.
- Software Engineering Institute, Carnegie Mellon (2010). *CMMI for Services, Version 1.3.*
- Forsgren, N., Humble, J., & Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps.* IT Revolution Press. — DORA metrics on delivery performance.

**Model Management.** Version control, monitoring, retraining, drift detection.
- Breck, E., Cai, S., Nielsen, E., Salib, M., & Sculley, D. (2017). *The ML test score: A rubric for ML production readiness and technical debt reduction.* IEEE International Conference on Big Data, 1123–1132.
- Mitchell, M., Wu, S., Zaldivar, A., et al. (2019). *Model cards for model reporting.* Proceedings of the 2019 ACM Conference on Fairness, Accountability, and Transparency (FAT*), 220–229.

> **A note on confidence.** Every item was authored against the construct definition, not by lifting wording from these sources. Where an item is a close adaptation of a published scale item (rather than a novel item exploring the same construct), the per-item validation-evidence trail in the admin question bank flags the confidence as `direct adaptation` versus `construct-aligned` versus `novel`. This trail is human-reviewed before publication.

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
