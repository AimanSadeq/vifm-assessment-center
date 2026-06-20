# VIFM Mentium - Methodology Brief

What Mentium measures, how it is scored, what the report is for, and what it is honestly not.

---

## 1. Why this exists

Whenever a reasoning test informs a people decision, the same three questions follow it into the room: *What does the instrument actually measure? How is a single number derived from the answers? And what weight should that number be allowed to carry?* This brief answers those questions for VIFM Mentium, the cognitive-ability (reasoning) instrument that sits in the Foundations layer of the VIFM measurement model, beneath the behavioural VIFM-AC observed assessment and the Reflect 360 multi-rater view.

Mentium is a foundations-level indicator of reasoning ability. Cognitive ability is a *propensity* - it helps predict how readily a person picks up and applies the behavioural competencies that the rest of the platform measures directly. Mentium is deliberately not a hiring decision, not an objective verdict on a person's worth, and at present not a calibrated, norm-referenced test. Every design choice documented below flows from that positioning.

---

## 2. What Mentium measures

### Reasoning, across four subtests

Mentium estimates general reasoning ability through four subtests, each a distinct facet of how a person works with information:

- **Numerical reasoning** - working with numbers and quantitative information: number series, ratios and percentages, and interpreting data presented in tables and charts to draw correct conclusions.
- **Verbal reasoning** - understanding and reasoning with language: comprehension of written passages, verbal analogies, and evaluating arguments to judge what does or does not follow.
- **Inductive reasoning** - inferring the general rule from specific cases: spotting the pattern in figural series, matrices and odd-one-out problems, then predicting what comes next. A core marker of fluid intelligence.
- **Deductive reasoning** - applying given rules or premises to reach a logically valid conclusion: syllogisms, conditional (if-then) logic, and arrangement or ordering problems where the answer must follow necessarily from the information given.

Items are authored for GCC banking and government professionals, with exactly one defensible correct answer per item, no trick questions, and each item solvable in under a minute. A taker can sit all four subtests or a chosen subset; an empty or invalid selection defaults to all four.

### The general (g) composite

Across the four subtests, Mentium reports a general mental ability (g) composite. This is the single broadest signal the instrument produces and the one with the most evidence behind it as a predictor of how readily a person learns and applies new behaviour.

### The competencies each subtest predicts

Mentium is wired into the platform-wide layered measurement model, in which the 41 behavioural competencies are the spine and every other instrument relates to that spine through a typed relationship. Mentium's relationship is the weakest-evidence one: it *predicts*. Each subtest, and the g composite, declares the behavioural competencies it predicts (resolved by competency name; non-matches are skipped):

- Numerical reasoning predicts Financial Literacy and Acumen, Critical Analysis, Sound Judgement.
- Verbal reasoning predicts Clear and Adaptive Communication, Critical Analysis.
- Inductive reasoning predicts Navigating Complexity, Creative Problem-Solving.
- Deductive reasoning predicts Critical Analysis, Sound Judgement.
- The g composite predicts broadly: Critical Analysis, Sound Judgement, Navigating Complexity.

The word "predicts" is load-bearing and is stated on the face of the report. A strong reasoning score raises the expectation that a person will pick up the related competencies readily; it is not evidence that they currently demonstrate them. Only the observed instruments (VIFM-AC, CBI, Reflect 360) *manifest* a competency.

---

## 3. How it is scored

### From items to a subtest score

Every Mentium item is a multiple-choice question keyed to exactly one subtest, with one correct option. A subtest's raw score is the percentage of its items answered correctly: `round(100 x correct / total)`. The same percentage doubles as the normalised 0-100 score, so the two are identical for a cognitive result.

### From subtests to the g composite

The g composite is the mean of the four subtest percentages, rounded to a whole number. It is reported as a 0-100 composite, not as an IQ-style standard score.

### Interpretation bands (indicative)

Each subtest percentage, and the g composite, is interpreted against five indicative bands based on raw percentage correct, not on a peer distribution:

- **High** - 90 and above
- **Above average** - 75 to 89
- **Average** - 60 to 74
- **Below average** - 40 to 59
- **Low** - below 40

