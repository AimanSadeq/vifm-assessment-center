import type { FrameworkComplianceSummary } from "@/lib/ara/compliance";

const barColor = (percent: number | null) => {
  if (percent == null) return "#9ca3af";
  if (percent >= 80) return "#28A745";
  if (percent >= 50) return "#FFC107";
  return "#DC3545";
};

export function ComplianceSummary({
  frameworks,
}: {
  frameworks: FrameworkComplianceSummary[];
}) {
  if (frameworks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No applicable regulatory frameworks for this region/sector.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {frameworks.map((f) => (
        <div key={f.framework_id} className="rounded-lg border p-3 bg-card">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <p className="text-sm font-semibold">{f.framework_name_en}</p>
              <p className="text-[11px] text-muted-foreground" dir="rtl">
                {f.framework_name_ar}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                Tier {f.tier} • {f.total} requirement{f.total === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums" style={{ color: barColor(f.percent) }}>
                {f.percent == null ? "—" : `${f.percent}%`}
              </div>
              <div className="text-[10px] uppercase text-muted-foreground">Compliant</div>
            </div>
          </div>
          {f.percent != null && (
            <div className="h-1.5 bg-muted rounded overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${f.percent}%`, background: barColor(f.percent) }}
              />
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 text-[11px]">
            <span className="text-emerald-700">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 me-1" />
              {f.met} met
            </span>
            <span className="text-amber-700">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 me-1" />
              {f.partial} partial
            </span>
            <span className="text-red-700">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600 me-1" />
              {f.not_met} action required
            </span>
            {f.unknown > 0 && (
              <span className="text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400 me-1" />
                {f.unknown} unknown
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
