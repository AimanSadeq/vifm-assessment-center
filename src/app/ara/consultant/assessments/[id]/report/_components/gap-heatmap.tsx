import { ARA_PILLARS, ARA_MATURITY_LEVELS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

/**
 * Cohort maturity-distribution heatmap: pillars on Y, the canonical maturity
 * levels (L1 Unaware -> L5 Leading) on X. Each cell is HOW MANY respondents
 * landed in that level for that pillar, shaded by concentration.
 *
 * Replaces the previous "Q1-2 / Q3-4 / ..." grid (client review 2026-08-31):
 * those columns were the question bank's internal item numbers grouped in
 * pairs - an arbitrary split with no meaning to a reader, and one that
 * rendered ragged gaps whenever a custom-scope run served non-contiguous
 * item numbers. Levels are read from ARA_MATURITY_LEVELS so the axis can
 * never drift from the rest of the report.
 */

/** Per-pillar counts of respondents at each maturity level (1..5). */
export type PillarLevelCounts = Map<AraPillarId, Map<number, number>>;

export function GapHeatmap({
  countsByPillarByLevel,
  cohortSize,
  pillars = ARA_PILLARS,
  lang = "en",
}: {
  countsByPillarByLevel: PillarLevelCounts;
  /** Respondents with a score on at least one pillar - drives the shading scale. */
  cohortSize: number;
  /** The assessment's IN-SCOPE pillars (a subset-stage run must pass its list). */
  pillars?: typeof ARA_PILLARS;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const levels = ARA_MATURITY_LEVELS;

  // Shade by share-of-cohort within the pillar row, in the level's own colour
  // family, so the eye lands on where people actually cluster.
  const LEVEL_TINT: Record<number, { base: string; strong: string }> = {
    1: { base: "#fdeef0", strong: "#FB7185" },
    2: { base: "#fef2e7", strong: "#FDBA74" },
    3: { base: "#fef8e7", strong: "#FBBF24" },
    4: { base: "#eaf7f0", strong: "#34D399" },
    5: { base: "#e6f6ee", strong: "#12805c" },
  };

  const cellStyle = (level: number, count: number, rowTotal: number) => {
    if (count === 0 || rowTotal === 0) {
      return { background: "#f9fafb", color: "#cbd5e1", border: "1px solid #f1f5f9" };
    }
    const share = count / rowTotal;
    const tint = LEVEL_TINT[level] ?? LEVEL_TINT[3];
    // Three steps keeps it legible in print (no alpha gradients).
    if (share >= 0.4) return { background: tint.strong, color: "white", border: "none" };
    if (share >= 0.15) return { background: tint.base, color: "#374151", border: `1px solid ${tint.strong}` };
    return { background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb" };
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `126pt repeat(${levels.length}, 1fr)`,
        gap: "2pt",
        fontSize: "9pt",
      }}
      dir={rtl ? "rtl" : "ltr"}
    >
      <div />
      {levels.map((l) => (
        <div
          key={l.level}
          style={{ textAlign: "center", color: "#6b7280", fontSize: "7.5pt", paddingBottom: "3pt", lineHeight: 1.3 }}
        >
          <strong style={{ color: "#374151" }}>L{l.level}</strong>
          <br />
          {rtl ? l.label_ar : l.label_en}
        </div>
      ))}
      {pillars.map((p) => {
        const byLevel = countsByPillarByLevel.get(p.id) ?? new Map<number, number>();
        const rowTotal = levels.reduce((sum, l) => sum + (byLevel.get(l.level) ?? 0), 0);
        return (
          <div key={p.id} style={{ display: "contents" }}>
            <div
              style={{
                padding: "6pt 8pt",
                fontWeight: 500,
                fontSize: "9pt",
                color: "#374151",
                background: "#f9fafb",
                borderRadius: "3pt",
              }}
            >
              {rtl ? p.name_ar : p.name_en}
            </div>
            {levels.map((l) => {
              const count = byLevel.get(l.level) ?? 0;
              const st = cellStyle(l.level, count, rowTotal);
              return (
                <div
                  key={`${p.id}-${l.level}`}
                  style={{
                    ...st,
                    padding: "6pt",
                    textAlign: "center",
                    borderRadius: "3pt",
                    fontWeight: 600,
                    fontSize: "9.5pt",
                    minHeight: "24pt",
                  }}
                >
                  {count > 0 ? count : "-"}
                </div>
              );
            })}
          </div>
        );
      })}
      <div />
      <div
        style={{
          gridColumn: `2 / span ${levels.length}`,
          fontSize: "8pt",
          color: "#6b7280",
          paddingTop: "4pt",
        }}
      >
        {rtl
          ? `عدد المشاركين (من ${cohortSize}) في كل مستوى نضج لكل ركيزة. تُظهر الخلايا الملوّنة تركّز المجموعة.`
          : `Number of respondents (of ${cohortSize}) at each maturity level, per pillar. Shaded cells show where the cohort concentrates.`}
      </div>
    </div>
  );
}

/**
 * Build per-pillar maturity-level counts from per-respondent pillar means.
 * A respondent is placed in the level their pillar average falls into, using
 * the canonical lower-threshold rule (highest level whose min <= score).
 */
export function bucketRespondentsByLevel(
  meansByPillar: Map<string, number[]>
): PillarLevelCounts {
  const out: PillarLevelCounts = new Map();
  for (const [pillarId, means] of meansByPillar) {
    const byLevel = new Map<number, number>();
    for (const m of means) {
      let level = ARA_MATURITY_LEVELS[0].level;
      for (const l of ARA_MATURITY_LEVELS) if (m >= l.min) level = l.level;
      byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
    }
    out.set(pillarId as AraPillarId, byLevel);
  }
  return out;
}
