import { ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { DASHBOARD_TARGET } from "@/lib/ara/dashboard-tree";
import { getServerT } from "@/lib/i18n/server";
import { tr, type ReportLang } from "./report-i18n";
import {
  COMPLIANCE_STATUS_COLORS,
  DELTA_COLORS,
  GANTT_HORIZONS,
  HEATMAP_LEVEL_TINT,
  HEATMAP_SHARE_STEPS,
  MATRIX_QUADRANT_FILL,
  MATRIX_QUADRANT_INK,
} from "./report-encodings";

/**
 * The report's legend: one page, eight rows, no paragraphs. Every swatch is
 * the colour the chart itself uses (read from report-encodings) and every
 * number is the scale itself (read from the constants), so the key can never
 * disagree with the pages it explains. Rendered once per language; the
 * bilingual layout mounts it twice, side by side.
 */
export async function ReportLegend({ lang }: { lang: ReportLang }) {
  const t = await getServerT(lang);
  const rtl = lang === "ar";
  const L = (key: string) => tr(lang, key);
  const range = (min: number, max: number) => `${min.toFixed(1)}-${max.toFixed(1)}`;

  const row: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "6pt 14pt",
    alignItems: "center",
    margin: "4pt 0 10pt",
    fontSize: "9pt",
    color: "#374151",
  };
  const item: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: "5pt", whiteSpace: "nowrap" };
  const head: React.CSSProperties = {
    fontSize: "10pt",
    fontWeight: 600,
    color: "#010131",
    margin: "8pt 0 0",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "2pt",
  };
  const swatch = (bg: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
    display: "inline-block",
    width: "11pt",
    height: "11pt",
    borderRadius: "2pt",
    background: bg,
    flex: "none",
    ...extra,
  });
  const dot = (bg: string): React.CSSProperties => ({ ...swatch(bg), borderRadius: "50%", width: "8pt", height: "8pt" });
  const muted: React.CSSProperties = { color: "#6b7280" };

  return (
    <div dir={rtl ? "rtl" : "ltr"}>
      <h2 className="report-h2">{L("legend_title")}</h2>
      <p className="report-body" style={{ marginBottom: "6pt" }}>{L("legend_intro")}</p>

      {/* 1. Maturity levels */}
      <div style={head}>{L("legend_maturity")}</div>
      <div style={row}>
        {ARA_MATURITY_LEVELS.map((m) => (
          <span key={m.level} style={item}>
            <span style={swatch(HEATMAP_LEVEL_TINT[m.level]?.strong ?? "#9ca3af")} />
            <strong>L{m.level} {rtl ? m.label_ar : m.label_en}</strong>
            <span style={muted}>{range(m.min, m.max)}</span>
          </span>
        ))}
      </div>

      {/* 2. Overall bands */}
      <div style={head}>{L("legend_bands")}</div>
      <div style={row}>
        {ARA_OVERALL_BANDS.map((b) => (
          <span key={b.label_en} style={item}>
            <span style={swatch(b.color)} />
            <strong>{rtl ? b.label_ar : b.label_en}</strong>
            <span style={muted}>{range(b.min, b.max)}</span>
          </span>
        ))}
      </div>

      {/* 3. Benchmark */}
      <div style={head}>{L("legend_benchmark")}</div>
      <div style={row}>
        <span style={item}>
          <span style={swatch("transparent", { border: "1.5pt dashed #9ca3af", borderRadius: "50%" })} />
          <strong>{L("ai_ready_benchmark")} {DASHBOARD_TARGET.toFixed(2)}</strong>
          <span style={muted}>{L("legend_benchmark_body")}</span>
        </span>
      </div>

      {/* 4. Heatmap shading */}
      <div style={head}>{L("legend_heatmap")}</div>
      <div style={row}>
        <span style={item}>
          <span style={swatch(HEATMAP_LEVEL_TINT[3].strong)} />
          {L("legend_heatmap_strong").replace("{{pct}}", String(Math.round(HEATMAP_SHARE_STEPS.strong * 100)))}
        </span>
        <span style={item}>
          <span style={swatch(HEATMAP_LEVEL_TINT[3].base, { border: `1px solid ${HEATMAP_LEVEL_TINT[3].strong}` })} />
          {L("legend_heatmap_tint")
            .replace("{{from}}", String(Math.round(HEATMAP_SHARE_STEPS.tint * 100)))
            .replace("{{to}}", String(Math.round(HEATMAP_SHARE_STEPS.strong * 100) - 1))}
        </span>
        <span style={item}>
          <span style={swatch("#ffffff", { border: "1px solid #e5e7eb" })} />
          {L("legend_heatmap_light").replace("{{pct}}", String(Math.round(HEATMAP_SHARE_STEPS.tint * 100)))}
        </span>
        <span style={item}>
          <span style={swatch("#f9fafb", { border: "1px solid #f1f5f9" })} />
          {L("legend_heatmap_none")}
        </span>
      </div>

      {/* 5. Investment matrix */}
      <div style={head}>{L("legend_matrix")}</div>
      <div style={row}>
        {(
          [
            ["quickWins", "araReport.matrix_quick_wins"],
            ["strategicBets", "araReport.matrix_strategic_bets"],
            ["fillIns", "araReport.matrix_fill_ins"],
            ["reconsider", "araReport.matrix_reconsider"],
          ] as const
        ).map(([q, key]) => (
          <span key={q} style={item}>
            <span style={swatch(MATRIX_QUADRANT_FILL[q], { border: `1px solid ${MATRIX_QUADRANT_INK[q]}` })} />
            <strong style={{ color: MATRIX_QUADRANT_INK[q] }}>{t(key)}</strong>
          </span>
        ))}
        <span style={{ ...item, ...muted, whiteSpace: "normal" }}>{L("legend_matrix_axes")}</span>
      </div>

      {/* 6. Roadmap horizons */}
      <div style={head}>{L("legend_roadmap")}</div>
      <div style={row}>
        {(
          [
            ["quick", "araReport.gantt_quick_wins"],
            ["build", "araReport.gantt_build"],
            ["transform", "araReport.gantt_transform"],
          ] as const
        ).map(([h, key]) => (
          <span key={h} style={item}>
            <span style={swatch(GANTT_HORIZONS[h].color, { width: "18pt" })} />
            <strong>{t(key)}</strong>
            <span style={muted}>
              {L("legend_roadmap_months").replace("{{from}}", String(GANTT_HORIZONS[h].start)).replace("{{to}}", String(GANTT_HORIZONS[h].end))}
            </span>
          </span>
        ))}
      </div>

      {/* 7. Compliance statuses */}
      <div style={head}>{L("legend_compliance")}</div>
      <div style={row}>
        <span style={item}><span style={dot(COMPLIANCE_STATUS_COLORS.emerald)} />{t("araReport.compliance_met")}</span>
        <span style={item}><span style={dot(COMPLIANCE_STATUS_COLORS.amber)} />{t("araReport.compliance_partial")}</span>
        <span style={item}><span style={dot(COMPLIANCE_STATUS_COLORS.rose)} />{t("araReport.compliance_action")}</span>
        <span style={item}><span style={dot(COMPLIANCE_STATUS_COLORS.muteGrey)} />{t("araReport.compliance_unknown")}</span>
      </div>

      {/* 8. Year-on-year */}
      <div style={head}>{L("legend_yoy")}</div>
      <div style={row}>
        <span style={item}><strong style={{ color: DELTA_COLORS.up }}>▲</strong>{L("legend_yoy_up")}</span>
        <span style={item}><strong style={{ color: DELTA_COLORS.down }}>▼</strong>{L("legend_yoy_down")}</span>
        <span style={item}><strong style={{ color: DELTA_COLORS.flat }}>-</strong>{L("legend_yoy_flat")}</span>
      </div>
    </div>
  );
}
