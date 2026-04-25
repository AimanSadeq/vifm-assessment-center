/**
 * Stylised compass rose - the brand motif for the AI Readiness Compass.
 * The outer ring rotates slowly to convey "navigation in progress."
 * Pure SVG + CSS, no JS, no external deps.
 *
 * Usage:
 *   <AnimatedCompass className="w-64 h-64" />
 *
 * The component respects prefers-reduced-motion via globals.css.
 */
export function AnimatedCompass({ className = "" }: { className?: string }) {
  // Prismatic palette for the four major cardinals - blue, violet, teal, gold.
  // Keeps the compass visually alive without being loud.
  const MAJOR_COLORS = ["#5391D5", "#A78BFA", "#2DD4BF", "#FBBF24"] as const;

  // 16 tick marks around the ring; every 4th is a major cardinal (N/E/S/W).
  const ticks = Array.from({ length: 16 }).map((_, i) => {
    const angleDeg = i * 22.5 - 90; // start at top (N)
    const angleRad = (angleDeg * Math.PI) / 180;
    const isMajor = i % 4 === 0;
    const tickLen = isMajor ? 14 : 6;
    const r1 = 78;
    const r2 = 78 - tickLen;
    const cx = 100 + Math.cos(angleRad) * r1;
    const cy = 100 + Math.sin(angleRad) * r1;
    const cx2 = 100 + Math.cos(angleRad) * r2;
    const cy2 = 100 + Math.sin(angleRad) * r2;
    const majorIdx = Math.floor(i / 4) % 4;
    const color = isMajor ? MAJOR_COLORS[majorIdx] : "rgba(255,255,255,0.35)";
    return { i, cx, cy, cx2, cy2, isMajor, color };
  });

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <radialGradient id="compass-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5391D5" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#5391D5" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#5391D5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="needle-n" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ADD8FF" />
          <stop offset="100%" stopColor="#5391D5" />
        </linearGradient>
      </defs>

      {/* Ambient halo - pulses gently */}
      <circle cx="100" cy="100" r="96" fill="url(#compass-halo)" className="ara-float-glow" />

      {/* Rotating rose */}
      <g className="ara-spin-slow" style={{ transformOrigin: "100px 100px" }}>
        {/* Outer ring */}
        <circle
          cx="100"
          cy="100"
          r="78"
          fill="none"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="1"
        />
        {/* Mid ring */}
        <circle
          cx="100"
          cy="100"
          r="56"
          fill="none"
          stroke="rgba(255, 255, 255, 0.10)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        {/* Tick marks - major cardinals rotate through the brand palette */}
        {ticks.map((t) => (
          <line
            key={t.i}
            x1={t.cx}
            y1={t.cy}
            x2={t.cx2}
            y2={t.cy2}
            stroke={t.color}
            strokeWidth={t.isMajor ? 1.8 : 0.8}
            strokeLinecap="round"
          />
        ))}

        {/* North-pointing needle */}
        <polygon
          points="100,28 94,100 106,100"
          fill="url(#needle-n)"
          opacity="0.95"
        />
        {/* South half - muted */}
        <polygon
          points="100,172 94,100 106,100"
          fill="rgba(255, 255, 255, 0.25)"
        />

        {/* Cardinal dots - matches the prismatic tick palette */}
        <circle cx="100" cy="16"  r="2.8" fill="#5391D5" />
        <circle cx="184" cy="100" r="2"   fill="#A78BFA" />
        <circle cx="100" cy="184" r="2"   fill="#2DD4BF" />
        <circle cx="16"  cy="100" r="2"   fill="#FBBF24" />
      </g>

      {/* Static centre cap - stays still while the rose rotates */}
      <circle cx="100" cy="100" r="6" fill="#FEFFF9" />
      <circle cx="100" cy="100" r="2.5" fill="#010131" />
    </svg>
  );
}
