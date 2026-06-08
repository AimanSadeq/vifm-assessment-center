# Competency Items — Cluster 1: Strategic & Commercial Reasoning (Worked Model)

**Companion to:** `competency-framework-v2-design.md` (definitions) and
`competency-framework-research-grounding.md` (citations).
**Scope:** Worked example for the 5 competencies in Cluster 1. Once the format
and scoring are approved here, the same pattern scales to the other 7 clusters.

---

## 0. Ipsative vs. normative measurement — the choice, and my recommendation

This is the response-format decision, and it has direct consequences for the
norm-group question you raised earlier.

| | **Normative** (rating scale) | **Ipsative** (forced-choice) |
|---|---|---|
| **How it works** | Rate each statement on its own scale (e.g., 1–5 Likert) | Choose/rank among options balanced for desirability ("most / least like me") |
| **Score meaning** | Absolute level, **comparable across people** | **Relative strength within the person** (scores sum to a constant) |
| **Faking / social desirability** | Vulnerable (also acquiescence, halo) | Strongly resistant |
| **Norm-referencing (percentiles vs peers)** | Supported directly | **Broken** for classic ipsative — can't be normed properly |
| **Reliability / correlations** | Standard methods apply | Distorted by the ipsative constraint |

**The modern resolution — Thurstonian IRT (TIRT) forced-choice.** TIRT recovers
**quasi-normative, between-person-comparable** scores *from* forced-choice items
— keeping the faking resistance **and** restoring the ability to norm. This is
current best practice for high-stakes forced-choice, and it's exactly what
Caliber's `psychometrics-proposal.md` already points to.

**Recommendation (by use case):**
1. **Selection / pre-hire (high-stakes):** **forced-choice scored with
   Thurstonian IRT.** You get faking resistance *and* normatively comparable
   scores that can be percentile-ranked.
2. **Development / 360 / Reflect:** **normative Likert** is fine and simpler —
   faking matters less, and it's easier to give feedback on.
3. **If clients want peer percentiles (your norm-group ask):** use **normative**
   or **TIRT-recovered** scores — **avoid classic ipsative**, which cannot be
   normed. (Either way, the percentiles still need an actual norm sample to
   exist first.)
4. **Knowledge / SJT items** are scored objectively against a key
   (criterion-referenced) — a separate axis from ipsative/normative. Note the
   **MOST/LEAST SJT format below is structurally forced-choice**, so it inherits
   ipsative-style faking resistance at the item level.

Below, each competency has **(A) a criterion-keyed SJT item** (the MOST/LEAST
forced-choice form) and **(B) a behavioural interview (CBI) question** scored
against BARS — so you see both a machine-scorable and an assessor-rated form. The
**ipsative-vs-normative choice bites hardest on the self-report scales** (the
next deliverable), where I'll author **both** a Likert (development) and a
forced-choice/TIRT (selection) version.

---

## 1. Forward Strategy Setting
*Research basis: Liedtka (1998); Mintzberg (1994).*

**(A) SJT — objective key.** You lead a retail banking unit. A fintech is rapidly
taking payment share among under-30 customers, and the regulator has signalled
open-banking rules within ~18 months. The board wants this quarter's targets
protected. Mark the **MOST** and **LEAST** effective action:

- A. Keep the team focused on this quarter's targets; revisit the fintech threat
  next year.
- B. Commission a scenario analysis of the open-banking impact and shape a 2–3
  year response **while** protecting near-term targets.
- C. Immediately cut current product investment to fund an untested digital
  wallet.
- D. Wait for competitors to move, then copy the winning approach.

**Key:** MOST = **B**, LEAST = **A**. *Scoring (objective):* +2 correct MOST, +2
correct LEAST; C and D are weak (reactive/over-reactive) and score 0 if chosen as
MOST. Max 4.

**(B) CBI.** "Tell me about a time you set a direction for your team that looked
beyond the immediate targets to account for a change in the market or rules."
*Probes:* What signals did you read? How far ahead did you plan? What did you
trade off? *Score* against BARS levels 1–5 (see design doc §5).

## 2. Commercial & Market Awareness
*Research basis: Wagner & Sternberg (1985) — practical intelligence / tacit knowledge.*

**(A) SJT — objective key.** A long-standing corporate client in construction
requests expanded credit. Oil prices have fallen 20% over two quarters, and the
client's main revenue is government infrastructure spending. MOST / LEAST
effective:

