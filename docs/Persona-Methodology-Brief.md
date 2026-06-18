# VIFM Persona - Methodology Brief

What Persona measures, how it is scored, what the two report types are for, and what it is honestly not.

---

## 1. Why this exists

Whenever a behavioural self-assessment informs a people decision, three questions follow it into the room: *What does the instrument actually measure? How is a single number derived from the answers? And what weight should the number be allowed to carry?* This brief answers those questions for VIFM Persona, the behavioural self-report instrument that sits alongside the VIFM-AC observed assessment and the Reflect 360 multi-rater view.

Persona is a self-report screening and development signal. It is deliberately not a hiring decision and not an objective measure of ability. The design choices documented below all flow from that single positioning.

---

## 2. What Persona measures

### One framework, many instruments

Persona is a behavioural self-report across the VIFM competency framework. A respondent rates a series of first-person statements about how they typically work, and those ratings roll up to a profile across the framework. Crucially, it is the *same* competency framework that the Reflect 360 uses, so a person's self-view and their others-view are expressed on identical dimensions and can be read side by side without translation.

### The competency framework

The framework is organised as **41 competencies grouped into 9 clusters**, which in turn sit under the four VIFM behavioural domains (THINKING, RESULTS, PEOPLE, SELF). The nine clusters are:

- Strategic and Commercial Reasoning
- Customer and Stakeholder Focus
- Delivery and Execution
- Innovation and Complexity
- Influence and Communication
- Leading and Developing Others
- Adaptability and Change
- Integrity and Character
- Growth and Personal Effectiveness

Each competency carries four first-person Likert statements in the Persona item bank, authored in English and Gulf Arabic. The bank began life as a 38-competency, 8-cluster framework; a ninth cluster (Customer and Stakeholder Focus, adding three competencies) was added so that customer and stakeholder behaviours - central to GCC banking and government roles - are measured explicitly rather than folded into other clusters. Where older code comments or report subtitles still read "38 competencies", that wording is stale; the live bank is 41.

### Why it maps to the 360

Self-report alone is one source. By anchoring Persona to the framework that the Reflect 360 already uses, a self-rating on any competency lines up exactly with the manager, peer and direct-report ratings on the same competency. The intended end state is a self-versus-others read on one set of axes - the self view from Persona, the observed view from a 360 - which is far more defensible than either source on its own.

---

## 3. How it is scored

### The item response

Every Persona statement is answered on a 5-point scale (`1` through `5`). Each statement is keyed to exactly one competency. Statements written in the negative direction are marked as reverse items; a reverse item's raw answer is mapped with `6 - raw` before it contributes to a score, so a high score always means more of the competency regardless of how the statement was phrased.

### From items to a competency score

A competency's self-score is the mean of its (reverse-mapped) item scores, on the same 1-5 scale, rounded to two decimal places. Because every competency is measured by four statements rather than one, the per-competency score is less hostage to a single mis-read item.

### From competencies to clusters and overall

Cluster averages are the mean of the competency scores within each cluster, and the overall self-rating is the mean across all answered competencies. Each score - item, competency, cluster, or overall - is interpreted against the five Persona interpretation bands:

1. **Exceptional** (4.5 and above) - a clear, distinctive strength to share and teach.
2. **Proficient** (3.5 to 4.49) - solid, with room to deepen mastery and extend impact.
3. **Developing** (2.5 to 3.49) - emerging; structured coaching, practice and stretch assignments help.
4. **Requires Focus** (1.5 to 2.49) - a significant gap to prioritise with a formal development plan.
5. **Critical Gap** (below 1.5) - urgent; immediate development action and close support are essential.

### Role fit (when a target role is bound)

When a Persona sitting is bound to a target role profile, Persona computes a weighted role-fit percentage. Each role competency carries a target proficiency (1-5) and a relative weight. The fit calculation contributes, for each role competency, `clamp(self / target, 0..1)` multiplied by the competency's weight, then expresses the weighted total as a 0-100 percentage. Fit resolves into three bands: **Strong fit** (80% and above), **Moderate fit** (60-79%), and **Limited fit** (below 60%). The biggest weighted gaps are surfaced first so a reader sees where the self-profile falls short of the role, and the strengths (self at or above target) are surfaced alongside them.

Two scoring disciplines protect the fit number from being misleading:

- **Fit is computed over measured competencies only.** A scoped sitting may serve a subset of the role's competencies; the fit is computed across the competencies actually answered. Counting an unserved competency as a zero would understate fit, so the calculation excludes it.
- **An unmeasured-but-required competency is treated conservatively** in the raw weighted match (a role asks for it and there is no signal), but it never invents a self-score.

### Percentile context

Persona is designed to carry percentile context - "this self-profile sits at the Nth percentile of comparable respondents" - once a norm group of sufficient size has accumulated. That comparison is **provisional and is not rendered until the norm sample is large enough** to make a percentile claim defensible. Until then, scores are interpreted against the absolute interpretation bands above, not against a peer distribution. This mirrors the platform-wide rule that percentile claims wait for the data that earns them.

---

## 4. The two report types

A Persona sitting is run for one of two purposes, and the purpose changes both what the report says and who is allowed to read it. The same underlying self-profile drives both; the framing differs.

### HIRING - a role-benchmarked screening signal

