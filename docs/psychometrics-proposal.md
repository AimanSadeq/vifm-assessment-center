# VIFM Psychometric Testing — Fit, Architecture & Path to Professional Quality

*Working draft for internal discussion. Owner: VIFM. Status: proposal — not yet built.*

---

## 0. Executive summary (the one-pager)

**The framing.** VIFM is not "adding psychometrics from scratch." The portal already performs psychometric measurement (the AC method, Fluent, Technical Certification, Reflect 360, ARA all measure psychological constructs with scoring rules and reliability evidence) and already contains the **psychometric engine** — item banks, IRT/Rasch + adaptive testing (CAT), reliability/confidence bands, calibration consoles, fairness analytics, and response-distortion detection. What is genuinely missing is **two classic standardized test families** and the **measurement science** that makes them defensible.

**The gap (2 test families):**
- **Cognitive ability** (numerical / verbal / abstract-inductive / logical-deductive reasoning) — the strongest single "can-do" predictor of job performance, and currently absent.
- **Personality** (Big Five / OCEAN) — the "will-do" complement; only partially approximated today by the ARA individual four-factor mindset.

**Where it fits.** A new **Psychometrics** capability pillar (peer to AC / Technical / Fluent), built as standalone modules with their own tables and routes, then surfaced as **Pre-Hire stages** and **AC engagement inputs** — the same "third pillar" pattern already used for Technical Certification.

**The honest bottom line.** Reaching *top professional quality* is **~80% measurement science, ~20% code.** The build is straightforward on existing infrastructure (we can ship an *indicative* edition quickly). The differentiator — and the commercial moat — is the **validation studies, GCC norms, calibrated item banks, and Arabic equivalence.** Those are slow, data-hungry, and cannot be shortcut by engineering.

---

## 1. What "psychometric testing" means here

A family, not one instrument:

| Type | Measures | Performance type | "Right answers"? |
|---|---|---|---|
| **Cognitive ability** | Reasoning capacity (g + specifics) | Maximum | Yes |
| **Attainment / knowledge** | Acquired knowledge & skills | Maximum | Yes |
| **Personality** | Behavioural dispositions / traits | Typical | No (norm-referenced) |
| **Values / motivation / interests** | What drives & matters | Typical | No |
| **Situational Judgement (SJT)** | Applied judgement | Hybrid | Keyed (consensus/expert) |

> **Talking point:** the AC, CBI, Reflect 360 and ARA are psychometric too. The question isn't "do we do psychometrics" — it's "which standardized *test types* are missing, and how do we raise the whole suite to test-publisher standard."

---

## 2. Where it fits — the layered measurement model

