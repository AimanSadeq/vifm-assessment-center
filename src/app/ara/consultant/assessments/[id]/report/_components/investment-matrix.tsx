import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

/**
 * Investment priority 2×2 scatter:
 *   X = effort required to close the gap (low → high)
 *   Y = business value (low → high)
 *
 * Effort proxy: benchmark gap magnitude (bigger gap = more effort)
 * Value proxy: pillar weight (higher weight = higher business value)
 *
 * Quadrants (per handover §12.2):
 *   top-left    = Quick Wins     (⭐)
 *   top-right   = Strategic Bets (🎯)
 *   bottom-left = Fill-ins       (📋)
 *   bottom-right= Reconsider     (⚠️)
 */
export function InvestmentMatrix({
  pillarData,
}: {
  pillarData: Array<{
    pillar_id: AraPillarId;
    raw_score: number | null;
    pillar_weight: number;
  }>;
}) {
  const PAD = 60;
  const W = 520;
  const H = 360;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  // Normalise weights (sum=100 → relative 0..1) for Y
  const maxWeight = Math.max(...pillarData.map((p) => p.pillar_weight), 12.5);
  // Normalise effort by raw-score gap against 4.0. Higher gap = more effort.
  const maxGap = 3.0; // 4.0 - 1.0

  const pts = pillarData
    .filter((p) => p.raw_score != null)
    .map((p) => {
      const gap = Math.max(0, 4.0 - (p.raw_score as number));
      const effort = Math.min(1, gap / maxGap); // 0..1
      const value = Math.min(1, p.pillar_weight / maxWeight); // 0..1
      const pillar = ARA_PILLARS.find((x) => x.id === p.pillar_id);
      return {
        pillar_id: p.pillar_id,
        name: pillar?.name_en ?? p.pillar_id,
        x: PAD + effort * plotW,
        y: PAD + (1 - value) * plotH, // invert — high value = top
      };
    });

  const midX = PAD + plotW / 2;
  const midY = PAD + plotH / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl mx-auto">
      {/* Quadrant backgrounds */}
      <rect x={PAD} y={PAD} width={plotW / 2} height={plotH / 2} fill="#dcfce7" opacity="0.5" />
      <rect x={midX} y={PAD} width={plotW / 2} height={plotH / 2} fill="#fef3c7" opacity="0.5" />
      <rect x={PAD} y={midY} width={plotW / 2} height={plotH / 2} fill="#f3f4f6" opacity="0.6" />
      <rect x={midX} y={midY} width={plotW / 2} height={plotH / 2} fill="#fee2e2" opacity="0.5" />

      {/* Axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#374151" strokeWidth="1" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#374151" strokeWidth="1" />
      <line x1={midX} y1={PAD} x2={midX} y2={H - PAD} stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="3 3" />
      <line x1={PAD} y1={midY} x2={W - PAD} y2={midY} stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="3 3" />

      {/* Quadrant labels */}
      <text x={PAD + plotW / 4} y={PAD + 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="#166534">
        ⭐ Quick Wins
      </text>
      <text x={midX + plotW / 4} y={PAD + 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="#92400e">
        🎯 Strategic Bets
      </text>
      <text x={PAD + plotW / 4} y={H - PAD - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#4b5563">
        📋 Fill-ins
      </text>
      <text x={midX + plotW / 4} y={H - PAD - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#991b1b">
        ⚠️ Reconsider
      </text>

      {/* Axis labels */}
      <text x={W / 2} y={H - 18} textAnchor="middle" fontSize="10" fill="#374151">
        Effort required →
      </text>
      <text
        x={16}
        y={H / 2}
        textAnchor="middle"
        fontSize="10"
        fill="#374151"
        transform={`rotate(-90 16 ${H / 2})`}
      >
        Business value →
      </text>

      {/* Points */}
      {pts.map((p, i) => (
        <g key={p.pillar_id}>
          <circle cx={p.x} cy={p.y} r="6" fill="#010131" stroke="white" strokeWidth="2" />
          <text
            x={p.x + 10}
            y={p.y + 4}
            fontSize="9"
            fill="#010131"
            style={{ fontWeight: 500 }}
          >
            {p.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