Each subtest also carries a short, non-clinical score-band narrative (strong / mid-range / developing performance) so a reader sees a plain-language read alongside the number.

### Norm-referencing - provisional, and gated

Mentium is engineered to become norm-referenced - to report a percentile and a 1-10 sten score relative to a VIFM reference group - but only once the evidence to do so exists. The honest gate is explicit in code. An instrument is promoted from INDICATIVE (Tier 1) to CALIBRATED (Tier 2) only when, for every scale, three thresholds are cleared at once:

- at least 8 SME-approved items per scale (content),
- internal-consistency reliability (Cronbach's alpha) of at least 0.70, and
- a norm sample of at least 200.

Until then a scale's norm is *ignored* even if pilot data is accumulating, so percentiles are never leaked before they are defensible. When the gate is met, a raw score is standardised against the norm group's mean and standard deviation into a z-score, a percentile (via the standard normal distribution), and a sten band; a result is marked "calibrated" only when every scale - and g - is adequately normed. With no adequate norm group, the result is left exactly as a Tier 1 indicative band. **At the time of writing, Mentium runs at Tier 1: indicative bands only, no percentiles, no sten, no credential.**

---

## 4. Deliverables

### The professional result report

A completed Mentium sitting produces a professional PDF result report (English). It opens with a clear tier badge - "Tier 1 - Indicative" or "Tier 2 - Norm-referenced" - so the report can never over-claim its own rigour, and a "How to read this report" panel that states plainly whether the scores are raw-score bands or norm-referenced percentiles.

Each subtest is rendered as a card showing the raw percentage and band, the fuller definition of what the subtest measures, the score-band narrative, and the competencies that subtest predicts (labelled "Predicts (foundations)"). The g composite is shown as its own card. When, and only when, the instrument is calibrated, each card adds a percentile, a sten band (1-10), and a percentile bar; in the indicative state those are deliberately absent.

A second page reads the result responsibly: a "What this is - and isn't" panel stating that reasoning ability predicts behavioural competency and does not measure it directly, that the result is one input to a human judgement and never an automatic decision, and that it yields a score and a profile, not a pass/fail credential. A "Methodology and limits" panel restates how the score was computed and what validated high-stakes use would additionally require.

### Where the score flows

A Mentium result can be bound to a candidate and an engagement, in which case its predicted-competency signals surface on that candidate's skills profile as foundations-layer signals carrying the "predicted, not measured" caveat. The result feeds human judgement in development planning, selection short-listing, and succession discussion. It never reaches into a downstream pipeline as a gate.

---

## 5. What Mentium is, and what it is not

- **It is a foundations-level indicator of reasoning ability.** It estimates how readily a person reasons with numbers, language, patterns and rules. That is a genuine and useful predictive signal - but it is one input.
- **It predicts competencies; it does not measure them.** Mentium sits at the propensity tier, the weakest-evidence relationship in the layered model. A high reasoning score raises the expectation that related competencies will develop readily; it is not evidence that they are currently demonstrated.
- **It is Tier 1 INDICATIVE.** There is no local norm group, so scores are raw-score bands, not percentiles. There is no IRT or Rasch calibration of the item bank. The same instrument becomes norm-referenced (Tier 2) once a representative sample and reliability evidence accumulate - without re-testing the existing takers.
- **It is not a credential.** Mentium yields a score and a defensible report. It does not issue a pass/fail certificate, and it has no reject path.
- **It is not a hiring decision.** A reasoning score informs a human conversation; a human makes every decision. Validated high-stakes selection use additionally requires a criterion-validity study, adverse-impact (fairness) analysis, and a qualified psychometrician's sign-off.

These are not caveats bolted on at the end - the tier badge, the "predicts not measures" statement, and the "score not a credential" framing appear on the face of every report.

---

## 6. Integrity and secure delivery

Because the score is only as trustworthy as the conditions it was produced under, Mentium uses the same secure-delivery model as the platform's other objective instruments (Fluent, Technical).

- **The answer key never reaches the browser.** On start, the full keyed test - stems, options, and the index of the correct option for each item - is generated and stored server-side in a `psy_sessions` row. The client receives only an answer-key-stripped copy (`stripAnswerKey` removes the `correct` index before the payload leaves the server), so the correct answers are never present in anything the taker's device can read.
- **Grading happens on the server.** On submit, the server reloads the stored keyed test from the session, scores the submitted answers against it (`computePsyResult`), and computes the bands and g composite. The browser is never trusted to grade itself.
- **Sessions are single-use.** A session is marked `consumed` the moment it is scored; a second submission against the same session is refused. A consumed session cannot be re-scored, which closes the door on replaying a session to fish for a better outcome.
- **Results are read-restricted.** The `psy_results` table is admin-SELECT only, and every write goes through the service-role API route - there are no client-side writes. A no-account taker receives a thank-you, not a result identifier; only an authenticated staff caller receives the report-route key needed to download the report. Item-level responses are logged separately as the substrate for future calibration.

Two honest limits sit alongside this model. First, secure delivery is not invigilation: the integrity controls protect the answer key and prevent replay, but they do not by themselves confirm the identity of the taker or that the person worked unaided. Second, the items themselves are AI-drafted (with a deterministic bilingual fallback deck when no AI key is configured); the SME-reviewed, approved-only item bank that underpins a certified path is a separate workflow and, until a scale's bank is sufficiently populated and calibrated, Mentium stays in its indicative state.

---

## 7. Fairness, proper use, confidentiality and retention

### Standards the instrument is held to

Mentium is designed and used in line with the recognised standards for the proper use of assessment:

- **ITC Guidelines on Test Use** - on the responsibilities of those who select, administer and interpret assessments.
- **Standards for Educational and Psychological Testing** (AERA / APA / NCME, 2014) - referenced for evidence-based item development and for the discipline of matching claims to the evidence, including the discipline of not reporting norm-referenced scores until a defensible norm group exists.
- **EEOC Uniform Guidelines on Employee Selection Procedures** - VIFM holds a Virginia license, so the Uniform Guidelines frame how a cognitive instrument may and may not be used in a selection context. Cognitive-ability tests warrant particular care for adverse impact; Mentium's positioning as one predictive input to a human decision, with no reject path, is deliberate.

### Proper use

The propensity framing runs through every surface. Mentium predicts, it does not measure; it informs a human judgement, it does not decide; it produces a score, not a credential. The fairness logic is structural rather than cosmetic: there is no automated cut-off in the scoring, the report states the "predicts not measures" rule on its face, and norm-referenced claims are gated behind a sample size and a reliability threshold so the instrument cannot quietly over-claim. Validated high-stakes use additionally requires a criterion-validity study, an adverse-impact analysis, and a psychometrician's sign-off - none of which Tier 1 asserts.

### Confidentiality

A Mentium result is confidential personal data. Results are admin-SELECT only and reachable only through the service-role route; a no-account taker cannot retrieve a downloadable report by guessing a session identifier. Where a result is bound to a candidate and engagement, it is handled within the same access controls as that candidate's other assessment data.

### Retention

Mentium data follows the platform's default data-retention rule - a maximum of two years unless a contract extends it - consistent with UAE Federal Decree-Law No. 45 of 2021, the Saudi PDPL, and GDPR where applicable, and with the platform's consent-before-collection and immutable audit-trail commitments.

---

## 8. Bilingual availability

Mentium is delivered bilingually. Items, options, subtest definitions, score-band narratives and interpretation bands exist in English and in Modern Standard Arabic, and a taker sits the test in either language on one consistent scoring basis - the same subtest keys, the same correct-answer keys, the same g composite. The AI item writer produces items directly in the requested language rather than back-translating, and the fallback deck is authored bilingually. The professional result report PDF is currently English-only (React-PDF does not shape Arabic; a Puppeteer port can follow when a bilingual report is prioritised). Arabic content is best-effort pending human review before high-stakes use, per project convention.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

*VIFM Mentium - Cognitive Reasoning Ability - Methodology Brief v1.0.*