- A. Approve based on the long relationship and clean repayment history.
- B. Assess the client's exposure to government spending under the new
  oil-price environment **before** deciding.
- C. Decline outright to avoid all risk.
- D. Approve a smaller facility with covenants tied to confirmed government
  contracts.

**Key:** MOST = **B**, LEAST = **A**. D is a strong second (partial credit +1).
C is overly risk-averse (0). Max 4.

**(B) CBI.** "Describe a decision where reading the wider market or economic
context changed what you recommended." *Probes:* What signals mattered? What
would the naïve call have been? *Score against BARS.*

## 3. Financial Literacy & Acumen
*Research basis: Lusardi & Mitchell (2014).*

**(A) Objective knowledge item — single best answer.** A bank reports rising net
interest income, but its CET1 ratio fell from 13% to 10.5% and its NPL ratio rose
from 2% to 4%. Which interpretation is most accurate?

- A. Profitability gains are sustainable; capital and asset quality are not a
  concern.
- B. Despite higher income, weakening capital adequacy and rising NPLs signal
  increasing risk that could constrain growth. ✅
- C. The falling CET1 ratio is irrelevant as long as income is growing.
- D. Rising NPLs indicate stronger lending volume and are a positive sign.

**Key:** **B** (1 point, objective 1/0). *This is the purest "objective" item —
a single veridically correct reading.*

**(B) CBI.** "Walk me through a time you used financial data to challenge or
support a business decision." *Probes:* Which indicators? What trade-off did the
numbers reveal? *Score against BARS.*

## 4. Critical Analysis
*Research basis: Facione (1990); Halpern (1998).*

**(A) SJT — objective key.** A report states: "Branch X is our best performer — it
has the highest deposit growth." Branch X opened 6 months ago in a new
high-income district. MOST / LEAST effective response:

- A. Accept it and roll out Branch X's tactics across the network.
- B. Examine whether the growth is driven by location/market factors vs. branch
  practices before drawing lessons.
- C. Dismiss the report — new branches always grow fast.
- D. Rank all branches by deposit growth and reward the top quartile.

**Key:** MOST = **B**, LEAST = **A**. C is the opposite error (unjustified
dismissal); D repeats the same confound — both 0 if chosen as MOST. Max 4.

**(B) CBI.** "Tell me about a time you questioned a conclusion that others had
accepted. What did you find?" *Probes:* What assumption did you test? What
evidence changed your view? *Score against BARS.*

## 5. Sound Judgement
*Research basis: Kahneman & Klein (2009).*

**(A) SJT — objective key.** A suspected fraud pattern appears in a major client's
transactions. Confirming it will take ~48 hours; freezing now could damage a key
relationship; doing nothing risks a regulatory breach and loss. MOST / LEAST
effective:

- A. Wait for full confirmation to avoid upsetting the client.
- B. Apply targeted holds/monitoring on the suspicious activity, expedite the
  investigation, and inform compliance.
- C. Freeze all of the client's accounts immediately.
- D. Escalate to compliance but take no interim action.

**Key:** MOST = **B** (proportionate, time-sensitive), LEAST = **A**. C is an
over-reaction, D is insufficient — partial logic but 0 as MOST. Max 4.

**(B) CBI.** "Describe a high-stakes decision you made with incomplete
information and time pressure." *Probes:* What did you weigh? What were the
second-order consequences? Would you decide the same again? *Score against BARS.*

---

## Scoring & assembly notes

- **SJT keys** here are *theory/expert-seeded*. Before high-stakes use, confirm
  each key with a small expert panel (SME effectiveness ratings) and check item
  statistics on pilot data (difficulty, discrimination) — this is the objective
  key's validation step, not a norm group.
- **CBI/BARS** items are criterion-referenced by design (rate against the role's
  target proficiency), so they need **no** norm group either.
- **Normative percentiles** can be generated from the same item responses *later*
  by accumulating scores into role-segmented norms — added as a report layer, not
  a prerequisite.
- **Bias/fairness:** review scenarios for cultural loading before Arabic
  adaptation (ITC Test Adaptation guidelines).

---

*Next on approval: replicate this two-format pattern across Clusters 2–8, and
(optionally) draft forced-choice self-report items for the development/360 use
case.*
