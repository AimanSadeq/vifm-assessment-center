/**
 * Gantt-style 12-month roadmap across three horizons.
 * Horizons from handover §12.2 (pages 23–24):
 *   Quick Wins : 0–3 months  (Cyan)
 *   Build      : 3–9 months  (Accent Blue)
 *   Transform  : 9–12 months (Navy)
 */
export function GanttRoadmap({
  initiatives,
}: {
  initiatives: Array<{
    name: string;
    horizon: "quick" | "build" | "transform";
    pillar: string;
  }>;
}) {
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  const horizonSpec = {
    quick: { start: 1, end: 3, color: "#00b4ff", label: "Quick Wins", labelColor: "#075985" },
    build: { start: 4, end: 9, color: "#5391D5", label: "Build", labelColor: "#1e3a8a" },
    transform: { start: 10, end: 12, color: "#010131", label: "Transform", labelColor: "white" },
  } as const;

  if (initiatives.length === 0) {
    return (
      <p className="report-body report-muted">
        No recommendations to plot - populate Phase 2 consultant notes per pillar to generate a roadmap.
      </p>
    );
  }

  // Pad with generic placeholders if we have < 5 so the timeline isn't empty
  const rows = [...initiatives];

  return (
    <div style={{ fontSize: "9pt" }}>
      {/* Month header */}
      <div style={{ display: "grid", gridTemplateColumns: "160pt repeat(12, 1fr)", gap: "2pt", marginBottom: "4pt" }}>
        <div />
        {MONTHS.map((m) => (
          <div
            key={m}
            style={{
              textAlign: "center",
              fontSize: "8pt",
              color: "#6b7280",
              borderBottom: m === 3 || m === 9 ? "1pt dashed #9ca3af" : "none",
              paddingBottom: "2pt",
            }}
          >
            M{m}
          </div>
        ))}
      </div>

      {/* Horizon bands (rows) */}
      {rows.map((init, i) => {
        const spec = horizonSpec[init.horizon];
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "160pt repeat(12, 1fr)",
              gap: "2pt",
              marginBottom: "3pt",
              alignItems: "center",
              minHeight: "22pt",
            }}
          >
            <div
              style={{
                padding: "4pt 8pt",
                background: "#f9fafb",
                borderLeft: `3pt solid ${spec.color}`,
                fontSize: "8.5pt",
              }}
            >
              <div style={{ fontWeight: 500, color: "#010131" }}>{init.name}</div>
              <div style={{ fontSize: "7.5pt", color: "#6b7280" }}>{init.pillar}</div>
            </div>
            {MONTHS.map((m) => {
              const inRange = m >= spec.start && m <= spec.end;
              const isStart = m === spec.start;
              const isEnd = m === spec.end;
              return (
                <div
                  key={m}
                  style={{
                    background: inRange ? spec.color : "#f3f4f6",
                    height: "14pt",
                    borderTopLeftRadius: isStart ? "4pt" : 0,
                    borderBottomLeftRadius: isStart ? "4pt" : 0,
                    borderTopRightRadius: isEnd ? "4pt" : 0,
                    borderBottomRightRadius: isEnd ? "4pt" : 0,
                  }}
                />
              );
            })}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display: "flex", gap: "16pt", marginTop: "10pt", fontSize: "8.5pt", color: "#374151" }}>
        {(["quick", "build", "transform"] as const).map((h) => (
          <div key={h} style={{ display: "flex", alignItems: "center", gap: "4pt" }}>
            <span
              style={{
                display: "inline-block",
                width: "10pt",
                height: "10pt",
                borderRadius: "2pt",
                background: horizonSpec[h].color,
              }}
            />
            {horizonSpec[h].label}
          </div>
        ))}
      </div>
    </div>
  );
}