A hiring report reads the self-profile against a target role as a screening signal that supports a human decision. It shows the role-fit percentage and band, the biggest gaps against the role target, and the strengths to leverage. Its per-competency narratives are deliberately written in self-report language - they describe what the candidate's own answers indicate, relative to the role target, as something to corroborate rather than a verdict. The narratives can be drafted by AI (grounded strictly in the pattern of the candidate's own answers - which statements they rated higher versus lower) and fall back to a deterministic, defensible narrative when AI is unavailable, so the report always renders the same evidence-anchored read.

The hiring report is built to feed, not replace, the human stage. It is accompanied by a structured interview guide (so an interviewer can probe the gaps the self-profile raises with concrete behavioural questions) and a decision-integration worksheet (so the screening signal is recorded alongside interview and work evidence rather than standing alone). The report's own caption states the rule plainly: this is a screening signal, not a hiring decision, to be corroborated with a Reflect 360, a structured interview and work evidence.

**Hiring reports are admin-gated.** Because a hiring report is a client and recruiter deliverable about a candidate, the report endpoint requires an authenticated admin caller. A candidate who reaches the assessment via a voucher or link - and therefore has no account - cannot pull their own fit report even if they know the session identifier.

### DEVELOPMENT - a growth plan the person acts on

A development report is framed entirely as growth and is open to the taker as their own report. It presents a holistic narrative across the clusters, the self-profile against the role target as "current alignment" (with development priorities and strengths to build on rather than gaps to be judged on), a development-planning scaffold, and coaching prompts. Each per-competency note is forward-looking - what to build on and one concrete way to grow it (a stretch assignment, mentoring, or structured learning) - never a verdict.

The development report closes the diagnose-to-deliver loop with a VIFM Academy course plan: the competency gaps are turned into a ranked list of VIFM programmes, each tagged with how strongly it targets the priority and with a high-fit marker on the strongest matches. The development report stays open to the taker precisely because it is theirs to act on, in contrast to the admin-gated hiring report.

---

## 5. What Persona is, and what it is not

- **It is a self-report screening and development signal.** It captures how a person sees their own typical behaviour across the framework. That is a genuine and useful source - but it is one source.
- **It is not a hiring decision.** The scoring deliberately has no reject path. A fit percentage caps how a screening conversation starts; it never closes one. A human makes every decision.
- **It is not an objective measure of ability.** A self-rating reports a self-perception, not a demonstrated competence. Persona does not observe behaviour the way the VIFM-AC observed exercises do.
- **It must be corroborated.** The honest read of any Persona profile is partial until it is triangulated. Pair Persona (the self view) with a Reflect 360 (the others view) on the same framework, and add interview and work evidence. No decision should rest on Persona alone.

These are not caveats bolted on at the end - they are stated on the face of every report, in both purposes, so a reader cannot mistake the instrument for more than it is.

---

## 6. Response-style and consistency

Self-report instruments are vulnerable to two patterns worth flagging: a respondent who rates everything uniformly high (an elevated, self-favouring profile), and a respondent whose answers to similar statements contradict each other (low internal consistency). Persona supports an advisory response-style indicator built from these two signals - profile elevation, and agreement between the normative Likert section and the ipsative forced-choice section that the bank also supports.

The indicator is **advisory only and never a blocker.** A flag asks a reader to interpret the profile with care and to lean harder on corroboration; it does not lower a score, fail a sitting, or change a decision. This matches how the platform treats validity signals elsewhere: an elevated or inconsistent profile is surfaced for human judgement, not acted on automatically. The ipsative forced-choice format (most-like-me / least-like-me across statements from different competencies) is included as a bias-resistant complement to the Likert section precisely because forced choice is harder to inflate uniformly.

---

## 7. Fairness, proper use, confidentiality and retention

### Standards the instrument is held to

Persona is designed and used in line with the recognised standards for the proper use of assessment:

- **ITC Guidelines on Test Use** - on the responsibilities of those who select, administer and interpret assessments.
- **Standards for Educational and Psychological Testing** (AERA / APA / NCME, 2014) - referenced for evidence-based item development and for the discipline of matching claims to evidence.
- **EEOC Uniform Guidelines on Employee Selection Procedures** - VIFM holds a Virginia license, so the Uniform Guidelines frame how a screening instrument may and may not be used in a selection context.

### Proper use

The self-report framing runs through every surface. A hiring report is positioned as a screening signal to be corroborated, never an auto-decision; a development report is positioned as a growth plan the person owns. The fairness logic is structural, not cosmetic: there is no reject path in the code, hiring reports are gated to authenticated administrators, and every report states the corroborate-before-deciding rule on its face.

### Confidentiality

A hiring report about a candidate is a controlled deliverable: it requires an authenticated admin caller, so a no-account respondent cannot retrieve their own fit report by guessing a session identifier. A development report is the taker's own and is theirs to read. Per-competency answers and profiles are handled as confidential personal data throughout.

### Retention

Persona data follows the platform's default data-retention rule - a maximum of two years unless a contract extends it - consistent with UAE Federal Decree-Law No. 45 of 2021, the Saudi PDPL, and GDPR where applicable, and with the platform's consent-before-collection and audit-trail commitments.

---

## 8. Bilingual availability

Persona is fully bilingual. Every item, interpretation band, narrative and report surface exists in English and in Gulf-appropriate Arabic, and the Arabic is treated as content in its own right rather than a back-translation of the English. The two languages mirror the same underlying data - the same item keys, the same competency mapping, the same scoring - so a profile reads identically in either language and a bilingual cohort is scored on one consistent basis. Arabic content is best-effort pending human review before high-stakes use, per project convention.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

*VIFM Persona - Behavioural Self-Assessment - Methodology Brief v1.0.*
