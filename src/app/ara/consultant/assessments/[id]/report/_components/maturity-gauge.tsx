import { ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";

/**
 * Speedometer-style gauge showing overall score on a 1-5 scale.
 * Five colour bands match the handover §7.3 zones.
 * Pure SVG — prints cleanly and has zero client-side runtime.
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

  const band = score != null
    ? ARA_OVERALL_BANDS.find((b) => score >= b.min && score <= b.max)
    : null;

  return (
    <svg viewBox="0 0 300 180" className="w-full max-w-md mx-auto">
      {/* Bands */}
      {arc(1.0, 1.9, "#DC3545")}
      {arc(2.0, 2.9, "#FD7E14")}
      {arc(3.0, 3.9, "#FFC107")}
      {arc(4.0, 4.4, "#28A745")}
      {arc(4.5, 5.0, "#FFD700")}

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

      {/* Score label */}
      <text
        x={CENTER}
        y={CENTER - 35}
        textAnchor="middle"
        fontSize="32"
        fontWeight="600"
        fill="#010131"
      >
        {score != null ? score.toFixed(2) : "—"}
      </text>
      <text
        x={CENTER}
        y={CENTER - 15}
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
