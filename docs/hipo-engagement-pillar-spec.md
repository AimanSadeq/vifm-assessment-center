# HiPo Engagement Pillar - Spec (v1)

Status: SPEC ONLY - not built. Complements the shipped VIFM High-Potential Profile
(Persona Aspiration x Persona+Logica Ability nine-grid). Adds the third element a
credible high-potential decision needs: ENGAGEMENT - the likelihood the person
stays and grows with the organisation.

## 1. Construct and honest positioning

- Engagement cannot be read from the candidate's own assessment sitting: a
  self-report in an evaluative context is systematically inflated. The current
  report says so and directs it to the manager/HR conversation.
- This spec structures that conversation: a short survey the LINE MANAGER
  answers about the individual. One rater, observable judgements, ~3 minutes.
- It stays a judgement, not a measurement. The report labels it "manager-rated,
  single rater, indicative" and it is never a reject signal - it changes the
  development conversation, not the nomination arithmetic.

## 2. Instrument (6 items, 1-5 Likert, bilingual EN/AR)

Manager rates agreement (1 Strongly disagree ... 5 Strongly agree). All items are
observable manager judgements - no mind-reading, no sentiment guessing.

1. **Future here** - "They talk about their future in terms of this organisation."
2. **Discretionary effort** - "They routinely give effort beyond what the role requires."
3. **Acts on development** - "When given feedback or learning opportunities, they visibly act on them."
4. **Retention risk (reverse-keyed)** - "I see signals they may leave us within the next year."
5. **Purpose alignment** - "They connect their work to the organisation's purpose and priorities."
6. **Internal appetite** - "They actively seek bigger responsibility inside this organisation."

Plus one OPTIONAL free-text context box (not scored; surfaces verbatim in the
consultant view only, never in the client PDF).

## 3. Scoring

- Score = mean of answered items (item 4 reverse-keyed), minimum 5 of 6 answered.
- Same shared 1-5 scale and the same HIPO_CUTS bands (Developing < 3.0, Solid
  3.0-3.8, Strong 3.8+), so all three pillars read identically.

## 4. How it renders (deliberately NOT a third grid axis)

- The nine-grid stays Aspiration x Ability - a 27-cell model would destroy the
  readability Ahmad praised. Engagement renders as:
  - a third gauge on page 1 next to the two pillar gauges ("Engagement - will
    they stay? · manager-rated"), and
  - an OVERLAY note on the placement panel when the combination warrants it:
    - High Potential / Emerging Potential + Engagement Developing ->
      "Retention caution - secure engagement before heavy investment."
    - Untapped Expert + Engagement Strong -> "Stay-and-grow profile - expert
      track likely fits better than exit risk suggests."
- Absent survey -> the report renders exactly as today (two pillars + the
  existing manager-conversation line). Fully backward compatible.

## 5. Delivery mechanics (reuse the token-rater pattern)

- **Table** `hipo_engagement_surveys`: id, bundle_candidate_id FK,
  manager_name, manager_email, access_token (uuid), answers jsonb,
  context_note text, completed_at, created_at. RLS: admin all; client_manager
  SELECT scoped via the candidate's organization_id; NO public SELECT - the
  token route reads via service role (mirrors Reflect raters).
- **Token route** `/hipo/engage/[token]` (middleware auth-bypass for the
  prefix), single-use: completed surveys refuse re-entry. Bilingual form,
  6 Likert rows + context box, one submit.
- **Invite** - "Invite manager" button on the bundle candidate row (admin +
  client portal), asks name + email, sends a bilingual email template
  (`hipo_engagement_invitation`) via the existing Graph module; copy-link
  fallback per the deliverability lesson.
- **Data loader** - `buildHipoPdfData` reads the latest completed survey for
  the candidate; adds `engagement: number | null` + per-item detail to
  `HipoPdfData`.

## 6. Guardrails

- Single-rater manager judgement: prone to recency and halo bias - stated in
  the report's methodology block.
- Never blended into Ability/Aspiration and never a selection cut - overlay
  language only.
- Manager identity shown to consultants/admins; the client PDF says
  "manager-rated" without exposing the free-text context.

## 7. Estimate

Migration + token form + invite email + loader/report changes: about one day,
following the established Reflect rater conventions. No new infrastructure.
