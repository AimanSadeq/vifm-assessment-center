"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  extractCoursesFromPdfsAction,
  createCoursesFromProposalsAction,
  type ExtractRowResult,
} from "../actions";
import { VIFM_VERTICAL_LABELS } from "@/types/database";

type AcceptedRow = Extract<ExtractRowResult, { ok: true }> & { accepted: boolean };

export function CoursesImportClient() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, startExtract] = useTransition();
  const [committing, startCommit] = useTransition();
  const [results, setResults] = useState<ExtractRowResult[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const arr = Array.from(selected).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (arr.length !== selected.length) {
      toast.error("Only PDF files are accepted");
    }
    setFiles((prev) => {
      // de-dupe by name
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !existingNames.has(f.name))];
    });
  };

  const handleExtract = () => {
    if (files.length === 0) return;
    if (files.length > 25) {
      toast.error("Up to 25 PDFs per batch — split larger uploads");
      return;
    }
    startExtract(async () => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const r = await extractCoursesFromPdfsAction(fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResults(r.results);
      // default-accept every successful row; admin can deselect
      const init: Record<string, boolean> = {};
      for (const row of r.results) {
        if (row.ok) init[row.filename] = true;
      }
      setAccepted(init);
      const okCount = r.results.filter((x) => x.ok).length;
      toast.success(`Extracted ${okCount} of ${r.results.length} PDFs`);
    });
  };

  const successRows = results.filter((r): r is Extract<ExtractRowResult, { ok: true }> => r.ok);
  const failedRows = results.filter((r): r is Extract<ExtractRowResult, { ok: false }> => !r.ok);
  const acceptedCount = successRows.filter((r) => accepted[r.filename]).length;

  const handleCommit = () => {
    const proposals = successRows
      .filter((r) => accepted[r.filename])
      .map((r) => ({ payload: r.payload, filename: r.filename }));
    if (proposals.length === 0) {
      toast.error("Nothing accepted to create");
      return;
    }
    startCommit(async () => {
      const r = await createCoursesFromProposalsAction(proposals);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const msg = `Created ${r.created.length} course${r.created.length === 1 ? "" : "s"}` +
        (r.failed.length > 0 ? ` (${r.failed.length} failed — see logs)` : "");
      toast.success(msg);
      router.push("/admin/courses");
    });
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        htmlFor="course-pdf-upload"
        className="block rounded-lg border-2 border-dashed bg-muted/30 hover:bg-muted/50 cursor-pointer p-8 text-center transition-colors"
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium mt-2">
          Drop PDFs here or click to browse
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Up to 25 PDFs per batch · processed 5 in parallel · ~10-30s per file
        </p>
        <input
          id="course-pdf-upload"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {/* Selected files */}
      {files.length > 0 && results.length === 0 && (
        <div className="rounded-md border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">{files.length} file{files.length === 1 ? "" : "s"} ready</p>
            <Button size="sm" variant="ghost" onClick={() => setFiles([])} disabled={extracting}>
              Clear
            </Button>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground max-h-40 overflow-auto">
            {files.map((f) => (
              <li key={f.name}>{f.name} <span className="text-[10px]">({(f.size / 1024).toFixed(0)} KB)</span></li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <Button onClick={handleExtract} disabled={extracting} className="gap-2">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {extracting ? "Extracting…" : `Extract ${files.length} PDF${files.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <strong>{successRows.length}</strong> extracted · <strong>{acceptedCount}</strong> accepted
              {failedRows.length > 0 && <> · <strong className="text-destructive">{failedRows.length}</strong> failed</>}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setResults([]);
                  setAccepted({});
                  setFiles([]);
                }}
                disabled={committing}
              >
                Start over
              </Button>
              <Button
                onClick={handleCommit}
                disabled={committing || acceptedCount === 0}
                className="gap-2"
              >
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Create {acceptedCount} course{acceptedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>

          {failedRows.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-3">
                <p className="text-xs font-medium text-destructive flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Failed extractions
                </p>
                <ul className="text-xs space-y-0.5">
                  {failedRows.map((r) => (
                    <li key={r.filename}>
                      <span className="font-mono">{r.filename}</span>
                      <span className="text-muted-foreground"> — {r.error}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {successRows.map((row) => {
              const p = row.payload;
              const isAccepted = accepted[row.filename] ?? false;
              return (
                <Card key={row.filename} className={isAccepted ? "" : "opacity-60"}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isAccepted}
                          onChange={(e) => setAccepted((prev) => ({ ...prev, [row.filename]: e.target.checked }))}
                          className="mt-1 h-4 w-4 rounded border-input"
                        />
                        <div>
                          <p className="text-sm font-medium">{p.title_en}</p>
                          {p.title_ar && <p className="text-xs text-muted-foreground" dir="rtl">{p.title_ar}</p>}
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{row.filename}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        <Badge variant="outline" className="text-[10px]">{VIFM_VERTICAL_LABELS[p.vertical]}</Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">{p.level}</Badge>
                        <Badge variant="outline" className="text-[10px] tabular-nums">
                          {p.min_duration_days === p.max_duration_days
                            ? `${p.default_duration_days}d`
                            : `${p.min_duration_days}-${p.max_duration_days}d`}
                        </Badge>
                        {p.code && <Badge variant="outline" className="text-[10px] font-mono">{p.code}</Badge>}
                      </div>
                    </div>

                    {p.competency_tags.length > 0 && (
                      <div className="text-[11px] text-muted-foreground">
                        <strong>AC competencies:</strong>{" "}
                        {p.competency_tags.map((t) => (
                          <span key={t.competency_id} className="inline-block me-1.5">
                            {t.competency_name}
                            <span className="text-[10px] text-muted-foreground/70"> ·{t.relevance_weight}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {p.pillar_tags.length > 0 && (
                      <div className="text-[11px] text-muted-foreground">
                        <strong>ARA pillars:</strong>{" "}
                        {p.pillar_tags.map((t) => (
                          <span key={t.pillar_id} className="inline-block me-1.5 capitalize">
                            {t.pillar_id.replace(/_/g, " ")}
                            <span className="text-[10px] text-muted-foreground/70"> ·{t.relevance_weight}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">
                      Confidence {Math.round(p.extraction_confidence * 100)}%
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
