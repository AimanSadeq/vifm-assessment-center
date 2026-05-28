import type { FrameworkComplianceSummary } from "@/lib/ara/compliance";
import { Circle } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";

const TOKENS = {
  navy: "#010131",
  mute: "#6b7280",
  ink2: "#374151",
  line: "#e5e7eb",
  bgSoft: "#fafbfc",
  emerald: "#34D399",
  amber: "#FBBF24",
  rose: "#FB7185",
  muteGrey: "#9ca3af",
};

const percentColor = (percent: number | null) => {
  if (percent == null) return TOKENS.muteGrey;
  if (percent >= 80) return TOKENS.emerald;
  if (percent >= 50) return TOKENS.amber;
  return TOKENS.rose;
};

/**
 * Regulatory Compliance Summary - one card per framework, grouped by
 * tier. Each card shows the overall percent (large numeral on the right),
 * a full-width stacked bar (met + partial + action + unknown = 100%),
 * and a 4-way breakdown legend. All inline styles so it renders
 * identically on-screen and in Puppeteer PDF output.
 */
export async function ComplianceSummary({
  frameworks,
}: {
  frameworks: FrameworkComplianceSummary[];
}) {
  const t = await getServerT();

  const tierLabel: Record<number, string> = {
    1: t("araReport.compliance_tier_1"),
    2: t("araReport.compliance_tier_2"),
    3: t("araReport.compliance_tier_3"),
  };

  if (frameworks.length === 0) {
    return (
      <p style={{ fontSize: "10pt", color: TOKENS.mute, fontStyle: "italic" }}>
        {t("araReport.compliance_none")}
      </p>
    );
  }

  const tiers = [1, 2, 3] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16pt" }}>
      {tiers.map((tier) => {
        const rows = frameworks.filter((f) => f.tier === tier);
        if (rows.length === 0) return null;
        return (
          <div key={tier}>
            <p style={{
              fontSize: "8.5pt", letterSpacing: "0.12em",
              color: TOKENS.mute, textTransform: "uppercase",
              fontWeight: 700, margin: "0 0 8pt",
            }}>
              {tierLabel[tier]} · {rows.length === 1
                ? t("araReport.compliance_framework_count_one", { count: rows.length })
                : t("araReport.compliance_framework_count_other", { count: rows.length })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8pt" }}>
              {rows.map((f) => <FrameworkCard key={f.framework_id} f={f} t={t} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type TFn = Awaited<ReturnType<typeof getServerT>>;

function FrameworkCard({ f, t }: { f: FrameworkComplianceSummary; t: TFn }) {
  const total = Math.max(1, f.met + f.partial + f.not_met + f.unknown);
  const pct = (n: number) => (n / total) * 100;

  return (
    <article style={{
      padding: "12pt 14pt", background: "white",
      border: `1pt solid ${TOKENS.line}`, borderRadius: "6pt",
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: "14pt", marginBottom: "10pt",
      }}>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: "10.5pt", fontWeight: 600, color: TOKENS.navy,
            margin: 0, lineHeight: 1.3,
          }}>
            {f.framework_name_en}
          </p>
          <p dir="rtl" style={{
            fontSize: "9pt", color: TOKENS.mute, margin: "2pt 0 0",
          }}>
            {f.framework_name_ar}
          </p>
          <p style={{
            fontSize: "8pt", color: TOKENS.mute, letterSpacing: "0.05em",
            textTransform: "uppercase", margin: "4pt 0 0", fontWeight: 500,
          }}>
            {f.total === 1
              ? t("araReport.compliance_requirement_count_one", { count: f.total })
              : t("araReport.compliance_requirement_count_other", { count: f.total })}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{
            fontSize: "22pt", fontWeight: 700, color: percentColor(f.percent),
            margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
          }}>
            {f.percent == null ? "-" : `${f.percent}%`}
          </p>
          <p style={{
            fontSize: "8pt", color: TOKENS.mute,
            letterSpacing: "0.08em", textTransform: "uppercase",
            margin: "2pt 0 0", fontWeight: 600,
          }}>
            {t("araReport.compliance_compliant")}
          </p>
        </div>
      </div>

      {/* Stacked segment bar - fills full width, no gaps */}
      <div style={{
        display: "flex", height: "6pt", borderRadius: "3pt",
        overflow: "hidden", background: "#f3f4f6", marginBottom: "8pt",
      }}>
        {f.met > 0 && (
          <div style={{ width: `${pct(f.met)}%`, background: TOKENS.emerald }} />
        )}
        {f.partial > 0 && (
          <div style={{ width: `${pct(f.partial)}%`, background: TOKENS.amber }} />
        )}
        {f.not_met > 0 && (
          <div style={{ width: `${pct(f.not_met)}%`, background: TOKENS.rose }} />
        )}
        {f.unknown > 0 && (
          <div style={{ width: `${pct(f.unknown)}%`, background: TOKENS.muteGrey }} />
        )}
      </div>

      {/* Breakdown legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "12pt",
        fontSize: "9pt", color: TOKENS.ink2,
      }}>
        <Breakdown label={t("araReport.compliance_met")} value={f.met} color={TOKENS.emerald} />
        <Breakdown label={t("araReport.compliance_partial")} value={f.partial} color={TOKENS.amber} />
        <Breakdown label={t("araReport.compliance_action")} value={f.not_met} color={TOKENS.rose} />
        {f.unknown > 0 && (
          <Breakdown label={t("araReport.compliance_unknown")} value={f.unknown} color={TOKENS.muteGrey} />
        )}
      </div>
    </article>
  );
}

function Breakdown({ label, value, color }: {
  label: string; value: number; color: string;
}) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4pt",
    }}>
      <Circle size={8} color={color} fill={color} strokeWidth={0} />
      <span style={{
        fontVariantNumeric: "tabular-nums", fontWeight: 600, color: TOKENS.navy,
      }}>
        {value}
      </span>
      <span style={{ color: TOKENS.mute }}>{label}</span>
    </span>
  );
}
