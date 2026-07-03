# Assessment Integrity & Security - How Caliber Protects Result Validity

How the VIFM Talent Intelligence platform (Caliber) safeguards unsupervised, web-delivered assessment - and what it honestly can and cannot guarantee.

---

## 1. The design principle

Remote, browser-based testing trades the control of a supervised test centre for reach, speed, and cost. No remote platform can eliminate misconduct; pretending otherwise is the real risk. Caliber therefore does not aim for impossible certainty. It provides **four layers - prevention, detection, verification, and evidence** - so that every result carries enough context for the organisation to make an informed judgement about its validity, and no result is ever accepted or rejected by a machine alone.

## 2. Layer 1 - Prevention (make cheating hard)

- **Answer keys never reach the browser.** Every scored instrument (Fluent, Logica, Techno, Pre-Hire quiz) holds the full keyed test server-side; the candidate's browser receives a key-stripped copy, and grading happens on the server against the stored key. If the secure session store is unavailable, the platform refuses to serve the test rather than fall back to an insecure mode.
- **Single-use, time-boxed sessions.** Each administration is claimed atomically - a session can be scored exactly once (no replay into a second result or credential) and expires after 3 hours.
- **Per-sitting option randomisation.** Option positions are re-randomised on every administration (with two psychometric guardrails: numerically ordered option sets stay in order, and semantic judgement scales such as True/False/Cannot say keep their authored order). This defeats position memorisation between sittings and authoring bias toward early positions.
- **Time limits with auto-submit.** Administrator-configurable per instrument; the test submits itself when time runs out.
- **Fresh content per sitting.** AI-authored instruments generate a new form per administration; certified Techno sittings assemble from an SME-approved bank.

## 3. Layer 2 - Detection (see what happened)

- **Integrity Signal (advisory, 0-100).** Fluent sittings capture privacy-safe telemetry - tab-switch/focus-loss counts, total time away, the LENGTH (never the content) of pasted text, and a server-detected mid-test IP change - and compose it into a tiered advisory signal (clean / minor / elevated) shown to the reviewing administrator with plain-language reasons.
- **AI-likeness estimate (advisory).** Free-text writing (Fluent writing task, Pre-Hire AI-interview answers) receives a conservative stylometric estimate that the text was produced with a generative-AI tool. **AI-text detection is inherently unreliable**: the estimate is hard-capped on short responses, contributes to the Integrity Signal only above a high floor, is framed as "worth a human glance", and is never treated as proof. Its strongest reading is alongside the paste-length capture, which catches the most common copy-from-a-chatbot workflow directly.
- **Camera proctoring (opt-in).** When an organisation or voucher requires it, the candidate consents on screen and periodic webcam snapshots (with a motion score) are captured during the test, stored in a private bucket, and **deleted automatically after 90 days**. An administrator can run an AI-assisted review (face count, looking-away, second-device cues) whose output is flags for a human reviewer - never an automatic action. The REQUIREMENT is decided server-side (organisation policy or voucher flag - not a URL parameter a candidate can strip); the capture itself necessarily runs in the candidate's browser, so at scoring time the server independently checks that a proctoring session was actually recorded for any administration that required one and, if not, flags the result ("proctoring required but not recorded") in the Integrity Signal for human review.
- **Response-pattern validity.** The AI-readiness questionnaire runs distortion detection (extremity, straight-lining, anchor deviation); Assessment Center analytics include assessor-bias metrics (leniency, central tendency, halo).

## 4. Layer 3 - Verification (confirm what matters)

- **A human always decides.** Pre-Hire's composite recommendation vocabulary is advance / review / hold / incomplete - there is deliberately **no "reject"** in the scoring code, and integrity signals never cap a score or block a result.
- **Staged verification for high-stakes decisions.** The Pre-Hire pipeline is built for exactly the recommended pattern: screen remotely, then re-verify what matters at the next stage (a supervised short form, a human interview, an Assessment Center). The AI Conversational Assessor's output only enters the assessment pipeline through an assessor's explicit review-and-approve gate.
- **Verifiable credentials.** Issued credentials carry an unguessable verification code and a public verification page; revocation and expiry are first-class.

## 5. Layer 4 - Evidence (keep the record)

- **Immutable audit trails** on the Pre-Hire funnel (append-only; updates refused at the database layer) covering consent, stage completion, report sharing, and exports.
- **Scoring audit substrate.** AI writing/speaking score runs are logged for human re-rating and calibration (target quadratic-weighted kappa >= 0.70 against human examiners); item responses are logged for statistical calibration of the item banks.
- **Consent records.** Candidate consent (including the exact proctoring consent text shown) is stored with timestamps.

## 6. Organisational control

Clients decide their own monitoring posture. Camera proctoring is **off by default** and can be mandated org-wide from the client portal's settings page (or per voucher batch); the always-on layer (server-held keys, single-use sessions, advisory telemetry) is part of the platform's basic result-validity guarantee and is documented here rather than toggleable.

## 7. Privacy & compliance - the honest statement

- **Data protection by design.** Candidate consent gates data collection; retention defaults are deliberately short (proctoring snapshots 90 days; assessment data max 2 years unless contractually extended); integrity telemetry stores counts, durations, and lengths - never pasted content or keystrokes. Designed to align with UAE Federal Decree-Law No. 45 of 2021, Saudi PDPL, and GDPR for EU/UK operations.
- **Certifications - what we claim and what we don't.** VIFM does not currently hold ISO 27001 or SOC 2 certification for the Caliber platform, and this brief makes no such claim. The platform's hosting substrate (Supabase for data, Render for compute) maintains SOC 2 Type II attestations for their infrastructure. Should a client engagement require formal certification of VIFM's own operations, that requires an audit engagement - we state exactly this rather than borrowing our vendors' badges.
- **Standards alignment.** Assessment practice aligns to ISO 10667 (assessment of people in work settings) and the International Taskforce on Assessment Center Guidelines (6th edition).

## 8. Honest limits

- Identity is assured to the strength of the delivery channel (personal invitation link, voucher bound to a named delegate, opt-in camera snapshots) - not to biometric certainty. For high-stakes decisions, re-verify in person.
- AI-content detection is probabilistic and unreliable by nature; Caliber's estimate is deliberately conservative and advisory.
- Client-side telemetry (tab focus, paste) can be defeated by a determined actor with a second device; that is precisely why it is one signal in a layered model, not a gate.
- Camera proctoring is snapshot-based review evidence, not live invigilation, and like any browser-delivered control its capture can be interfered with client-side - which the server-side "session recorded?" check converts into a flag rather than silence.

---

*VIFM Caliber Integrity & Security brief v1.0 (2026-07-03). Changes to the layered model or to the compliance statement require a documented version bump.*
