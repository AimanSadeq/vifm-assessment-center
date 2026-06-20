# VIFM Academy - Methodology Brief

*How VIFM Academy delivers a recommended course, what the per-lesson knowledge-check measures, why the completion certificate is sellable, and what it honestly does not certify.*

---

## 1. Why this exists

VIFM is, at its root, a training company. Its assessment modules - the VIFM-AC observed assessment, the AI Readiness Compass, Reflect 360, Persona, Fluent - are all *diagnostic*: they tell an organisation where a person or a workforce stands. A diagnosis is only useful if something can be done about it, so the platform runs a four-step loop: **diagnose -> recommend -> deliver -> certify.** The diagnostic modules produce gaps; the VIFM Courses recommender turns those gaps into a ranked list of relevant VIFM programmes; **VIFM Academy is the deliver step**; and VIFM Credentials is the certify step.

This brief documents the deliver step and its tie to certify. Academy takes a VIFM course and turns it into a self-paced learning experience for a candidate, with a knowledge-check at the end of each lesson, a completion gate, and - only when that gate is cleared - an automatically issued, publicly verifiable completion credential.

The single most important design decision in Academy is the pass-gate: a course completes and certifies only when the learner has **passed** every lesson's knowledge-check, not merely attempted it. Everything below flows from that decision, because it is what makes a "VIFM Academy course completion" a claim worth putting a learner's name to.

---

## 2. What Academy delivers - the unit of learning

### A course is a structure of lessons

Academy does not author new content. It consumes the VIFM course catalogue (the same `vifm_courses` records the recommender ranks) and renders one of them as a learning experience. A course carries a structured outline - the seven content blocks of a VIFM programme, including the lesson-by-lesson outline.

A **lesson** in Academy maps to exactly one top-level section of the course outline. The mapping is deliberate and explicit: `src/lib/academy/lesson-key.ts` builds an index-prefixed, slugified key for each outline section (`lessonKeyFor(title, index)`), and recovers the section index back from that key (`indexFromLessonKey`). The index prefix means the key stays unique and resolvable even when two sections share a title, or a section has an Arabic-only title with no Latin characters. Both the course-consumption page (which renders the lesson navigation) and the lesson page (which resolves a key back to its outline section) import the same helper, so the slug is consistent across the two surfaces.

### The empty-outline rule

A course with no outline sections is not a degenerate case to be rejected; it collapses to a single virtual "Overview" lesson whose content is the course overview and objectives. The lesson count is therefore `max(1, number of outline sections)` - enforced identically in `src/lib/academy/complete.ts` (`lessonCount`) and in the per-lesson completion route. A course always has at least one lesson to pass.

---

## 3. How a lesson is delivered and scored

### The knowledge-check is the reused quiz engine, grounded in the lesson

Academy does not build a separate assessment engine. A lesson knowledge-check reuses the platform's existing quiz engine verbatim (`src/lib/ai/quiz-generator.ts`, the same generator the candidate self-serve quiz uses). When a learner starts a lesson (`POST /api/academy/lesson/start`), the route resolves the outline section, flattens its bullets and sub-bullets into plain text, and passes that lesson content to the generator as grounding. The generator returns a short deck (the route trims to roughly five questions per lesson) mixing multiple-choice, true/false, and a pattern-recognition item, each with a written explanation a learner reads after answering.

The questions are grounded in the lesson's own content - the bullets become the source material - so a knowledge-check tests comprehension of *that* lesson, not general knowledge. The questions and answers are stored as JSONB on the attempt row so the deck is reproducible.

### Deterministic fallback - the flow never depends on AI being configured

The AI call is best-effort. When `ANTHROPIC_API_KEY` is absent, or the model returns nothing usable, the start route falls back to a small deterministic comprehension deck built directly from the lesson's own bullets (`fallbackQuestions`), always returning at least three questions. The learning flow therefore works end to end with or without an AI key; the difference is question richness, not whether a lesson can be taken.

### Scoring is points-weighted and server-side

