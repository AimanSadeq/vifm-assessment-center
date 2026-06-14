import { createServiceClient } from "@/lib/supabase/server";
import type { AraPillarId } from "@/types/ara";

/**
 * Response-validity ("distortion") detection.
 *
 * Modelled on faking / response-bias techniques used in commercial
 * psychometric platforms (Competitor One, Competitor Two, etc.).
 * The Compass cannot detect intentional faking with certainty, but it
 * can flag respondents whose answer pattern is statistically
 * inconsistent with the population, suggesting the consultant should
 * validate their input before relying on it.
 *
 * Three signals combined into one score (0..100, higher = more
 * suspicious):
 *
 *   1. EXTREMITY        - share of answers at the extremes (1 or 5).
 *                         Faking-good shows >80% 5s; faking-bad shows
 *                         >80% 1s; honest respondents typically land
 *                         30-60% extreme.
 *   2. STRAIGHT-LINING  - longest run of identical answers in
 *                         submission order. A run of >= 8 is a red flag.
 *   3. ANCHOR DEVIATION - mean of this respondent's answers vs the
 *                         pillar-level peer mean from the same
 *                         assessment. A delta > 1.5 points is
 *                         suspicious (relative outlier).
 *
 * The function is read-only. It does not mutate the database. The
 * consultant detail page calls it on render and surfaces the flag.
 */

export type DistortionLevel = "clean" | "watch" | "high";

export interface DistortionResult {
  respondent_id: string;
  respondent_name: string;
  total_responses: number;
  /** 0..100, higher = more suspicious. */
  distortion_score: number;
  level: DistortionLevel;
  signals: {
    extremity_pct: number;      // share of 1s or 5s
    longest_run: number;        // straight-lining
    anchor_deviation: number;   // |respondent_mean - pillar_mean|
  };
  /** Human-readable reasons for the flag (empty for clean). */
  reasons: string[];
}

interface ResponseRow {
  respondent_id: string;
  question_score: number | null;
  answered_at: string;
  question: { pillar_id: AraPillarId | null; question_type: string | null } | null;
}

// Graded individual-factor items have an objective right answer, so their score
// distribution must NOT feed faking detection (a correct answer is not "extreme"
// or "straight-lining"). Excluded from every distortion signal.
const GRADED_QUESTION_TYPES = new Set(["situational_judgment", "knowledge_check"]);

interface RespondentRow {
  id: string;
  name: string;
}

/**
 * Computes distortion scores for every respondent on an assessment.
 * Returns one entry per respondent. Respondents with fewer than 5
 * answered questions are skipped (insufficient data).
 */
export async function computeAraDistortion(assessmentId: string): Promise<DistortionResult[]> {
  const sb = createServiceClient();

  const [{ data: respondents }, { data: rows }] = await Promise.all([
    sb
      .from("ara_respondents")
      .select("id, name")
      .eq("assessment_id", assessmentId)
      .returns<RespondentRow[]>(),
    sb
      .from("ara_responses")
      .select("respondent_id, question_score, answered_at, question:ara_questions(pillar_id, question_type)")
      .eq("assessment_id", assessmentId)
      .order("answered_at"),
  ]);

  const allRows = ((rows ?? []) as unknown as ResponseRow[]).filter(
    (r) => !GRADED_QUESTION_TYPES.has(r.question?.question_type ?? "")
  );

  // Population pillar means - used as the comparison anchor for each
  // respondent's pillar mean.
  const pillarSums = new Map<AraPillarId, { sum: number; n: number }>();
  for (const r of allRows) {
    const pid = r.question?.pillar_id ?? null;
    if (!pid || r.question_score == null) continue;
    const s = pillarSums.get(pid) ?? { sum: 0, n: 0 };
    s.sum += Number(r.question_score);
    s.n += 1;
    pillarSums.set(pid, s);
  }

  const results: DistortionResult[] = [];

  for (const r of respondents ?? []) {
    const myRows = allRows.filter((x) => x.respondent_id === r.id && x.question_score != null);
    if (myRows.length < 5) continue;

    const scores = myRows.map((x) => Number(x.question_score));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Signal 1: extremity. Share of answers at 1 or 5.
    const extreme = scores.filter((s) => s <= 1.0 || s >= 5.0).length;
    const extremityPct = extreme / scores.length;

    // Signal 2: straight-lining. Longest run of identical answers in
    // submission order.
    let longestRun = 1;
    let currentRun = 1;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] === scores[i - 1]) currentRun++;
      else { longestRun = Math.max(longestRun, currentRun); currentRun = 1; }
    }
    longestRun = Math.max(longestRun, currentRun);

    // Signal 3: anchor deviation. Compare this respondent's pillar
    // means to the population pillar means.
    let totalDelta = 0;
    let pillarsCounted = 0;
    const myPillarSums = new Map<AraPillarId, { sum: number; n: number }>();
    for (const row of myRows) {
      const pid = row.question?.pillar_id;
      if (!pid) continue;
      const s = myPillarSums.get(pid) ?? { sum: 0, n: 0 };
      s.sum += Number(row.question_score);
      s.n += 1;
      myPillarSums.set(pid, s);
    }
    for (const [pid, mine] of Array.from(myPillarSums.entries())) {
      const pop = pillarSums.get(pid);
      if (!pop || pop.n === 0) continue;
      const myMean = mine.sum / mine.n;
      const popMean = pop.sum / pop.n;
      totalDelta += Math.abs(myMean - popMean);
      pillarsCounted += 1;
    }
    const anchorDeviation = pillarsCounted > 0 ? totalDelta / pillarsCounted : 0;

    // Combine into a 0..100 score. Each signal contributes up to ~33
    // points; clamp to 100. Tuning is empirical - these constants
    // produce a usable signal on the seed data and should be revisited
    // once we have real respondents to calibrate against.
    const extremityComponent = Math.min(33, extremityPct * 50);   // 80% extreme -> ~40 -> capped 33
    const lineComponent      = Math.min(33, Math.max(0, longestRun - 3) * 6); // run of 8+ -> 30+
    const deltaComponent     = Math.min(34, anchorDeviation * 22); // delta of 1.5 -> 33
    const distortionScore = Math.round(extremityComponent + lineComponent + deltaComponent);

    const level: DistortionLevel =
      distortionScore >= 60 ? "high" :
      distortionScore >= 30 ? "watch" :
      "clean";

    const reasons: string[] = [];
    if (extremityPct > 0.7) {
      reasons.push(
        `${Math.round(extremityPct * 100)}% of answers at the extreme (${
          mean > 4 ? "leaning positive - possible faking-good" :
          mean < 2 ? "leaning negative - possible faking-bad" :
          "highly polarised pattern"
        })`
      );
    }
    if (longestRun >= 8) {
      reasons.push(`Straight-line of ${longestRun} identical answers in a row`);
    }
    if (anchorDeviation > 1.0) {
      reasons.push(
        `Mean answer drifts ${anchorDeviation.toFixed(1)} points from peer average on the same pillars`
      );
    }

    results.push({
      respondent_id: r.id,
      respondent_name: r.name,
      total_responses: scores.length,
      distortion_score: distortionScore,
      level,
      signals: {
        extremity_pct: Number(extremityPct.toFixed(2)),
        longest_run: longestRun,
        anchor_deviation: Number(anchorDeviation.toFixed(2)),
      },
      reasons,
    });
  }

  return results.sort((a, b) => b.distortion_score - a.distortion_score);
}