A first-pass "quadrant" framing buckets the constructs but blurs *how they relate* — which is the real source of confusion. The correct model keeps the **38 behavioural competencies as the single spine** (VIFM's IP and reporting anchor) and connects every other instrument to that spine through a **named relationship** that also encodes how strong the evidence is.

```
 OUTCOMES        Readiness · Performance · Potential  (OAR)
                        ▲  drives
 COMPETENCIES    38 behavioural (THINKING · RESULTS · PEOPLE · SELF)
   measured by → AC exercises · CBI · Reflect 360        ── MANIFESTS  (direct — this IS the score)
                        ▲ enables             ▲ predicts
 ATTAINMENTS     Technical knowledge · English
   measured by → Technical Cert · Fluent                 ── ENABLES    (capability the competency draws on)
                                              ▲ predicts
 FOUNDATIONS     Cognitive ability · Personality (Big Five)
   measured by → Cognitive battery · Personality inv.    ── PREDICTS   (stable propensity; must be validated)
```

Read bottom-to-top: **stable & general → contextual & observed → decisive.** Evidence strength rises with each layer — *predicts* (a likelihood) < *enables* (a capability is present) < *manifests* (we watched them do it). That ordering is what makes the model both **correct** (it respects that ability ≠ attainment ≠ behaviour) and **easy to explain**.

| Layer | Construct | Instrument | Relation to a competency | Evidence |
|---|---|---|---|---|
| **Foundations** | Cognitive ability | Cognitive battery *(new)* | **predicts** | propensity (validated) |
| **Foundations** | Personality (Big Five) | Personality inventory *(new)* | **predicts** | propensity (validated) |
| **Attainments** | Technical knowledge | Technical Certification | **enables** | capability |
| **Attainments** | English | Fluent | **enables** | capability |
| **Competencies** | The 38 behavioural | AC · CBI · Reflect 360 | **manifests** (it *is* the competency) | direct |
| **Outcomes** | Readiness / OAR | Wash-up → OAR | rolls up | decision |

**Org-level ARA sits outside this spine** (its unit is the organization, not the person). **ARA-individual** is genuinely cross-layer (mindset = foundation, working-practice = attainment, collaboration = competency-adjacent) and keeps its factor→competency map, each link tagged with the right relation.

**In code:** `unified-profile.ts` already paints typed "enables" chips onto competencies (Fluent language, Technical domains). The upgrade generalises that into one typed bridge — `construct_competency_links(source, competency, relation ∈ {manifests, enables, predicts}, layer ∈ {foundations, attainments, competencies}, weight, validated)` — so cognitive/personality plug in as `predicts`/`foundations` links and every instrument relates to the spine the same principled way. A candidate competency then reads, honestly, as:
> **Decision Quality — 3/5** *(measured: AC In-Basket)* · ↳ enabled by Finance 4/5 · ⤳ predicted by Cognitive 85th pct

### 2.1 The flagship application — High-Potential & Succession
This is not abstract: it directly upgrades Caliber's existing **Talent Map** (`/admin/engagements/[id]/talent-map`). Today the 9-box plots **Performance = RESULTS + PEOPLE competencies** vs **Potential = THINKING + SELF competencies** — i.e. *Potential is a proxy built from current behavioural competence*, because no true potential measure exists (the code says as much). In the layered model:

- **Performance axis = Competencies layer** (manifested — AC / CBI / 360). *(have it)*
- **Potential axis = Foundations layer** (cognitive ability + personality + learning agility — predictive). *(the psychometrics build)*

So the cognitive + personality modules turn the 9-box Y-axis from a relabel of current competence into a **genuine predictive potential construct**, and the succession pipeline (Ready Now / Ready with Development / Not Ready, from OAR) gains a real "capacity to grow" signal. **HiPo / Succession is the headline payoff of this work, not a separate initiative.** The remaining gap — persistent enterprise talent pools, critical-role successor slates, bench strength, flight risk — is a talent-management *orchestration* layer that consumes this same data (see §8 / roadmap).

---

## 3. Where it fits — structurally in the portal

A new pillar, mirroring how Technical was added:

- **Standalone modules** under a `Psychometrics` capability: **Cognitive Ability** and **Personality**. Own `psy_*` tables, `/psychometrics/*` routes, own runner — RLS admin-only on results, service-role API writes, server-held keys (the established pattern).
- **Pre-Hire integration:** add `cognitive` and `personality` to `PrehireStageKind` and the requisition `stage_config` plan; they feed `computeComposite` like any other stage. (Personality contributes a *fit* signal, not a pass/fail — see §6.)
- **AC integration:** an additional evidence source into the integration/wash-up and the candidate report (multi-trait multi-method).

### Schema sketch (proposed `psy_*`, clones the Technical pattern)
- `psy_instruments` — instrument + version (cognitive, personality), bilingual.
- `psy_scales` — subtests (cognitive) / traits + facets (personality).
- `psy_items` — item bank: stem/options bilingual, IRT params (a/b/c), classical stats (`p`, point-biserial), `status` draft→in_review→approved→retired, exposure counters.
- `psy_sessions` — full test + key held server-side, single-use (no replay).
- `psy_item_responses` — per-item response log (calibration + DIF substrate).
- `psy_results` — per-scale raw + scaled scores, norm applied, percentile/sten, confidence band, validity-scale flags.
- `psy_norm_groups` + `psy_norms` — reference populations (region / sector / level / language) and percentile lookups.
- `psy_human_reviews` — SME review + validation evidence per item.

---

## 4. What we already have (reuse inventory — the ~70%)

| Capability | Existing asset to reuse |
|---|---|
| IRT / Rasch + adaptive (CAT) | `src/lib/scoring/irt.ts` (`selectNextItem`); the turn-based adaptive Technical runner |
| Reliability / confidence bands | `src/lib/scoring/reliability.ts`; ICC (AC); QWK calibration (Fluent) |
| Item bank + SME review workflow | Technical: `tech_assessment_items` (draft→approved, `p`-value + discrimination substrate), `tech_assessment_cut_scores`, IRT columns (migration 00060) |
| Calibration console | Fluent (`eng_fluent_human_ratings` + `eng_fluent_score_runs`, human-vs-AI QWK); Technical |
| Fairness analytics | Pre-Hire `computeAdverseImpact` (4/5ths) + voluntary demographics |
| Response distortion / faking | ARA distortion detection (directly reusable for personality validity scales) |
| Security / integrity | Server-held keys, option re-randomisation, single-use sessions, integrity flags |
| Bilingual + reporting + credentials | EN/AR i18n, Puppeteer + React-PDF reports, verifiable credentials |

**Conclusion:** the engine exists. The build is mostly *content + configuration*, not new infrastructure.

---

## 5. Module blueprints

### 5.1 Cognitive Ability battery
- **Subtests (start with 3, expand):**
  - **Numerical reasoning** — data/table/chart interpretation, ratios, %, trends. Timed MCQ.
  - **Verbal reasoning** — comprehension + critical reasoning (true / false / cannot-say).
  - **Abstract / inductive** — series, matrices, odd-one-out (most culture-fair; good for diverse GCC pools).
  - *(later)* **Logical / deductive** — syllogisms, arrangements; optional **numerical-critical** for finance roles.
- **Format & timing:** power or lightly-speeded; ~10–18 min/subtest; calibrated banks enable **CAT** (shorter, more secure, equiprecise).
- **Scoring:** number-correct → IRT θ → **norm-referenced** percentile / sten / stanine + SEM/confidence band. Optional **general ability (g)** composite.
- **Finance tilt:** a numerical-critical subtest aligned to the Technical taxonomy gives VIFM a differentiated, sector-relevant ability measure.

### 5.2 Personality (Big Five / OCEAN)
- **Model:** five domains — Openness, Conscientiousness, Extraversion, Agreeableness, Emotional Stability (vs Neuroticism) — optionally **facets** (2–6 per domain).
- **Content base (decision):** **IPIP** (International Personality Item Pool) is **public-domain and academically validated** — a defensible, license-free starting point — vs licensing a proprietary occupational inventory. IPIP still requires **Arabic adaptation + local validation** before any high-stakes use.
- **Format:** Likert (5-point) is simplest; **forced-choice (Thurstonian IRT)** is the modern best practice for **selection** because it blunts faking. Recommend forced-choice for hiring, Likert acceptable for development.
- **Validity scales (reuse ARA distortion):** social desirability, inconsistency, acquiescence, infrequency.
- **Scoring & use:** domain/facet **profiles**, norm-referenced (sten/percentile). **Never pass/fail** — interpretive "fit" only; in Pre-Hire it informs, it does not gate.
- **Reporting:** trait profile + work-relevant narrative ("will-do" framing), candidate-appropriate feedback.

---

## 6. The bar for "top professional quality"

Judged against published standards: **AERA/APA/NCME *Standards for Educational and Psychological Testing*; ISO 10667 (VIFM already aligns); ITC Guidelines (Test Use, Computer/Internet Delivery, Test Adaptation/translation); EFPA Test-Review Model / BPS** kitemarks.

**A — what code + workflow deliver (buildable):**
1. Construct definitions + **test blueprints** (content sampling plan).
2. Item development + **classical analysis** (difficulty `p`, discrimination/point-biserial, distractor analysis) → **IRT calibration** (a/b/c parameters).
3. **Adaptive delivery + item-exposure control** (CAT, rotation, large banks, randomisation).
4. **Standardised administration** (fixed instructions, timing, proctoring incl. AI proctoring, accommodations).
5. **Scoring + interpretive reports** (SEM reported, candidate/recruiter versions, feedback).
6. **Fairness analytics** — **DIF** (differential item functioning), **measurement invariance** across gender / nationality / age and **EN↔AR equivalence**, plus existing adverse-impact monitoring.
7. **Technical manual** (the artefact reviewers grade — see §9).

**B — what only science + process deliver (slow, data-hungry):**
8. **Reliability** — internal consistency (Cronbach α / McDonald ω **≥ .80** high-stakes), test–retest, parallel forms; report **SEM**.
9. **Validity** — content (SME), construct (CFA, convergent/discriminant), and the selection gold standard **criterion validity** (predicts job performance), plus **incremental validity** over cognitive ability. Needs a **validation study with real outcome data.**
10. **Norms / standardisation** — **GCC-appropriate** norm groups (percentiles, sten). Western norms are not defensible for Emirati / Saudi / expatriate populations (same constraint as ARA Mode A norming, at larger N).
11. **Arabic equivalence** — back-translation + equivalence testing, **not** AI translation. A mistranslated item invalidates the score (VIFM's standing "AR strings need native review" caveat applies doubly to test items).
12. **Qualified-user governance** — test-user competence (BPS Level A/B concept), consent, feedback rights, appeals, retention (PDPL/GDPR already covered).

---

## 7. Maturity ladder (be transparent — mirrors Fluent/Technical tiers)

| Tier | What it is | Ships when | Honest claim |
|---|---|---|---|
| **1 — Indicative / developmental** | AI-/SME-drafted items, classical stats, no local norms | Fast, on existing infra | "Developmental insight / screening support — not a standalone hiring decision" |
| **2 — Professional** | SME-reviewed banks, IRT-calibrated, α ≥ .80, GCC norms, DIF/invariance checked, technical manual | After pilot + calibration (months) | "Professionally developed, locally normed psychometric assessment" |
| **3 — Certified / accredited** | Published criterion-validity studies, EFPA/BPS-style review, periodic re-norming | 6–18 months + outcome data | "Independently reviewed, criterion-validated instrument" |

> **The trap to avoid:** presenting Tier 1 as Tier 2/3. For *selection*, that's a legal + reputational risk — acute in the GCC adverse-impact context. Carry over the portal's existing honesty discipline ("screening signal, not a decision").

---

## 8. Phased build plan

**Phase 0 — Decide & blueprint (days).** Sign off constructs, subtests, personality content base (IPIP vs licensed), format (forced-choice vs Likert), target tier for v1.

**Phase 1 — Indicative edition on existing infra (weeks).**
- `psy_*` schema + runner + SME/item-bank console (clone Technical's).
- Author item pools: cognitive (SME-drafted + piloted) and personality (IPIP-seeded, Arabic-adapted draft).
- Classical scoring + confidence band + indicative reports (reuse PDF infra).
- Pre-Hire stage integration (`cognitive`, `personality`) + AC report surfacing.
- **Outcome:** usable, honestly labelled **Tier 1**.

**Phase 2 — Professionalise (months, needs data).**
- Pilot at scale → classical item analysis → **IRT calibration** (≈ N ≥ 300–500/item for stable 2PL) → reliability ≥ .80 → **provisional GCC norms** → **DIF / invariance** + Arabic equivalence → CAT goes live → **Technical Manual v1.**
- **Outcome:** **Tier 2.**

**Phase 3 — Certify (6–18 months, ongoing).**
- **Criterion-validity study** with client job-performance outcomes (VIFM is well-placed: the Pre-Hire → hire → performance loop can capture this) → incremental-validity evidence → published manual → external review → periodic re-norming.
- **Outcome:** **Tier 3** + commercial moat.

---

## 9. Validation & norming programme (the slow science)

| Evidence | Method | Rough sample need |
|---|---|---|
| Classical item analysis | `p`, point-biserial, distractors | N ≥ 100–200 |
| IRT calibration (2PL/3PL) | Marginal ML estimation | N ≥ 300–500+ per item |
| Reliability | α / ω, test–retest, parallel forms | N ≥ 100–200 |
| Norms | Stratified GCC sample by region/sector/level/language | N ≥ 200–300 **per meaningful subgroup** |
| DIF / invariance | Mantel-Haenszel / IRT-DIF; multi-group CFA | N ≥ 200 per group |
| Criterion validity | Predictive/concurrent vs performance, range-restriction correction | N ≥ 100+ with outcomes |

**Data sources:** (1) passive accrual as candidates take it (à la ARA Mode A); (2) **paid pilot cohorts** with client organisations; (3) **outcome-sharing partnerships** for criterion data. A qualified psychometrician (in-house or external consultant) should own sign-off.

---

## 10. Technical-manual outline (the proof of quality)

1. Purpose & intended use (and explicit *non*-uses)
2. Theoretical framework & construct definitions
3. Development — blueprint, item writing, piloting
4. Item analysis & IRT calibration
5. Reliability (internal consistency, test–retest, SEM)
6. Validity (content, construct, criterion, incremental)
7. Norms & standardisation (samples, tables, dates)
8. Fairness (DIF, invariance, adverse impact, translation/adaptation)
9. Administration & security (conditions, timing, proctoring, exposure control)
10. Scoring & interpretation (incl. confidence bands)
11. User qualifications & ethics
12. Limitations & responsible-use guidance
13. References & revision history

---

## 11. Risks, governance & compliance

- **Adverse impact (GCC-specific):** cognitive tests commonly show subgroup score differences. Monitor 4/5ths (reuse Pre-Hire engine); consider banding / multiple-hurdle / job-relatedness justification; document. National-vs-expat, gender, and language are the sensitive dimensions; nationalisation policy (Emiratisation / Saudisation) interacts with selection.
- **Faking (personality):** the central selection threat → forced-choice + validity scales; never use a faked-down profile as a hard gate.
- **AI-authored item risk:** AI-drafted items are a starting draft only — **human SME review before any item goes live** (already the Technical discipline).
- **Translation validity:** Arabic items need professional adaptation + equivalence testing, not AI translation.
- **Candidate rights:** consent, feedback, appeal; data protection (UAE PDPL, Saudi PDPL, GDPR — covered); retention limits.
- **Qualified test users:** restrict interpretation to trained users; publish a responsible-use policy.
- **Security:** server-held keys (have it), exposure control, sufficient bank size, time limits, proctoring.

---

## 12. Open decisions (for the colleague discussion)

1. **Cognitive content:** author + pilot in-house, or **license** a validated battery to start? (control + margin vs speed + instant credibility)
2. **Personality content:** **IPIP** (free, adapt + validate) vs licensed occupational inventory? (cost vs out-of-box validity)
3. **Personality format:** **forced-choice** (anti-faking, selection) vs Likert (simpler, development)?
4. **First cognitive subtests:** numerical + verbal + abstract — which two ship first?
5. **Norming strategy:** passive accrual, paid pilots, or partner outcome-sharing — or all three?
6. **Target tier for v1:** ship **Tier 1 indicative** now while building toward **Tier 2 professional**? (recommended)
7. **Psychometric sign-off:** in-house psychometrician vs external consultant for validation + manual?
8. **Positioning:** sold as part of Pre-Hire / AC, or also a standalone product?

---

*Prepared as a discussion draft. Next step on request: a colleague-ready PDF/Word version, or kick off Phase 1 (the `psy_*` schema + runner + indicative cognitive & personality modules on existing infrastructure).*
