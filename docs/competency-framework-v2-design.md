# VIFM-AC Competency Framework v2 — Design Document (Draft)

**Status:** Draft for SME review · **Owner:** VIFM Assessment Center ·
**Goal:** Replace the v1 framework (which adopts Korn Ferry Leadership Architect
competency names and definitions) with a **genuinely original, independently
authored** framework that VIFM owns outright.

> ⚠️ **Read this first — what "original" requires.**
> This document keeps the v1 *scaffold* (4 domains → 8 clusters → ~38
> competencies) and re-authors all wording from scratch. **Re-wording alone is
> not sufficient** to make the framework original or to clear the IP question.
> True originality is established in **Phase 1 (Job Analysis)**, where the
> evidence must be allowed to **drop, merge, add, and re-split** competencies so
> the final set is demonstrably derived from VIFM's own role data — not a
> one-to-one relabelling of the prior set. Everything below is a **starting
> scaffold to diverge from**, not a final framework.

---

## 1. Purpose & Principles

VIFM-AC needs a competency model that is (a) **owned by VIFM** (no third-party
IP in names, definitions, or behavioural indicators), (b) **applicable across
sectors** — a universal core framework with optional sector-specific item packs —
and (c) **defensible to clients** as research- and job-analysis-grounded.

Design principles:

1. **Clean-room authorship.** All names, definitions, and behavioural anchors
   are written from underlying *constructs* and primary sources — not adapted
   from any proprietary framework's text.
2. **Construct overlap is expected and acceptable.** Capabilities such as
   "communicating clearly" or "building trust" are shared professional
   vocabulary that no party owns. What must be original is VIFM's **structure,
   names, and expression**.
3. **Universal core + sector packs.** The framework (domains, clusters,
   competencies, definitions) is **sector-agnostic** and reusable across
   industries. Situational items (SJTs) have a **sector-neutral base**, with
   **optional sector packs** (e.g., finance & banking) layered on for higher
   fidelity. See `sector-packs/README.md`.
4. **Evidence-led, not rename-led.** The competency *set* is provisional until
   Phase 1 job analysis confirms, revises, or replaces it.
5. **Standards-aligned.** Built to satisfy AERA/APA/NCME *Standards*, ISO 10667,
   and the ITC Guidelines (Test Use; Test Adaptation/translation), consistent
   with VIFM's existing psychometrics posture.

---

## 2. Methodology & Clean-Room Statement

**Authoring method for this draft:** competencies are derived top-down from each
cluster's underlying capability area, drawing on the general
industrial/organisational psychology literature on managerial and leadership
competence and on VIFM's own finance curriculum — **not** by paraphrasing an
existing commercial framework. Where a construct naturally resembles one in a
common framework, that is incidental construct overlap, not derivation.

**IP posture going forward:**
- v1 (`00002_seed_competencies.sql`) uses Korn Ferry Leadership Architect names
  and definitions verbatim. v2 removes all of that text.
- Korn Ferry (and SHL UCF, etc.) may still be cited as **benchmarks** the model
  was *compared against* — never as a source it was *drawn from*.
- **Legal review is still required** before go-to-market. Clean-room authorship
  materially reduces risk; it is not a legal opinion.

**Validity is not established by this document.** Originality ≠ validity. The
"grounded in research / job analysis" claim is earned in Phases 1, 3, and 5
(below), not by drafting.

---

## 3. Architecture (retained 4 → 8 scaffold)

The four domains map to the two Talent-Map axes already wired in
`src/lib/scoring/talent-map.ts` (**Performance = RESULTS + PEOPLE**,
**Potential = THINKING + SELF**), so retaining them keeps the engineering ripple
small.

> **Optional further-distancing step:** the four domain *labels*
> (THINKING / RESULTS / PEOPLE / SELF) echo a common four-quadrant taxonomy. If
> you want maximum visible distance from any single commercial model, the labels
> can be renamed (e.g., *Cognitive · Delivery · Interpersonal · Intrapersonal*)
> at low cost. Default for this draft: **keep the existing labels.**

| Domain | Original cluster (v2) | Capability area |
|---|---|---|
| **THINKING** | Strategic & Commercial Reasoning | Direction-setting, business/financial judgement |
| | Innovation & Complexity | Original thinking, sense-making, digital/data |
| **RESULTS** | Delivery & Execution | Getting things done, accountability, process |
| | Adaptability & Change | Operating amid uncertainty and change |
| **PEOPLE** | Influence & Communication | Persuading, communicating, relating |
| | Leading & Developing Others | Building, coaching, and aligning teams |
| **SELF** | Integrity & Character | Ethics, self-insight, courage |
| | Growth & Personal Effectiveness | Learning, composure, sustainability |

---

## 4. Competencies (v2 draft — original names & definitions)

> 38 competencies retained for scaffold parity. **Phase 1 is expected to change
> this list.** Each definition is original and finance-contextualised.

