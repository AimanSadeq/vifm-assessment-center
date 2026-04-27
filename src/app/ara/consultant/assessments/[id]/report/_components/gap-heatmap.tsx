import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

/**
 * Gap-analysis heatmap: pillars on Y, question-number buckets on X.
 * Each cell shows the average score of questions in that pillar × bucket
 * range, coloured by maturity (red / amber / green).
 * Cells with no data render as neutral grey.
 */
export function GapHeatmap({
  scoresByPillarByBucket,
}: {
  // pillar_id → bucket_index (0..BUCKET_COUNT-1) → avg score
  scoresByPillarByBucket: Map<AraPillarId, Map<number, number>>;
}) {
  const BUCKET_COUNT = 5;
  const BUCKET_LABELS = ["Q1–2", "Q3–4", "Q5–6", "Q7–8", "Q9+"];

  const colorFor = (score: number | undefined) => {
    if (score == null) return { bg: "#f3f4f6", fg: "#9ca3af" };
    if (score >= 4.0) return { bg: "#34D399", fg: "white" };
    if (score >= 3.0) return { bg: "#FBBF24", fg: "white" };
    if (score >= 2.0) return { bg: "#FDBA74", fg: "white" };
    return { bg: "#FB7185", fg: "white" };
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: `120pt repeat(${BUCKET_COUNT}, 1fr)`, gap: "2pt", fontSize: "9pt" }}>
      <div />
      {BUCKET_LABELS.map((b) => (
        <div key={b} style={{ textAlign: "center", color: "#6b7280", fontSize: "8pt", paddingBottom: "2pt" }}>
          {b}
        </div>
      ))}
      {ARA_PILLARS.map((p) => {
        const byBucket = scoresByPillarByBucket.get(p.id) ?? new Map();
        return (
          <>
            <div
              key={`${p.id}-label`}
              style={{
                padding: "6pt 8pt",
                fontWeight: 500,
                fontSize: "9pt",
                color: "#374151",
                background: "#f9fafb",
                borderRadius: "3pt",
              }}
            >
              {p.name_en}
            </div>
            {Array.from({ length: BUCKET_COUNT }).map((_, b) => {
              const score = byBucket.get(b);
              const { bg, fg } = colorFor(score);
              return (
                <div
                  key={`${p.id}-${b}`}
                  style={{
                    background: bg,
                    color: fg,
                    padding: "6pt",
                    textAlign: "center",
                    borderRadius: "3pt",
                    fontWeight: 600,
                    fontSize: "9pt",
                    minHeight: "24pt",
                  }}
                >
                  {score != null ? score.toFixed(2) : "-"}
                </div>
              );
            })}
          </>
        );
      })}
    </div>
  );
}

/**
 * Bucket questions by number into 5 groups of 2 each for the heatmap.
 */
export function bucketResponses(
  rows: Array<{ pillar_id: string; question_number: number; question_score: number | null }>
): Map<AraPillarId, Map<number, number>> {
  const byPillarBucket = new Map<AraPillarId, Map<number, number[]>>();
  for (const r of rows) {
    if (r.question_score == null) continue;
    const bucket = Math.min(4, Math.floor((r.question_number - 1) / 2));
    const byBucket = byPillarBucket.get(r.pillar_id as AraPillarId) ?? new Map();
    const arr = byBucket.get(bucket) ?? [];
    arr.push(Number(r.question_score));
    byBucket.set(bucket, arr);
    byPillarBucket.set(r.pillar_id as AraPillarId, byBucket);
  }

  const result = new Map<AraPillarId, Map<number, number>>();
  Array.from(byPillarBucket.entries()).forEach(([pillar, byBucket]) => {
    const avgMap = new Map<number, number>();
    Array.from(byBucket.entries()).forEach(([bucket, scores]) => {
      avgMap.set(
        bucket,
        scores.reduce((a: number, b: number) => a + b, 0) / scores.length,
      );
    });
    result.set(pillar, avgMap);
  });
  return result;
}
