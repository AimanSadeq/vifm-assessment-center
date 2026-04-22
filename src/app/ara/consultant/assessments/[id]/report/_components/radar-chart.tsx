import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

/**
 * 8-axis radar chart.
 * Client scores are drawn as a filled polygon; the 4.0 "AI Ready"
 * benchmark ring is a dashed overlay.
 * Pure SVG — prints cleanly.
 */
export function RadarChart({
  pillarScores,
  size = 360,
}: {
  pillarScores: Map<AraPillarId, number | null>;
  size?: number;
}) {
  const CENTER = size / 2;
  const MAX_RADIUS = size / 2 - 50;
  const MAX_SCORE = 5;

  const pillars = ARA_PILLARS;
  const count = pillars.length;

  const polar = (index: number, score: number) => {
    // Start at top, go clockwise
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    const r = (Math.max(0, Math.min(MAX_SCORE, score)) / MAX_SCORE) * MAX_RADIUS;
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
  };

  const polarLabel = (index: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    const r = MAX_RADIUS + 22;
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
  };

  // Concentric rings at scores 1,2,3,4,5
  const rings = [1, 2, 3, 4, 5].map((s) => {
    const pts = pillars.map((_, i) => polar(i, s));
    return `M ${pts.map((p) => `${p.x},${p.y}`).join(" L ")} Z`;
  });

  // Score polygon
  const scorePoints = pillars.map((p, i) => {
    const score = pillarScores.get(p.id);
    return polar(i, score ?? 0);
  });
  const scorePath = `M ${scorePoints.map((p) => `${p.x},${p.y}`).join(" L ")} Z`;

  // Benchmark ring at 4.0
  const benchmarkPoints = pillars.map((_, i) => polar(i, 4.0));
  const benchmarkPath = `M ${benchmarkPoints.map((p) => `${p.x},${p.y}`).join(" L ")} Z`;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-lg mx-auto">
      {/* Grid rings */}
      {rings.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={i === 4 ? 1.5 : 0.75}
        />
      ))}

      {/* Axes */}
      {pillars.map((_, i) => {
        const end = polar(i, MAX_SCORE);
        return (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={end.x}
            y2={end.y}
            stroke="#e5e7eb"
            strokeWidth="0.75"
          />
        );
      })}

      {/* Benchmark ring (AI Ready = 4.0) */}
      <path
        d={benchmarkPath}
        fill="none"
        stroke="#9ca3af"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      {/* Score polygon */}
      <path
        d={scorePath}
        fill="#5391D5"
        fillOpacity="0.25"
        stroke="#5391D5"
        strokeWidth="2"
      />
      {scorePoints.map((p, i) => {
        const score = pillarScores.get(pillars[i].id);
        return score != null ? (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#5391D5" />
        ) : null;
      })}

      {/* Pillar labels */}
      {pillars.map((p, i) => {
        const pt = polarLabel(i);
        const isRight = pt.x > CENTER + 5;
        const isLeft = pt.x < CENTER - 5;
        const anchor = isLeft ? "end" : isRight ? "start" : "middle";
        const words = p.name_en.split(" & ");
        return (
          <text key={p.id} x={pt.x} y={pt.y} textAnchor={anchor} fontSize="10" fill="#374151">
            {words.map((w, wi) => (
              <tspan key={wi} x={pt.x} dy={wi === 0 ? 0 : 12}>{w}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}
