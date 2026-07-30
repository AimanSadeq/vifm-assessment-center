"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { reportModelCoverage, type CoverageState } from "@/lib/reports/report-model-coverage";

const TONE: Record<CoverageState, { cls: string; Icon: typeof CheckCircle2; word: string }> = {
  full: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2, word: "Full" },
  partial: { cls: "border-amber-200 bg-amber-50 text-amber-800", Icon: AlertTriangle, word: "Partial" },
  unavailable: { cls: "border-rose-200 bg-rose-50 text-rose-800", Icon: XCircle, word: "Won't generate" },
};

/** Live "what does this selection buy?" strip for the Persona competency
 *  picker: per report model, whether the scoped sitting yields a Full report,
 *  a Partial one (unmeasured sections marked "not selected"), or none. */
export function ReportCoverageBadges({ selectedIds }: { selectedIds: string[] }) {
  const coverage = reportModelCoverage(selectedIds);
  return (
    <div className="rounded-md border border-border bg-muted/40 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Reports this selection generates
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {coverage.map((c) => {
          const t = TONE[c.state];
          return (
            <span
              key={c.key}
              title={c.note}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${t.cls}`}
            >
              <t.Icon className="h-3 w-3" />
              {c.label}: {t.word}
              <span className="font-normal opacity-75">· {c.note}</span>
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Partial reports mark unmeasured sections as &quot;not selected&quot; - they never fabricate scores. For full
        model reports, keep the whole battery selected.
      </p>
    </div>
  );
}
