import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { getServerT } from "@/lib/i18n/server";
import type { AraPillarId } from "@/types/ara";

/**
 * Investment priority 2x2 scatter:
 *   X = effort required to close the gap (low -> high)
 *   Y = business value (low -> high)
 *
 * Effort proxy: benchmark gap magnitude (bigger gap = more effort)
 * Value proxy: pillar weight (higher weight = higher business value)
 *
 * Quadrants (per handover Section 12.2):
 *   top-left    = Quick Wins
 *   top-right   = Strategic Bets
 *   bottom-left = Fill-ins
 *   bottom-right= Reconsider
 *
 * When multiple pillars have the same coordinates (common when all
 * scores cluster), points are jittered deterministically by pillar id
 * so no two dots overlap. Points are numbered and a legend on the right
 * maps numbers to pillar names - avoids the label overlap that plagues
 * a naive scatter.
 */
export async function InvestmentMatrix({
  pillarData,
}: {
  pillarData: Array<{
    pillar_id: AraPillarId;
    raw_score: number | null;
    pillar_weight: number;
  }>;
}) {
  const t = await getServerT();
  const PAD = 60;
  const LEGEND_W = 200;
  const W = 540;
  const H = 360;
  const totalW = W + LEGEND_W;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  const maxWeight = Math.max(...pillarData.map((p) => p.pillar_weight), 12.5);
  const maxGap = 3.0; // 4.0 - 1.0

  // Deterministic hash -> 2D jitter offset, so rerunning produces the
  // same visual and colliding points spread predictably.
  const jitter = (pillarId: string) => {
    let h = 0;
    for (let i = 0; i < pillarId.length; i++) h = (h * 31 + pillarId.charCodeAt(i)) >>> 0;
    const dx = ((h % 17) - 8) * 1.6; // -12.8..+12.8
    const dy = (((h >> 8) % 17) - 8) * 1.6;
    return { dx, dy };
  };

  const pts = pillarData
    .filter((p) => p.raw_score != null)
    .map((p, i) => {
      const gap = Math.max(0, 4.0 - (p.raw_score as number));
      const effort = Math.min(1, gap / maxGap);
      const value = Math.min(1, p.pillar_weight / maxWeight);
      const pillar = ARA_PILLARS.find((x) => x.id === p.pillar_id);
      const { dx, dy } = jitter(p.pillar_id);
      return {
        pillar_id: p.pillar_id,
        index: i + 1,
        name: pillar?.name_en ?? p.pillar_id,
        x: PAD + effort * plotW + dx,
        y: PAD + (1 - value) * plotH + dy,
      };
    });

  const midX = PAD + plotW / 2;
  const midY = PAD + plotH / 2;

  // Brand palette for quadrant fills
  const Q = {
    quickWins:    "#ccfbf1", // teal-100
    strategicBets:"#fef3c7", // amber-100
    fillIns:      "#f3f4f6", // slate-100
    reconsider:   "#ffe4e6", // rose-100
  };

  return (
    <svg viewBox={`0 0 ${totalW} ${H}`} className="w-full max-w-3xl mx-auto">
      {/* Quadrant backgrounds */}
      <rect x={PAD} y={PAD} width={plotW / 2} height={plotH / 2} fill={Q.quickWins} />
      <rect x={midX} y={PAD} width={plotW / 2} height={plotH / 2} fill={Q.strategicBets} />
      <rect x={PAD} y={midY} width={plotW / 2} height={plotH / 2} fill={Q.fillIns} />
      <rect x={midX} y={midY} width={plotW / 2} height={plotH / 2} fill={Q.reconsider} />

      {/* Axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#010131" strokeWidth="1" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#010131" strokeWidth="1" />
      <line x1={midX} y1={PAD} x2={midX} y2={H - PAD} stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="3 3" />
      <line x1={PAD} y1={midY} x2={W - PAD} y2={midY} stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="3 3" />

      {/* Quadrant labels - clean uppercase, no emoji */}
      <text x={PAD + plotW / 4} y={PAD + 18} textAnchor="middle" fontSize="10" fontWeight="700"
        fill="#115e59" letterSpacing="0.08em">
        {t("araReport.matrix_quick_wins")}
      </text>
      <text x={midX + plotW / 4} y={PAD + 18} textAnchor="middle" fontSize="10" fontWeight="700"
        fill="#92400e" letterSpacing="0.08em">
        {t("araReport.matrix_strategic_bets")}
      </text>
      <text x={PAD + plotW / 4} y={H - PAD - 10} textAnchor="middle" fontSize="10" fontWeight="700"
        fill="#4b5563" letterSpacing="0.08em">
        {t("araReport.matrix_fill_ins")}
      </text>
      <text x={midX + plotW / 4} y={H - PAD - 10} textAnchor="middle" fontSize="10" fontWeight="700"
        fill="#9f1239" letterSpacing="0.08em">
        {t("araReport.matrix_reconsider")}
      </text>

      {/* Axis labels */}
      <text x={W / 2} y={H - 16} textAnchor="middle" fontSize="9" fill="#374151"
        letterSpacing="0.05em">
        {t("araReport.matrix_effort_required")}
      </text>
      <text x={18} y={H / 2} textAnchor="middle" fontSize="9" fill="#374151"
        letterSpacing="0.05em"
        transform={`rotate(-90 18 ${H / 2})`}>
        {t("araReport.matrix_business_value")}
      </text>

      {/* Points - numbered, jittered */}
      {pts.map((p) => (
        <g key={p.pillar_id}>
          <circle cx={p.x} cy={p.y} r="11" fill="#010131" stroke="white" strokeWidth="2" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10"
            fontWeight="700" fill="white">
            {p.index}
          </text>
        </g>
      ))}

      {/* Legend column */}
      <g transform={`translate(${W + 12}, ${PAD - 4})`}>
        <text x="0" y="0" fontSize="9" fontWeight="700" fill="#010131"
          letterSpacing="0.08em">
          {t("araReport.matrix_pillars")}
        </text>
        {pts.map((p, i) => (
          <g key={p.pillar_id} transform={`translate(0, ${14 + i * 20})`}>
            <circle cx="9" cy="9" r="9" fill="#010131" />
            <text x="9" y="13" textAnchor="middle" fontSize="9"
              fontWeight="700" fill="white">{p.index}</text>
            <text x="24" y="13" fontSize="9.5" fill="#010131">{p.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
