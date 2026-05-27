"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Loader2, FileText, CheckCircle2, XCircle, Sparkles, ExternalLink } from "lucide-react";
import {
  bulkExtractJdsAction,
  bulkCreateRoleProfilesAction,
  type BulkJdExtractItem,
} from "../actions";
import type { ExtractedCompetencyRecommendation } from "@/lib/ai/jd-competency-extractor";

type AcceptedRow = {
  fileName: string;
  name: string;
  recommendations: ExtractedCompetencyRecommendation[];
};

function extractRecommendations(item: BulkJdExtractItem): ExtractedCompetencyRecommendation[] {
  return item.status === "ok" ? item.recommendations : [];
}

const PRIORITY_TONE: Record<"high" | "medium" | "low", string> = {
  high: "bg-rose-50 text-rose-800 border-rose-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-slate-50 text-slate-700 border-slate-200",
};

export function BulkImportClient() {
  const router = useRouter();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<BulkJdExtractItem[]>([]);
  // Track per-row name overrides + accept toggles, keyed by fileName
  const [names, setNames] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [extracting, startExtract] = useTransition();
  const [creating, startCreate] = useTransition();
  const [createSummary, setCreateSummary] = useState<
    | { created: { name: string; id: string }[]; failed: { name: string; message: string }[] }
    | null
  >(null);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = Array.from(incoming).filter((f) => /\.(pdf|txt)$/i.test(f.name));
    setFiles(next.slice(0, 25));
  };

  const handleExtract = () => {
    if (files.length === 0) {
      toast.error(t("adminRoleProfiles.bulkImport.errPickFiles"));
      return;
    }
    setItems([]);
    setNames({});
    setAccepted({});
    setCreateSummary(null);

    startExtract(async () => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const result = await bulkExtractJdsAction(fd);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setItems(result.items);
      const initialNames: Record<string, string> = {};
      const initialAccepts: Record<string, boolean> = {};
      for (const it of result.items) {
        if (it.status === "ok") {
          initialNames[it.fileName] = it.suggestedName;
          initialAccepts[it.fileName] = true;
        }
      }
      setNames(initialNames);
      setAccepted(initialAccepts);
      const okCount = result.items.filter((i) => i.status === "ok").length;
      const errCount = result.items.length - okCount;
      toast.success(
        errCount > 0
          ? t("adminRoleProfiles.bulkImport.toastExtractedWithFailures", { ok: okCount, failed: errCount })
          : t("adminRoleProfiles.bulkImport.toastExtracted", { ok: okCount })
      );
    });
  };

  const handleCreate = () => {
    const profiles: AcceptedRow[] = items
      .filter(
        (i): i is BulkJdExtractItem & { status: "ok" } =>
          i.status === "ok" && accepted[i.fileName] === true
      )
      .map((i) => ({
        fileName: i.fileName,
        name: (names[i.fileName] ?? i.suggestedName).trim(),
        recommendations: i.recommendations,
      }))
      .filter((p) => p.name.length > 0);

    if (profiles.length === 0) {
      toast.error(t("adminRoleProfiles.bulkImport.errPickRow"));
      return;
    }

    startCreate(async () => {
      const result = await bulkCreateRoleProfilesAction({
        profiles: profiles.map(({ name, recommendations }) => ({ name, recommendations })),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCreateSummary(result);
      const tone = result.failed.length > 0 ? toast.warning : toast.success;
      tone(t("adminRoleProfiles.bulkImport.toastCreateSummary", {
        created: result.created.length,
        failed: result.failed.length,
      }));
      router.refresh();
    });
  };

  const acceptedCount = items
    .filter((i) => i.status === "ok")
    .filter((i) => accepted[i.fileName]).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("adminRoleProfiles.bulkImport.chooseFiles")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center cursor-pointer hover:bg-muted/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium mt-2">{t("adminRoleProfiles.bulkImport.dropzoneTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("adminRoleProfiles.bulkImport.dropzoneHint")}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,application/pdf,text/plain"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {files.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("adminRoleProfiles.bulkImport.filesSelected", { count: files.length })}
              </p>
              <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto ps-4 list-disc">
                {files.map((f) => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={handleExtract} disabled={extracting || files.length === 0} className="gap-2">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {extracting
                ? t("adminRoleProfiles.bulkImport.analyzing", { count: files.length })
                : t("adminRoleProfiles.bulkImport.extractButton", { count: files.length || "" })}
            </Button>
            {extracting && (
              <p className="text-xs text-muted-foreground">
                {t("adminRoleProfiles.bulkImport.extractingNote")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <FileText className="h-4 w-4" />
              {t("adminRoleProfiles.bulkImport.resultsTitle")}
              <Badge variant="default">
                {t("adminRoleProfiles.bulkImport.badgeSucceeded", {
                  count: items.filter((i) => i.status === "ok").length,
                })}
              </Badge>
              {items.some((i) => i.status === "error") && (
                <Badge variant="destructive">
                  {t("adminRoleProfiles.bulkImport.badgeFailed", {
                    count: items.filter((i) => i.status === "error").length,
                  })}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => {
              if (item.status === "error") {
                return (
                  <div
                    key={item.fileName}
                    className="rounded-md border border-rose-200 bg-rose-50 p-3 flex items-start gap-2"
                  >
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.fileName}</p>
                      <p className="text-xs text-rose-800 mt-0.5">{item.error}</p>
                    </div>
                  </div>
                );
              }
              const isAccepted = accepted[item.fileName] !== false;
              return (
                <div
                  key={item.fileName}
                  className={`rounded-md border p-3 space-y-2 ${
                    isAccepted ? "bg-card" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isAccepted}
                      onCheckedChange={(c) =>
                        setAccepted((prev) => ({ ...prev, [item.fileName]: c === true }))
                      }
                      className="mt-2"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">{item.fileName}</p>
                      </div>
                      <Input
                        value={names[item.fileName] ?? item.suggestedName}
                        onChange={(e) =>
                          setNames((prev) => ({ ...prev, [item.fileName]: e.target.value }))
                        }
                        placeholder={t("adminRoleProfiles.bulkImport.profileNamePlaceholder")}
                        className="text-sm font-medium"
                        disabled={!isAccepted}
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {extractRecommendations(item)
                          .slice(0, 8)
                          .map((r) => (
                            <span
                              key={r.competencyId}
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                                PRIORITY_TONE[r.priority]
                              }`}
                            >
                              {r.competencyName}
                            </span>
                          ))}
                        {extractRecommendations(item).length > 8 && (
                          <span className="text-[11px] text-muted-foreground self-center">
                            {t("adminRoleProfiles.bulkImport.moreChips", {
                              count: extractRecommendations(item).length - 8,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                onClick={handleCreate}
                disabled={creating || acceptedCount === 0}
                className="gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {t("adminRoleProfiles.bulkImport.createButton", { count: acceptedCount })}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("adminRoleProfiles.bulkImport.namesNote")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {createSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("adminRoleProfiles.bulkImport.createdTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {createSummary.created.length === 0 && createSummary.failed.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("adminRoleProfiles.bulkImport.nothingSaved")}</p>
            )}
            {createSummary.created.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border bg-emerald-50 border-emerald-200 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-sm font-medium truncate">{c.name}</p>
                </div>
                <Link
                  href={`/admin/role-profiles/${c.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
                >
                  {t("adminRoleProfiles.bulkImport.open")}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
            {createSummary.failed.map((f, i) => (
              <div
                key={i}
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <p className="text-sm font-medium">{f.name}</p>
                </div>
                <p className="text-xs text-rose-800 mt-1 ms-6">{f.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
