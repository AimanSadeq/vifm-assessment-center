import { TOKENS } from "../../report/_components/report-primitives";

/**
 * Bilingual roadmap + action card for the consolidation. The unit report's
 * GanttRoadmap / RecommendationCard read their labels from the cookie locale
 * (getServerT), which an internal Arabic render does not carry, so the
 * consolidation carries its own pair with the language passed in.
 */

export type Horizon = "quick" | "build" | "transform";
export type Effort = "low" | "medium" | "high";

export const HORIZON_SPEC = {
  quick: { start: 1, end: 3, color: "#00b4ff", en: "Quick wins · months 1-3", ar: "مكاسب سريعة · الأشهر 1-3" },
  build: { start: 4, end: 9, color: "#5391D5", en: "Build · months 4-9", ar: "بناء · الأشهر 4-9" },
  transform: { start: 10, end: 12, color: "#010131", en: "Transform · months 10-12", ar: "تحوّل · الأشهر 10-12" },
} as const;

export function RollupRoadmap({ items, lang = "en" }: {
  items: Array<{ name: string; detail: string; horizon: Horizon }>;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div style={{ fontSize: "9pt" }} dir="ltr">
      <div style={{ display: "grid", gridTemplateColumns: "190pt repeat(12, 1fr)", gap: "2pt", marginBottom: "4pt" }}>
        <div />
        {MONTHS.map((m) => (
          <div key={m} style={{ textAlign: "center", fontSize: "8pt", color: "#6b7280", borderBottom: m === 3 || m === 9 ? "1pt dashed #9ca3af" : "none", paddingBottom: "2pt" }}>
            {rtl ? `ش${m}` : `M${m}`}
          </div>
        ))}
      </div>
      {items.map((it, i) => {
        const spec = HORIZON_SPEC[it.horizon];
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "190pt repeat(12, 1fr)", gap: "2pt", marginBottom: "3pt", alignItems: "center", minHeight: "22pt" }}>
            <div dir={rtl ? "rtl" : "ltr"} style={{ padding: "4pt 8pt", background: "#f9fafb", borderInlineStart: `3pt solid ${spec.color}`, fontSize: "8.5pt" }}>
              <div style={{ fontWeight: 600, color: "#010131" }}>{it.name}</div>
              <div style={{ fontSize: "7.5pt", color: "#6b7280" }}>{it.detail}</div>
            </div>
            {MONTHS.map((m) => {
              const inRange = m >= spec.start && m <= spec.end;
              return (
                <div key={m} style={{
                  background: inRange ? spec.color : "#f3f4f6", height: "14pt",
                  borderTopLeftRadius: m === spec.start ? "4pt" : 0, borderBottomLeftRadius: m === spec.start ? "4pt" : 0,
                  borderTopRightRadius: m === spec.end ? "4pt" : 0, borderBottomRightRadius: m === spec.end ? "4pt" : 0,
                }} />
              );
            })}
          </div>
        );
      })}
      <div dir={rtl ? "rtl" : "ltr"} style={{ display: "flex", gap: "16pt", marginTop: "10pt", fontSize: "8.5pt", color: "#374151" }}>
        {(["quick", "build", "transform"] as const).map((h) => (
          <div key={h} style={{ display: "flex", alignItems: "center", gap: "4pt" }}>
            <span style={{ display: "inline-block", width: "10pt", height: "10pt", borderRadius: "2pt", background: HORIZON_SPEC[h].color }} />
            {rtl ? HORIZON_SPEC[h].ar : HORIZON_SPEC[h].en}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActionCard({ index, title, body, horizon, effort, outcome, lang = "en" }: {
  index: number;
  title: string;
  body: string;
  horizon: Horizon;
  effort: Effort;
  outcome: string;
  lang?: "en" | "ar";
}) {
  const rtl = lang === "ar";
  const horizonLabel = { quick: rtl ? "مكسب سريع" : "Quick win", build: rtl ? "بناء" : "Build", transform: rtl ? "تحوّل" : "Transform" }[horizon];
  const effortLabel = { low: rtl ? "جهد منخفض" : "Low effort", medium: rtl ? "جهد متوسط" : "Medium effort", high: rtl ? "جهد مرتفع" : "High effort" }[effort];
  return (
    <article style={{ padding: "10pt 12pt", background: "white", height: "100%", border: `1pt solid ${TOKENS.line}`, borderRadius: "3pt", breakInside: "avoid" }}>
      <div style={{ display: "grid", gridTemplateColumns: "22pt 1fr", gap: "10pt", alignItems: "start" }}>
        <span style={{ width: "20pt", height: "20pt", background: TOKENS.navy, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10pt", fontWeight: 700 }}>{index}</span>
        <div>
          <h4 style={{ fontSize: "11.5pt", fontWeight: 600, color: TOKENS.navy, margin: "0 0 3pt", lineHeight: 1.25 }}>{title}</h4>
          <p style={{ fontSize: "7.5pt", letterSpacing: rtl ? 0 : "0.09em", textTransform: "uppercase", color: TOKENS.mute, margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: "5pt" }}>
            <span style={{ width: "5pt", height: "5pt", background: HORIZON_SPEC[horizon].color, display: "inline-block" }} />
            {horizonLabel}<span style={{ color: TOKENS.line }}>|</span>{effortLabel}
          </p>
        </div>
      </div>
      <p style={{ fontSize: "9.5pt", color: TOKENS.ink2, lineHeight: 1.55, margin: "7pt 0 8pt" }}>{body}</p>
      <div style={{ borderTop: `1pt solid ${TOKENS.line}`, paddingTop: "5pt", fontSize: "8.5pt", color: TOKENS.mute }}>
        <strong style={{ color: TOKENS.ink2 }}>{rtl ? "النتيجة المتوقعة · " : "Expected outcome · "}</strong>{outcome}
      </div>
    </article>
  );
}
