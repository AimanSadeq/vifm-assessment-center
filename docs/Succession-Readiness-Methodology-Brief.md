# VIFM Succession Readiness - Methodology Brief

**Owner:** VIFM Assessment Center · **Status:** Draft for client review ·
**Companion engine:** `src/lib/scoring/readiness.ts` (config-driven, unit-verified).
**Sits alongside:** the AC and AI Readiness Compass methodology briefs.

---

## 1. Why this exists

Succession decisions answer one question: who can step into a critical role, and how soon. This brief documents how VIFM turns assessment evidence into a defensible readiness verdict for a named target role, so a client can see exactly how the answer is produced and where its limits are. It is written for HR and executive sponsors, not only for psychometricians.

## 2. Construct definitions

**The framework.** Readiness is measured against the VIFM behavioural competency framework: 4 domains (Thinking, Results, People, Self), 8 clusters, and 38 competencies, each scored on a 5-point behaviourally anchored scale (1 Significant Gap to 5 Role Model, with 3 Meets Requirement as the working bar). The framework is VIFM-authored and owned.

**Two instruments, one spine.** Two instruments measure the same 38 competencies, so their scores are directly comparable:
- a **behavioural self-assessment** (the candidate, first-person), and
- a **360** (manager, peer, direct-report, and other observers, third-person).

Both draw on a single shared item bank, served self-perspective in the assessment and observer-perspective in the 360.

## 3. Instrument development

**Shared item bank.** Each competency carries a small set of normative (Likert) items, some reverse-keyed to guard against acquiescence. A competency score is the mean of its items; clusters and domains are means of their competencies.

**Self versus observer.** The same item content is reworded by perspective ("I set direction…" / "This person sets direction…"). This keeps the self and others measuring the identical construct, which is what makes a self-versus-others comparison meaningful.

**Rater design.** The 360 uses 4 to 6 external raters across rater categories plus, in standalone use, the candidate. When the assessment and the 360 are combined for one candidate, the self is collected once via the assessment and the 360 runs observers-only, so the candidate never self-rates twice.

## 4. The readiness model

**Others drive the verdict.** The readiness tier is driven by the 360 Others view, the more objective signal for "can this person operate at the target level." The self-assessment never moves the tier; it is differenced against Others to surface self-awareness (over-rating, under-rating, blind spots, hidden strengths), which informs development, not the verdict.

**Gap to the role, not an absolute.** Readiness is the distance between the candidate's weighted Others profile and the **target role profile**: the role's critical competencies, each weighted by importance, benchmarked to the role's target proficiency. Competencies the role does not require do not dilute the result.

**Tiers.** The weighted gap maps to four tiers: Ready Now (at or above the bar), Ready Soon (just short), Developing (moderate gaps), Not Ready (substantial gaps). An optional year-horizon layer (for example 0 to 2 years, 3 to 5 years) can be switched on per client; it is a presentation label derived from the tier, not a measured quantity, and is deliberately separated from the maths to avoid implying false precision.

**Guardrails.** A high-priority "knockout" caps the tier when a must-have competency sits well below target, so a strong average never fast-tracks someone failing an essential. A coverage floor returns "Insufficient Data" rather than a verdict when too few competencies were rated. Advisory flags mark borderline cases (a gap sitting on a tier boundary) and low rater agreement (observers disagreeing sharply), so near-calls and noisy evidence are visible rather than hidden behind a clean label.

**Tunability.** Every threshold, the knockout rule, the coverage floor, the advisory bands, and the year labels are configurable by an administrator without code changes, so the model can be calibrated to a client's risk posture and signed off before use.

## 5. Validity

**Content validity.** Competencies and items are anchored to the target role through job analysis (critical-incident interviews and competency card-sort with role-holders and their leaders), and reviewed by subject-matter experts for relevance and clarity. Until that job analysis is completed for a given client, the role profile is provisional and the brief says so.

**Construct validity.** The self and 360 measure the same competencies, allowing convergence and self-other discrepancy to be examined. The four-domain structure separates performance-facing (Results, People) from potential-facing (Thinking, Self) capability, consistent with the talent-map axes.

**Criterion validity.** The standard to which readiness aspires is prediction of subsequent role success. That evidence is accumulated over time against promotion and performance outcomes; it is not claimed from design alone.

## 6. Reliability

**Internal consistency.** Multi-item competency scales allow per-scale reliability (Cronbach's alpha) once a response sample exists.

**Inter-rater reliability.** The 360 uses multiple raters per competency; agreement is monitored, and sharp disagreement is surfaced as a low-agreement flag rather than averaged away.

**Stability.** Re-assessment over time supports test-retest checks and tracks development between cycles.

## 7. Reference frameworks and standards

The methodology is built to align with established assessment standards: the *Standards for Educational and Psychological Testing* (AERA, APA, NCME); ISO 10667 (assessment service delivery); and the ITC Guidelines (test use, and test adaptation and translation, relevant to the bilingual English and Arabic delivery). Commercial competency frameworks may be cited as benchmarks the model was compared against, never as sources it was drawn from.

## 8. Limitations and honest disclosures

- Readiness is an evidence-based estimate, not a guarantee of future performance.
- A verdict is only as good as its two client-specific inputs: the target role profile and the threshold calibration. Both require sign-off; defaults are a starting point, not a finding.
- Year horizons are an HR-facing convention, not a measured time-to-ready.
- Validity and local norms are earned through job analysis and outcome studies; design and clean authorship reduce risk but are not a substitute for that evidence.
- 360 ratings carry rater bias; the model mitigates this with multiple raters, anonymity thresholds, and agreement flags, but cannot eliminate it.

## 9. Update cadence and contact

Reviewed each assessment cycle and whenever the framework, item bank, or thresholds change. Questions and calibration requests: VIFM Assessment Center.

## 10. Reliability & Validity Evidence

Two kinds of evidence: **(A)** established coefficients for the *methods* combined here, from the published literature; and **(B)** VIFM's own reliability procedures and their honest current status. Succession Readiness has no items of its own - it is a weighted computation over Persona (self) and Reflect 360 (others) against a target role - so it inherits the evidence of those instruments.

**A. Established coefficients for the methods (published literature)**

- **Self-other agreement** (Persona self vs Reflect 360 others): meta-analytic **r ≈ .35** (Harris & Schaubroeck, 1988) - the gap between self and others is the informative signal.
- **Behavioural self-report → performance:** Five-Factor operational validities **ρ ≈ .10-.23** (Barrick, Mount & Judge, 2001).
- **Potential identification:** combining performance, behaviour and role-fit follows the applied potential / succession literature (Silzer & Church, 2009).

**B. VIFM's own reliability - method, threshold, and current status**

- **Inherited reliability:** the Cronbach's **α**, QWK and ICC pipelines (targets **≥ .70**) of the underlying Persona and Reflect 360 instruments apply here (see those briefs).
- **Convergent design:** triangulating a self-view, an others-view and an explicit role target strengthens a single-source inference.
- **Status:** a development-planning signal, not a selection decision. Predictive validity (does a readiness tier predict a successful transition?) is not claimed pending a local longitudinal study.

---

*VIFM Succession Readiness · Methodology Brief v1.0 · Last updated 2026-06-30.*