### THINKING

**Cluster 1 — Strategic & Commercial Reasoning**
1. **Forward Strategy Setting** — Anticipates how markets, regulation, and
   client needs will shift, and converts that foresight into clear strategic
   direction.
2. **Commercial & Market Awareness** — Reads the competitive and economic
   landscape of financial services to spot opportunities and risks that advance
   organisational goals.
3. **Financial Literacy & Acumen** — Interprets statements, ratios, and
   capital/liquidity indicators and uses them to weigh trade-offs and justify
   decisions.
4. **Critical Analysis** — Breaks down ambiguous, data-heavy problems, tests
   assumptions, and weighs evidence to reach well-reasoned conclusions.
5. **Sound Judgement** — Makes timely, balanced decisions under incomplete
   information, accounting for risk, stakeholders, and second-order consequences.

**Cluster 2 — Innovation & Complexity**
6. **Creative Problem-Solving** — Generates and tests original approaches that
   improve products, processes, or client outcomes rather than defaulting to
   precedent.
7. **Navigating Complexity** — Makes sense of high-volume, interdependent,
   sometimes conflicting information to define and act on problems.
8. **Systems & Global Perspective** — Considers the wider system —
   cross-border, cross-function, macro-economic — when framing issues and
   weighing impact.
9. **Digital & Data Fluency** — Applies digital tools, automation, and data
   analysis to improve how financial work gets done and decisions get made.

### RESULTS

**Cluster 3 — Delivery & Execution**
10. **Proactive Initiative** — Moves on opportunities and tough challenges early
    and with energy, rather than waiting to be directed.
11. **Outcome Ownership** — Drives work through to measurable results,
    sustaining effort and standards even under difficult conditions.
12. **Accountability for Commitments** — Holds self and others to what was
    promised, following through transparently on deadlines and quality.
13. **Planning & Prioritisation** — Sequences and resources work so the most
    important commitments are met in line with organisational goals.
14. **Process Optimisation** — Designs and improves workflows for efficiency and
    control, with continuous improvement and without sacrificing compliance.

**Cluster 4 — Adaptability & Change**
15. **Operating Through Uncertainty** — Stays effective and decisive when
    direction, data, or conditions are unclear or shifting.
16. **Learning by Doing** — Experiments when facing unfamiliar problems and
    adjusts quickly, treating both wins and failures as information.
17. **Resilience Under Pressure** — Recovers from setbacks, sustained workload,
    and adversity while maintaining performance and composure.
18. **Mobilising Around Purpose** — Articulates a compelling sense of direction
    that connects people's work to a larger goal and motivates action.

### PEOPLE

**Cluster 5 — Influence & Communication**
19. **Clear & Adaptive Communication** — Conveys complex financial and strategic
    content clearly, tailoring message and mode to the audience.
20. **Persuasion & Buy-in** — Builds well-reasoned, audience-aware cases that win
    genuine support and commitment, not just compliance.
21. **Constructive Conflict Handling** — Surfaces and resolves disagreement
    directly and calmly, preserving relationships and momentum.
22. **Principled Negotiation** — Reaches durable, mutually workable agreements
    through preparation, dialogue, and fair trade-offs.
23. **Relationship Networks** — Builds and sustains useful internal and external
    relationships that create access, insight, and influence.

**Cluster 6 — Leading & Developing Others**
24. **Coaching & Talent Growth** — Develops others toward their potential and the
    organisation's needs through feedback, stretch, and support.
25. **Building Cohesive Teams** — Forms teams with shared identity and purpose
    that combine diverse strengths to deliver together.
26. **Cross-Functional Collaboration** — Partners across units and disciplines to
    achieve shared objectives over local interests.
27. **Trust & Credibility** — Earns confidence through honesty, consistency, and
    follow-through, becoming someone others rely on.
28. **Interpersonal Adaptability** — Adjusts style and approach in the moment to
    fit the person and situation without losing authenticity.

### SELF

**Cluster 7 — Integrity & Character**
29. **Self-Insight** — Uses feedback and reflection to understand own strengths,
    limits, and impact, and acts on that understanding.
30. **Emotional Regulation & Empathy** — Recognises and manages own emotions and
    reads others', responding in ways that fit the situation.
31. **Principled Courage** — Raises difficult issues and says what needs to be
    said, even at personal or political cost.
32. **Ethical Conduct** — Acts honestly and fairly, within the spirit as well as
    the letter of professional and regulatory standards.
33. **Cultural & Inclusive Sensitivity** — Understands and respects diverse norms
    and perspectives, and works inclusively across them.

**Cluster 8 — Growth & Personal Effectiveness**
34. **Adaptive Learning Capacity** — Learns rapidly from new and first-time
    situations and applies the lessons to perform in unfamiliar conditions.
