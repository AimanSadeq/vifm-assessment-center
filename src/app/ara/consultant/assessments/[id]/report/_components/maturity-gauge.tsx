import { ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { overallBandFromScore } from "@/lib/ara/scoring";

/**
 * Speedometer-style gauge showing overall score on a 1-5 scale.
 * Five colour bands match the handover §7.3 zones.
 * Pure SVG - prints cleanly and has zero client-side runtime.
 */
export function MaturityGauge({ score }: { score: number | null }) {
  const RADIUS = 110;
  const CENTER = 150;
  const START_ANGLE = -180;
  const END_ANGLE = 0;

  const scoreFor = (s: number) => Math.max(1, Math.min(5, s));
  const angleForScore = (s: number) => {
    const ratio = (scoreFor(s) - 1) / 4;
    return START_ANGLE + ratio * (END_ANGLE - START_ANGLE);
  };

  const polar = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
  };

  const arc = (startScore: number, endScore: number, color: string) => {
    const startAngle = angleForScore(startScore);
    const endAngle = angleForScore(endScore);
    const start = polar(startAngle, RADIUS);
    const end = polar(endAngle, RADIUS);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return (
      <path
        d={`M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`}
        stroke={color}
        strokeWidth="22"
        fill="none"
        strokeLinecap="butt"
      />
    );
  };

  const needleAngle = score != null ? angleForScore(score) : angleForScore(1);
  const needleEnd = polar(needleAngle, RADIUS - 10);

  // Canonical band lookup - the single source of truth in scoring.ts.
  const band = score != null ? overallBandFromScore(score) : null;

  return (
    <svg viewBox="0 0 300 180" className="w-full max-w-md mx-auto">
      {/* Bands - contiguous segments drawn FROM the canonical constant so the
          gauge can never desync from ARA_OVERALL_BANDS (display floor is 1.0
          by convention; the sub-1.0 tail of Not Ready is clamped visually). */}
      {ARA_OVERALL_BANDS.map((b, i) => {
        const from = Math.max(1, b.min);
        const to = i < ARA_OVERALL_BANDS.length - 1 ? Math.max(1, ARA_OVERALL_BANDS[i + 1].min) : 5.0;
        return <g key={b.label_en}>{arc(from, to, b.color)}</g>;
      })}

      {/* Needle */}
      {score != null && (
        <>
          <line
            x1={CENTER}
            y1={CENTER}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="#010131"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={CENTER} cy={CENTER} r="6" fill="#010131" />
        </>
      )}

      {/* Score label - sits BELOW the hub: the needle sweeps the upper half,
          so a centred label was crossed out by the needle at mid-range scores. */}
      <text
        x={CENTER}
        y={CENTER + 42}
        textAnchor="middle"
        fontSize="32"
        fontWeight="600"
        fill="#010131"
      >
        {score != null ? score.toFixed(2) : "-"}
      </text>
      <text
        x={CENTER}
        y={CENTER + 60}
        textAnchor="middle"
        fontSize="11"
        fill="#6b7280"
      >
        / 5.0
      </text>

      {/* Scale marks */}
      {[1, 2, 3, 4, 5].map((v) => {
        const p = polar(angleForScore(v), RADIUS + 14);
        return (
          <text
            key={v}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
          >
            {v}
          </text>
        );
      })}

      {/* Band label below gauge */}
      {band && (
        <text
          x={CENTER}
          y={CENTER + 40}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill={band.color}
        >
          {band.label_en}
        </text>
      )}
    </svg>
  );
}
