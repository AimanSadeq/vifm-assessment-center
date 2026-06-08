# Self-Report Scale — Cluster 1: Strategic & Commercial Reasoning (Both Forms)

**Companion to:** `competency-items-cluster1.md` (SJT/CBI) ·
`competency-framework-research-grounding.md` (citations).
**Purpose:** Make the **ipsative-vs-normative** decision concrete on a small
surface before scaling. The same five competencies are written **twice**:

- **Form A — Normative (Likert):** for **development / 360 / Reflect**. Simple,
  comparable across people, easy to give feedback on. (Vulnerable to faking — an
  acceptable trade-off in low-stakes development.)
- **Form B — Ipsative (forced-choice, TIRT-scored):** for **selection /
  pre-hire**. Faking-resistant, and — scored with Thurstonian IRT — still
  produces normatively comparable scores that can be percentile-ranked.

Competencies (see design doc §4 for definitions):
1. Forward Strategy Setting · 2. Commercial & Market Awareness ·
3. Financial Literacy & Acumen · 4. Critical Analysis · 5. Sound Judgement.

---

## Form A — Normative (Likert)

**Response scale (agreement, 5-point):**
1 = Strongly disagree · 2 = Disagree · 3 = Neither · 4 = Agree · 5 = Strongly agree.

**Keying:** (+) scored as-is; **(R)** reverse-scored (score = 6 − raw). Each
competency = mean of its 4 items. Reverse items guard against acquiescence
(yes-saying) bias.

### 1. Forward Strategy Setting
- a. I think several years ahead about how my market could change. **(+)**
- b. I connect day-to-day decisions to a longer-term direction. **(+)**
- c. I focus on immediate targets rather than future shifts. **(R)**
- d. I anticipate how regulation or competition might reshape my area. **(+)**

### 2. Commercial & Market Awareness
- a. I keep close track of competitor and market moves in my industry. **(+)**
- b. I factor the wider economic climate into business decisions. **(+)**
- c. I find it hard to see how external trends affect my work. **(R)**
- d. I spot commercial opportunities that others miss. **(+)**

### 3. Financial Literacy & Acumen
- a. I am comfortable interpreting financial statements and ratios. **(+)**
- b. I use financial data to weigh trade-offs in decisions. **(+)**
- c. I rely on others to explain the financial implications of choices. **(R)**
- d. I can quickly read what a set of financial indicators is signalling. **(+)**

### 4. Critical Analysis
- a. I test the assumptions behind a conclusion before accepting it. **(+)**
- b. I break complex problems into parts to understand them. **(+)**
- c. I tend to accept reports at face value. **(R)**
- d. I weigh evidence carefully before forming a view. **(+)**

### 5. Sound Judgement
- a. I make balanced decisions even when information is incomplete. **(+)**
- b. I consider the knock-on consequences of my decisions. **(+)**
- c. I delay decisions until I have complete certainty. **(R)**
- d. People trust my judgement on difficult calls. **(+)**

> **Scoring (normative):** competency score = mean of 4 items (1–5); cluster
> score = mean of 5 competency scores. Directly comparable across people →
> supports percentile norms **once a norm sample exists**.

---

## Form B — Ipsative (forced-choice, Thurstonian-IRT scored)

**How it's presented:** the respondent sees **blocks** of statements (here,
triplets), each drawn from a **different** competency and matched for
desirability, and marks which is **MOST** and which is **LEAST** like them. Because
the statements are similarly desirable, the choice reveals true relative standing,
not impression management.

### Statement pool (3 per competency)

| Code | Competency | Statement |
|---|---|---|
| A1 | Forward Strategy Setting | I plan for how my market might look years from now. |
| A2 | Forward Strategy Setting | I link today's choices to a long-term direction. |
| A3 | Forward Strategy Setting | I anticipate shifts in regulation or competition. |
| B1 | Commercial & Market Awareness | I track what competitors and the market are doing. |
| B2 | Commercial & Market Awareness | I weigh the economic climate in my decisions. |
| B3 | Commercial & Market Awareness | I notice commercial opportunities early. |
| C1 | Financial Literacy & Acumen | I read financial statements with confidence. |
| C2 | Financial Literacy & Acumen | I use the numbers to weigh trade-offs. |
| C3 | Financial Literacy & Acumen | I quickly grasp what financial indicators signal. |
| D1 | Critical Analysis | I test the assumptions behind a claim. |
| D2 | Critical Analysis | I break complex problems into clear parts. |
| D3 | Critical Analysis | I weigh the evidence before deciding. |
| E1 | Sound Judgement | I decide well even without complete information. |
| E2 | Sound Judgement | I think through the knock-on effects of a decision. |
| E3 | Sound Judgement | Others rely on my judgement in tough calls. |

### Block design (balanced — each competency appears 3×, never twice in a block)

| Block | Statements (pick MOST / LEAST like you) |
|---|---|
| 1 | A1 · B1 · C1 |
| 2 | B2 · C2 · D1 |
| 3 | C3 · D2 · E1 |
| 4 | D3 · E2 · A2 |
| 5 | E3 · A3 · B3 |

*Each block shows the three statement texts (not the codes) in randomised order.*

> **Scoring (ipsative → TIRT):** each MOST/LEAST response implies pairwise
> preferences within the block. A **Thurstonian IRT** model (Brown &
> Maydeu-Olivares, 2011) estimates each person's latent score on all five
> competencies from these comparisons — recovering **between-person-comparable**
> scores that *can* be normed, while keeping the faking resistance of
> forced-choice. (Classic ipsative sum-scoring would **not** be normable — that's
> the whole reason to use TIRT.)

---

## Implementation notes for a production TIRT scale

This worked model is enough to make the format decision and to pilot. Before
high-stakes use, the production version needs:

1. **Empirical desirability matching.** Have a sample rate each statement's
   social desirability; build blocks from statements with *similar* ratings. (The
   draft above is matched by judgement — confirm it with data.)
2. **Mixed keying.** Include some **negatively-keyed** statements across blocks;
   mixing keyed direction improves trait recovery and model identification in
   TIRT (Brown & Maydeu-Olivares, 2011).
3. **Coverage.** Each competency should appear in **≥ 3 blocks** (met here);
   more blocks → more reliable estimates. Triplets or quads are both fine.
4. **Calibration sample.** TIRT parameter estimation needs a reasonable
   calibration N (typically several hundred); plan this into the pilot.
5. **Fit & reliability.** Check model fit and empirical reliability of the
   recovered scores before reporting individual results.

> Caliber wiring: **Form A (Likert)** is the natural fit for the **Reflect /
> 360** path; **Form B (forced-choice/TIRT)** is the fit for the **pre-hire /
> selection** path. Both draw on the same five competencies, so a candidate can
> be assessed developmentally or for selection from one framework.

---

## Research grounding

Item content is grounded in the same peer-reviewed sources as the competencies
(see `competency-framework-research-grounding.md`): Liedtka (1998) / Mintzberg
(1994); Wagner & Sternberg (1985); Lusardi & Mitchell (2014); Facione (1990) /
Halpern (1998); Kahneman & Klein (2009).

**Forced-choice / TIRT method:**
- Brown, A., & Maydeu-Olivares, A. (2011). Item response modeling of
  forced-choice questionnaires. *Educational and Psychological Measurement*,
  71(3), 460–502.

---

*Next on approval: apply both forms across Clusters 2–8, and run the empirical
desirability-rating step to finalise the forced-choice blocks.*