35. **Continuous Self-Development** — Actively seeks growth through formal and
    informal channels and applies it to raise own performance.
36. **Composure Under Stress** — Stays calm, clear, and constructive when under
    pressure or scrutiny.
37. **Sustainable Wellbeing** — Manages energy and the demands of work and life
    to sustain performance over time.
38. **Resource Mobilisation** — Secures and deploys people, budget, and tools
    effectively to get work done.

---

## 5. Behavioural Anchored Rating Scale (BARS) — template + worked example

VIFM-AC uses a **5-point BARS** (per the Blueprint, §6). Authoring template:

| Level | Label | Meaning |
|---|---|---|
| 5 | Role Model | Consistently exceeds the target-role requirement; multiple strong examples |
| 4 | Above Requirement | Above requirement in most situations; clear positive evidence |
| 3 | Meets Requirement *(target)* | Adequate; meets the role requirement, may be inconsistent |
| 2 | Development Needed | Below requirement; limited or mixed evidence |
| 1 | Significant Gap | Little or no positive evidence; negative indicators present |

**Worked example — Competency 1, *Forward Strategy Setting*:**

- **5 — Role Model:** Frames a multi-year direction that integrates regulatory,
  competitive, and macro signals; reframes the team's choices around it and
  others adopt the framing.
- **4 — Above Requirement:** Connects current decisions to a credible forward
  view and anticipates more than one plausible scenario.
- **3 — Meets Requirement:** Sets direction beyond the immediate task and
  accounts for foreseeable change in the market or rules.
- **2 — Development Needed:** Plans largely for current conditions; addresses
  future shifts only when prompted.
- **1 — Significant Gap:** Reacts to events; no articulated forward direction;
  surprised by foreseeable change.

> The remaining 37 competencies are anchored the same way in **Phase 2** (I can
> draft these in cluster-sized batches for SME editing).

---

## 6. Originality & IP Posture — how this stays defensible

1. **Names + definitions:** fully re-authored (Section 4). No v1/KF text carried
   over.
2. **Structure:** the 4-quadrant taxonomy is generic; cluster labels are VIFM's.
3. **The decisive step:** Phase 1 job analysis must produce evidence that the
   *set* reflects VIFM role data — including at least some deviations from the
   38-item parity (merges/splits/additions/removals). Without that, "original"
   is hard to defend.
4. **Citations:** each competency will carry a short source note (job-analysis
   evidence + literature) in the validation pack — not a crosswalk to KF.
5. **Engineering note:** a private old→new ID map is needed only for *data
   migration* (Phase 4). It is an internal engineering artifact and must **not**
   appear in client materials as a "renaming of KF."

---

## 7. Validation Plan (earns the "research-grounded" claim)

- **Phase 1 — Job analysis:** structured SME interviews, critical-incident
  technique, competency card-sort across target GCC banking roles. *Output:*
  evidence-backed competency set + role profiles.
- **Phase 3 — Content validation:** SME panel rates each competency for
  job-relevance and clarity; compute content-validity ratios; revise.
- **Phase 5 — Local/psychometric validation:** pilot; item/exercise analysis,
  inter-rater reliability (ICC — `src/lib/scoring/reliability.ts`), internal
  structure check; assemble the validity report against AERA/APA/NCME + ISO
  10667 + ITC.

---

## 8. Engineering Migration Outline (Phase 4 — for reference)

Replacing the framework touches ~30 files. High level:
1. New seed migration superseding `00002` (+ revisit `00006b`, `00064`,
   `00066`, `00068` links).
2. Old→new ID/`name` mapping for existing rows (`talent-map`, evidence,
   psychometrics links, Reflect template alignment `00033/00034`).
3. Update logic: `scoring/talent-map.ts`, `scoring/competency-gap.ts`,
   `competencies/unified-profile.ts`, `psychometrics/framework.ts`,
   `recommender/courses.ts`, `evidence-map/*`, the AI suggesters,
   `jd-competency-extractor.ts`.
4. Bilingual content: `i18n/locales/en.json` **and** `ar.json` (names +
   descriptions, EN + AR).
5. Reports + admin UI: `reports/personal-snapshot`,
   `reports/credential-certificate`, competency-configurator, ac-evidence pages.
6. Update the Blueprint `.docx` §3 + references (KF → "benchmarked against").

---

## 9. Open Decisions

1. Keep domain labels (THINKING/RESULTS/PEOPLE/SELF) or rename for further
   distance? *(default: keep)*
2. Hold 38 for now, or invite Phase 1 to resize? *(recommended: allow resize)*
3. Who is the SME panel, and what roles/JDs anchor the job analysis?
4. Single universal framework, or universal core + role-tiered profiles (per
   Blueprint §3.3)?

---

*Next step: on approval of Section 4 naming, proceed to Phase 1 (job-analysis
kit) and Phase 2 (full BARS authoring, in batches).*
