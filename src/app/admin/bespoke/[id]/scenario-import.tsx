"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyScenarioImportAction, previewScenarioImportAction, type ScenarioImportPreview } from "./scenario-import-actions";

const MAX_BYTES = 5 * 1024 * 1024;

const OUTCOME: Record<string, { label: string; tone: string }> = {
  loaded: { label: "Loads", tone: "bg-emerald-100 text-emerald-800" },
  skipped: { label: "Skipped", tone: "bg-slate-100 text-slate-700" },
  error: { label: "Error", tone: "bg-rose-100 text-rose-800" },
};

/** Upload the SME's scenario workbook: check it (nothing written), then load it.
 *  Same checks and response keys as scripts/sdc-hipo/load-scenarios.py. */
export function ScenarioImport({ bundleId }: { bundleId: string }) {
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [includeReview, setIncludeReview] = useState(false);
  const [preview, setPreview] = useState<ScenarioImportPreview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = (f: File) => {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("includeReview", String(includeReview));
    return fd;
  };

  const check = () =>
    start(async () => {
      if (!file) return;
      const res = await previewScenarioImportAction(bundleId, form(file));
      if ("error" in res) {
        setPreview(null);
        toast.error(res.error);
      } else setPreview(res.preview);
    });

  const load = () =>
    start(async () => {
      if (!file || !preview) return;
      const n = preview.loadable;
      if (!window.confirm(`Load ${n} scenario${n === 1 ? "" : "s"} into this bundle? Active scenarios that are not in this workbook will be retired.`)) return;
      const res = await applyScenarioImportAction(bundleId, form(file));
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Loaded ${res.preview.loadable} scenario${res.preview.loadable === 1 ? "" : "s"}: ${res.added} new, ${res.updated} updated, ${res.retired} retired.`,
      );
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    });

  const pick = (f: File | null) => {
    setPreview(null);
    if (f && !f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx workbooks are accepted.");
      f = null;
    } else if (f && f.size > MAX_BYTES) {
      toast.error("The workbook is too large (max 5 MB).");
      f = null;
    }
    if (!f && inputRef.current) inputRef.current.value = "";
    setFile(f);
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="inline-flex items-center gap-2 text-sm font-medium">
        <FileSpreadsheet className="h-4 w-4 text-[#5391D5]" /> Load scenarios from the SME&apos;s workbook
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The completed scenario template (.xlsx, sheet &apos;Scenarios&apos;). Rows marked Approved are loaded; rows with errors are left out. Loading again
        updates scenarios by Scenario ID and keeps their response keys, so candidates who already started are not affected. Scenarios no longer in the
        workbook are retired.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="max-w-full text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={includeReview}
            onChange={(e) => {
              setIncludeReview(e.target.checked);
              setPreview(null);
            }}
          />
          Also load rows marked Ready for review (pilot)
        </label>
        <Button size="sm" variant="outline" disabled={pending || !file} onClick={check}>
          {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />} Check workbook
        </Button>
      </div>

      {preview && (
        <div className="mt-3">
          {preview.fatal && <p className="text-xs font-medium text-rose-700">{preview.fatal.replace(/\.$/, "")}. Nothing can be loaded from this workbook.</p>}
          <p className="text-xs text-muted-foreground">
            Statuses loaded: {preview.statuses.join(", ")}. {preview.loadable} ready to load
            {Object.keys(preview.perCompetency).length > 0 ? ` (${Object.entries(preview.perCompetency).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}
            {` · ${preview.errors} with errors · ${preview.skipped} skipped.`}
          </p>
          {!preview.fatal && preview.loadable > 0 && preview.short.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">Fewer than 3 scenarios for: {preview.short.join(", ")}.</p>
          )}
          {preview.report.length > 0 && (
            <div className="mt-2 max-h-96 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th className="px-2 py-1.5">Scenario ID</th>
                    <th className="px-2 py-1.5">Row</th>
                    <th className="px-2 py-1.5">Outcome</th>
                    <th className="px-2 py-1.5">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.report.map((r, i) => (
                    <tr key={`${r.ref}-${r.row}-${i}`} className="border-t align-top">
                      <td className="whitespace-nowrap px-2 py-1.5 font-medium">{r.ref}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.row}</td>
                      <td className="px-2 py-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${OUTCOME[r.outcome].tone}`}>{OUTCOME[r.outcome].label}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {r.messages.length === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {r.messages.map((m, j) => (
                              <li
                                key={j}
                                className={r.outcome === "skipped" ? "text-muted-foreground" : j < r.errorCount ? "text-rose-700" : "text-amber-700"}
                              >
                                {m}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!preview.fatal && preview.loadable > 0 && (
            <Button className="mt-3" size="sm" disabled={pending} onClick={load}>
              {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Load {preview.loadable} scenario{preview.loadable === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
