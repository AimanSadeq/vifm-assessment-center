"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ARA_INDIVIDUAL_FACTORS,
} from "@/lib/constants/ara-individual-factors";
import type { CompanyCohortInsight } from "@/lib/ara/company-cohort";

/**
 * Downloads the per-delegate cohort breakdown as a CSV (UTF-8 BOM for Excel /
 * Arabic). Admin-only surface, so per-person rows are appropriate here.
 */
export function CohortCsvButton({ insight }: { insight: CompanyCohortInsight }) {
  const onClick = () => {
    try {
      const factorCols = ARA_INDIVIDUAL_FACTORS.map((f) => f.name_en);
      const header = ["name", "email", "status", ...factorCols, "overall"];
      const esc = (v: string | number | null) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        header.join(","),
        ...insight.respondents.map((r) =>
          [
            esc(r.name),
            esc(r.email),
            r.completed_at ? "completed" : "in_progress",
            ...ARA_INDIVIDUAL_FACTORS.map((f) => {
              const v = r.per_factor[f.id];
              return v != null ? v.toFixed(2) : "";
            }),
            r.overall != null ? r.overall.toFixed(2) : "",
          ].join(",")
        ),
      ];
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = insight.company_label.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
      a.href = url;
      a.download = `arc-cohort-${safe || "company"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not export the cohort CSV.");
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1" onClick={onClick}>
      <Download className="h-3.5 w-3.5" /> CSV
    </Button>
  );
}
