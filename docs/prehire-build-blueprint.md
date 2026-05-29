# VIFM Pre-Hire — Build Blueprint

Commercial pre-employment assessment service: sell the **Assessment Center** and
**Fluent** (plus the supporting AI screens) to **client organizations** as a
pre-hire shortlisting service. MVP is the **Screen tier**; the full AC is the
premium "Decide" tier; the recommender + Academy + credentials are the recurring
"Develop & Certify" layer.

**Target:** a validated pilot in ~3–5 months (Phases 1–3); Phase 4 is continuous.

**The one hard rule:** never sell beyond the pilot (Phase 4) before the validity +
fairness evidence exists (Phase 3). Selling selection without evidence is the
mistake that sinks these businesses.

---

## 0. Decisions to lock before Phase 1 (gating — owned by the business)

| # | Decision | Why it gates everything |
|---|---|---|
| D1 | **Anchor client & sector** (bank / government / corporate; UAE or Saudi) | The framework-calibration advantage decides where you win first |
| D2 | **1–2 pilot roles + level** (e.g. relationship manager · branch manager) | Competency model, cut-scores, exercises and norms are all *per role* |
| D3 | **MVP tier** (recommend: Screen) | Sets the Phase-1 build scope |
| D4 | **Delivery model** (VIFM runs ACs vs. certify the client's assessors) | Drives scale, price, and the Phase-4 build |

---

## 1. Reuse vs. net-new (the map)

Most of the *assessment* machinery already exists. The net-new work is **assembly**
— a client-scoped hiring funnel and a recruiter view — not new instruments.

| Capability | Status | Anchor in the current platform | Phase-1 work |
|---|---|---|---|
| Define "good" per role | ♻️ Reuse | Role profiles (`00014`/`00016`, `/admin/role-profiles`) + JD→competency extractor (`src/lib/ai/jd-competency-extractor.ts`) | Configure pilot roles + **cut-scores** |
| English screen | ♻️ Reuse | Fluent (`src/lib/ai/fluent-english.ts`, `/ac/fluent`, candidate binding `00044`, server-held test `00045`) | Calibrate (QWK ≥ 0.70) + proctoring decision |
| Competency / cognitive screen | ♻️ Reuse | Quiz generator (`src/lib/ai/quiz-generator.ts`, attempts `00017`) | Map item sets to role competencies |
| Structured behavioural screen | ♻️ Reuse | CBI AI interview (`src/lib/ai/cbi-interviewer.ts`, `cbi_sessions` `00040`, **human-approve gate** `approveCbiToPipelineAction`) | Reuse the approve-gate as the no-auto-reject control |
| Final-stage assessment (Decide tier) | ♻️ Reuse | AC exercises, wash-up engine, **OAR**, bias detection (`src/lib/scoring/`) | Per-role cut-scores; assessor calibration (later tier) |
| Candidate token access (no account) | ♻️ Reuse (pattern) | ARA respondent flow (`src/lib/ara/respondent-access.ts`, middleware token bypass) | Adapt pattern to a multi-stage pre-hire journey |
| Invitations / notifications | ♻️ Reuse | `src/lib/integrations/email.ts` + ARA bilingual email templates | New pre-hire invite/reminder templates |
| Per-client data isolation | ♻️ Reuse | `ara_organizations` / clients + RLS org isolation | New pre-hire tables inherit the RLS model |
| Adverse-impact / analytics | ♻️ Reuse (primitives) | bias detection + analytics dashboards | New **adverse-impact report** view for pre-hire |
| Develop & Certify (recurring layer) | ♻️ Reuse | Recommender (`src/lib/recommender/courses.ts`) → Academy → credentials (`src/lib/credentials/issue.ts`, `/verify`) | Wire "ready-with-development" → onboarding (Phase 4) |
| **Pre-Hire pipeline (requisition + staged funnel)** | 🟥 **Net-new** | — | Core new data model + orchestration |
| **Composite scoring / ranking** | 🟥 **Net-new** | (combines the per-instrument scores above) | Transparent per-role weighting → rank + recommendation |
| **Recruiter shortlist dashboard** | 🟥 **Net-new** | — | Ranked candidates, per-stage results, flags, export |
| **Per-client requisition config** | 🟥 **Net-new** | (reuses role profiles) | Role + cut-scores + stage selection + branding |
| **Candidate consent / DPA flow (external candidates)** | 🟥 **Net-new** | (reuses consent pattern `/api/consent`) | Pre-hire consent + data-processing notice |
| **ATS export** | 🟥 **Net-new** (pattern exists) | role-profile JSON export (`/api/role-profiles/[id]/export`) | New export shape per stage/result |

---

## 2. Net-new data model (proposed sketch)

Parallels the proven `ara_respondents` token model; inherits org-scoped RLS.

- **`prehire_requisitions`** — one per client role opening: `org_id`, `title`,
  `role_profile_id`, `level`, `stage_config` (which stages on), `cut_scores`
  (jsonb, per stage), `status`. *Reuses* role profiles + organizations.
- **`prehire_candidates`** — `requisition_id`, name/email, `access_token`,
  `current_stage`, `status` (invited → in_progress → scored → shortlisted /
  hold / declined), `composite_score`, `consent_at`. *Parallels* `ara_respondents`.
- **Stage results** — link to the existing result tables keyed by the pre-hire
  candidate: `eng_fluent_results` (Fluent), `candidate_quiz_attempts` (quiz),
  `cbi_sessions` (CBI), and AC `overall_assessment_ratings` (Decide tier). Add a
  thin `prehire_stage_results` index table or FK columns — do **not** duplicate
  the instruments.

All writes via service-role API routes after token validation (the ARA/Academy
pattern); RLS: client SELECTs only its own requisitions; admin all; candidate via
token only.

---

## 3. Phase 1 backlog — Foundation & Build (~6–10 weeks)

Owners: **[ENG]** engineering/product · **[I-O]** assessment/I-O lead ·
**[LEGAL]** legal/DPO · **[COMM]** commercial.

### A. Pipeline & data
- **P1** [ENG] Net-new schema (`prehire_requisitions`, `prehire_candidates`, stage-result links) + RLS. *Depends: D1–D3.*
- **P2** [ENG] Requisition config surface (role profile + cut-scores + stage selection + client branding). *Reuses role profiles. Depends: P1.*
- **P3** [I-O] Define competency model + **cut-scores** for the pilot roles. *Reuses JD extractor. Depends: D2.*

### B. Candidate flow
- **P4** [ENG] Token-gated multi-stage candidate journey (invite → Fluent → quiz → CBI → done), adapting `respondent-access.ts`. *Depends: P1.*
- **P5** [ENG] Pre-hire invite + reminder emails (bilingual). *Reuses `integrations/email.ts`.*
- **P6** [LEGAL+ENG] Candidate consent + data-processing notice in the flow. *Reuses `/api/consent` pattern.*

### C. Scoring & recruiter view
- **P7** [I-O+ENG] Composite scoring/ranking library — combine stage scores per role cut-scores → rank + recommendation band. *Net-new; reuses each instrument's score.*
- **P8** [ENG] Recruiter shortlist dashboard — ranked list, per-stage detail, flags, recommendation, filters. *Depends: P7.*
- **P9** [ENG] ATS export (per-candidate result). *Reuses JSON-export pattern.*

### D. Defensibility (license to sell)
- **D-a** [I-O] Content-validity documentation per instrument (the start of the evidence pack).
- **D-b** [I-O+ENG] Adverse-impact report view (by nationality/gender/age). *Reuses bias/analytics primitives.*
- **D-c** [I-O] Fluent calibration (QWK ≥ 0.70) + proctoring decision **before it gates**. *Reuses `eng_fluent_human_ratings`/`score_runs` (`00046`).*
- **D-d** [ENG] Confirm human-in-the-loop end-to-end — no stage auto-rejects (extend the CBI approve-gate model).

### E. Legal / commercial scaffolding
- **E-a** [LEGAL] DPA template (VIFM = processor), data-residency answer, retention.
- **E-b** [LEGAL] Contract clause: VIFM *recommends*, client *decides*.
- **E-c** [COMM] Anchor-client pilot agreement (paid, shadow-mode). *Depends: D1.*

**Phase-1 exit:** a candidate can be invited and flow end-to-end into a client-scoped
recruiter shortlist, with consent + the legal/evidence basics in place.

---

## 4. Phases 2–4 (rollout, condensed)

- **Phase 2 — Pilot in shadow mode** (~6–12 wks, paced by hiring volume): run real
  candidates; client hires as normal; capture VIFM outputs *and* client decisions +
  candidate-experience feedback.
- **Phase 3 — Validate & calibrate** (~3–6 wks analysis): concurrent-validity +
  adverse-impact analysis; tune cut-scores; finalize the evidence pack + a reference
  case study. *Predictive validity needs 6–12 mo of post-hire outcome data — build the
  loop to collect it.* **Gate to selling beyond the pilot.**
- **Phase 4 — Launch & scale** (ongoing): go live as a decision input; tiers + pricing +
  collateral; expand the role library; **certify client assessors** to scale the AC (and
  sell training); ATS integrations; switch on **Develop + Certify** (recommender →
  Academy → verifiable credential) as the recurring-revenue layer.

---

## 5. Sequencing rules & risks

- **Evidence gates the sale.** Phase 4 only after Phase 3.
- **Human-in-the-loop, always.** AI ranks and flags; people decide; no auto-reject.
- **Fluent is a screening signal until calibrated + proctored** — not a hard gate.
- **AC economics don't scale like SaaS** — push volume to the AI Screen tier; scale the
  AC by certifying client assessors.
- **You become a data processor** — DPAs, PDPL/GDPR, residency, consent, retention are
  non-negotiable.
- **Don't overclaim predictive validity** you haven't evidenced yet.