When a learner finishes a lesson check (`POST /api/academy/lesson/[attemptId]/complete`), the route scores the stored answers against the stored questions: each question carries points (easy 10, medium 15, hard 20), and `score_pct = round(earned / possible * 10000) / 100`. A lesson is **passed** when `score_pct >= passing_score_pct` (default 70). Scoring runs server-side against the stored deck, and the route is idempotent - a re-POST recomputes the same pass/fail without mutating an already-finalised row.

### Idempotent at every step

Enrollment is idempotent on (candidate, course): a re-click returns the existing enrollment and never resets progress (`POST /api/academy/enroll`). Lesson start is idempotent on (enrollment, lesson key): a mid-check refresh returns the existing attempt rather than regenerating a fresh deck, and a unique-violation race is caught and resolved to the existing row. This means a learner can navigate away and back without losing answered questions or being handed a different test.

---

## 4. The deliverables - what a completed course produces

A learner moving through Academy produces three things:

- **A learning record per lesson.** Each `academy_lesson_attempts` row records the questions served, the answers given, the points-weighted `score_pct`, the correct count, the time taken, and the pass threshold in force. This is the evidence behind a completion claim.
- **A completed enrollment.** When every lesson is passed, the enrollment is marked `completed` with a timestamp.
- **An academy_completion credential.** On completion, `markEnrollmentComplete` issues a VIFM credential through the shared issuer (`src/lib/credentials/issue.ts`). The credential carries the course title (English and Arabic), a subtitle of level and vertical, the **average of the learner's best passing scores** as its `score_pct`, and metadata recording passed-lessons and total-lessons. It is keyed on `source_id = enrollment id`, so it is issued once per enrollment and never double-issued.

The credential is the hand-off into the certify step. It is publicly verifiable: the issuer assigns a `verification_code` (a UUID), and the public `/verify/[code]` page plus `/api/credentials/verify/[code]` route resolve it through a service-role reader that returns only non-sensitive fields (never the candidate id, source id, or metadata). An `academy_completion` credential carries a three-year default validity and is renewable by issuing a fresh row. A revoked or expired credential still resolves at the verify URL, but renders as not currently valid.

---

## 5. What Academy is, and what it is not

- **It is a delivery and completion-certification step, not an independent proficiency exam.** Academy certifies that a learner *completed a course and passed its knowledge-checks*. The credential is a completion claim about that course, not a norm-referenced or criterion-validated measure of standalone competence.
- **The knowledge-checks are AI-generated and grounded in the course outline, not a calibrated item bank.** There is no IRT calibration, no item-difficulty modelling, no published norms behind a lesson check. Difficulty labels are authoring guidance, not psychometric parameters.
- **The pass threshold is a fixed mastery cut (default 70 percent), not a percentile.** A learner is compared against the bar, not against a peer distribution.
- **It does not replace the diagnostic modules.** Academy delivers against a gap that a VIFM-AC, ARC, Reflect 360, Persona, or Fluent diagnosis surfaced. It closes the loop; it does not re-open the diagnosis.

These limits are deliberate and they are honest: the completion credential means exactly what it says - the named learner completed this course and passed every lesson check at or above the threshold - and nothing more.

---

## 6. The pass-gate: why a completion certificate is sellable

This is the load-bearing design choice of the entire module. A "course complete" badge is worthless if it is awarded for clicking through to the end. Academy's gate is that a course completes and certifies **only when the learner has passed every lesson's knowledge-check** - passed, defined as best `score_pct >= passing_score_pct` (default 70) for that lesson - not merely attempted it.

### Passed, not attempted - counted by distinct passed lessons

`passSummary` in `src/lib/academy/complete.ts` walks every completed attempt for an enrollment, keeps the learner's **best** score per lesson key, and counts a lesson as passed only when that best score clears its threshold. The number of distinct passed lessons is then compared against the course's lesson count. If `passedLessons < totalLessons`, `markEnrollmentComplete` returns `reason: "not_passed"` and the course is **not** marked complete and **no** credential is issued. The completion routes map that reason to an HTTP 400 with the passed-versus-total counts, so a learner sees exactly how many lessons still need to be passed.

### Enforced in lock-step at three sites

The same passed-not-attempted rule, with the same default-70 threshold and the same empty-outline-counts-as-one-lesson convention, is enforced at three places that can each finalise a course:

1. The course page's Complete button path, via `POST /api/academy/complete`.
2. The course-level completion route itself (`/api/academy/complete`), which calls `markEnrollmentComplete`.
3. The per-lesson completion route (`/api/academy/lesson/[attemptId]/complete`), which after scoring the final lesson recomputes distinct passed lessons against the course lesson count and only then calls `markEnrollmentComplete`.

Keeping all three call sites in lock-step is what guarantees the invariant the module is sold on: a "course complete" claim can never appear without a passing credential behind it. The credential carries the average of the learner's best passing scores, which renders as a score line on the certificate, so the certificate states not just that the course was completed but the standard at which it was passed.

### The credential write never blocks completion, and never double-issues

Credential issuance is best-effort by design: `issueCredential` logs and returns null on failure rather than throwing, so a transient credential write failure cannot unwind a legitimately completed course (an admin can re-issue). And `markEnrollmentComplete` checks for a prior `academy_completion` credential on the same `source_id` before issuing, returning the existing code rather than minting a second - so the gate is idempotent and a learner ends a passed course with exactly one verifiable credential.

---

## 7. Fairness, proper use, confidentiality and retention

### Standards the module is held to

Academy is a completion-certification mechanism, so the recognised standards apply to how its credential may be relied upon:

- **ITC Guidelines on Test Use** - on the responsibilities of those who administer and interpret assessment results, including not over-claiming what a knowledge-check establishes.
- **Standards for Educational and Psychological Testing** (AERA / APA / NCME, 2014) - referenced for the discipline of matching claims to evidence. Academy's claim is scoped precisely to course completion at a stated pass standard, not to independent proficiency, because that is what the evidence supports.

The EEOC Uniform Guidelines on Employee Selection Procedures are not invoked here: Academy is a training-delivery and completion step, not a selection instrument. The completion credential is not a screening score and the module has no reject path.

### Proper use

The completion credential certifies completion of a passed course. It should be read as evidence of learning completed to a standard, not as a validated measure of on-the-job competence; the diagnostic modules remain the source for competence signals. The pass-gate is structural rather than cosmetic - it lives in code, enforced in three lock-step sites - so a completion claim is meaningful wherever it is presented.

### Confidentiality and access

Per-lesson answers, scores, and completion records are confidential personal data. Enrollment, lesson, and completion routes are ownership-gated: each verifies the caller is an administrator or the candidate who owns the enrollment or attempt before scoring or issuing anything, and the gate runs before any AI generation so a non-owner can never drive a paid model call. Public verification exposes only non-sensitive credential fields through a service-role reader; there is no public table read of learning records or credentials.

### Retention

Academy data follows the platform's default retention rule - a maximum of two years unless a contract extends it - consistent with UAE Federal Decree-Law No. 45 of 2021, the Saudi PDPL, and GDPR where applicable, and with the platform's consent-before-collection and immutable audit-trail commitments. A completion credential carries a longer three-year validity as a verifiable record of an attainment, renewable by re-issue.

---

## 8. Bilingual availability

Academy is bilingual. A course outline carries English and Arabic titles, and the lesson key is built to stay stable for Arabic-only section titles (the index prefix makes a key resolvable even when the title slugifies to nothing in Latin script). The knowledge-check generator is asked for bilingual decks - prompts, options, and explanations in English and Modern Standard Arabic suitable for GCC banking and government professionals - and the completion credential carries both an English and an Arabic title, so the verifiable record reads correctly in either language. Arabic content is best-effort pending human review before high-stakes use, per project convention.

---

## 9. Contact

For methodology questions or research-collaboration enquiries, contact the VIFM consulting team: `contact@viftraining.com`.

---

*VIFM Academy - Course Delivery and Completion Certification - Methodology Brief v1.0.*
