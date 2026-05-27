"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  extractCompetenciesFromJdAction,
  extractCompetenciesFromJdFileAction,
  type CompetencyDomainMap,
} from "../actions";
import type { ExtractedCompetencyRecommendation } from "@/lib/ai/jd-competency-extractor";
import { useWizard, useWizardDispatch } from "./wizard-context";

type Phase = "input" | "extracting" | "preview";
type Mode = "paste" | "upload";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const priorityStyles: Record<
  ExtractedCompetencyRecommendation["priority"],
  string
> = {
  high: "bg-red-100 text-red-900 hover:bg-red-100",
  medium: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  low: "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

type JdExtractorProps = {
  /**
   * If provided, replaces the default behavior (which dispatches to the
   * engagement wizard's competency state). Receives the full set of
   * picked recommendations including weight, priority, and reasoning.
   */
  onApply?: (selected: ExtractedCompetencyRecommendation[]) => void;
  /** Override the trigger button label/icon. */
  triggerLabel?: string;
};

export function JdExtractor({ onApply, triggerLabel }: JdExtractorProps = {}) {
  const wizard = useWizard();
  const dispatch = useWizardDispatch();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [mode, setMode] = useState<Mode>("paste");
  const [jd, setJd] = useState("");
  const [targetRole, setTargetRole] = useState(wizard.targetRole ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [recs, setRecs] = useState<ExtractedCompetencyRecommendation[]>([]);
  const [domains, setDomains] = useState<CompetencyDomainMap>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase("input");
    setRecs([]);
    setDomains({});
    setPicked(new Set());
  };

  const handleFileChange = (next: File | null) => {
    setFile(next);
    if (!next && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canExtract = mode === "paste" ? jd.trim().length >= 50 : !!file;

  const onExtract = async () => {
    setPhase("extracting");

    let result: Awaited<ReturnType<typeof extractCompetenciesFromJdAction>>
      | Awaited<ReturnType<typeof extractCompetenciesFromJdFileAction>>;

    if (mode === "paste") {
      result = await extractCompetenciesFromJdAction({
        jobDescription: jd,
        targetRole: targetRole.trim() || undefined,
      });
    } else {
      if (!file) {
        toast.error(t("adminWizard.jd.chooseFileFirstToast"));
        setPhase("input");
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetRole", targetRole.trim());
      result = await extractCompetenciesFromJdFileAction(fd);
    }

    if ("error" in result) {
      toast.error(result.error);
      setPhase("input");
      return;
    }
    setRecs(result.recommendations);
    setDomains(result.domains ?? {});
    setPicked(new Set(result.recommendations.map((r) => r.competencyId)));
    setPhase("preview");
    toast.success(t("adminWizard.jd.foundToast", { count: result.recommendations.length }));
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    const selectedFull = recs.filter((r) => picked.has(r.competencyId));

    if (selectedFull.length === 0) {
      toast.error(t("adminWizard.jd.pickAtLeastOneToast"));
      return;
    }

    if (onApply) {
      onApply(selectedFull);
      toast.success(t("adminWizard.jd.appliedToast", { count: selectedFull.length }));
      setOpen(false);
      reset();
      return;
    }

    if (selectedFull.length > 15) {
      toast.error(t("adminWizard.jd.maxExceededToast", { count: selectedFull.length }));
      return;
    }
    const compact = selectedFull.map((r) => ({ competencyId: r.competencyId, weight: r.weight }));
    dispatch({ type: "SET_COMPETENCIES", competencies: compact });
    toast.success(t("adminWizard.jd.appliedToEngagementToast", { count: selectedFull.length }));
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {triggerLabel ?? t("adminWizard.jd.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("adminWizard.jd.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("adminWizard.jd.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        {phase === "input" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="jd-target-role">
                {t("adminWizard.jd.targetRole")} <span className="text-muted-foreground">{t("adminWizard.jd.optional")}</span>
              </Label>
              <Input
                id="jd-target-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder={t("adminWizard.jd.targetRolePlaceholder")}
              />
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="gap-2">
                  <FileText className="h-4 w-4" />
                  {t("adminWizard.jd.tabPaste")}
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  {t("adminWizard.jd.tabUpload")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-1.5">
                <Label htmlFor="jd-text">{t("adminWizard.jd.jobDescription")}</Label>
                <Textarea
                  id="jd-text"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder={t("adminWizard.jd.pastePlaceholder")}
                  rows={14}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t("adminWizard.jd.charCount", { count: jd.length })}
                </p>
              </TabsContent>

              <TabsContent value="upload" className="space-y-2">
                <Label htmlFor="jd-file">{t("adminWizard.jd.jobDescriptionFile")}</Label>
                {file ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminWizard.jd.fileMeta", { size: formatBytes(file.size), type: file.type || t("adminWizard.jd.unknownType") })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileChange(null)}
                      aria-label={t("adminWizard.jd.removeFile")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="jd-file"
                    className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-10 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{t("adminWizard.jd.uploadPrompt")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("adminWizard.jd.uploadHint")}
                    </p>
                  </label>
                )}
                <input
                  ref={fileInputRef}
                  id="jd-file"
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="sr-only"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {phase === "extracting" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-semibold">{t("adminWizard.jd.analyzingTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("adminWizard.jd.analyzingBody")}
              </p>
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-3">
            <DomainTallyCard recs={recs} domains={domains} />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("adminWizard.jd.selectedCount", { picked: picked.size, total: recs.length })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (picked.size === recs.length) setPicked(new Set());
                  else setPicked(new Set(recs.map((r) => r.competencyId)));
                }}
              >
                {picked.size === recs.length ? t("adminWizard.jd.clearAll") : t("adminWizard.jd.selectAll")}
              </Button>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {recs.map((r) => {
                const isPicked = picked.has(r.competencyId);
                return (
                  <div
                    key={r.competencyId}
                    className={`flex gap-3 rounded-md border p-3 transition-colors ${
                      isPicked ? "bg-muted/50 border-primary/30" : "bg-card"
                    }`}
                  >
                    <Checkbox
                      checked={isPicked}
                      onCheckedChange={() => togglePick(r.competencyId)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {r.competencyName}
                        </span>
                        <Badge
                          variant="secondary"
                          className={priorityStyles[r.priority]}
                        >
                          {t(`adminWizard.jd.priority.${r.priority}`)}
                        </Badge>
                        <Badge variant="outline">{t("adminWizard.jd.weightLabel", { weight: r.weight })}</Badge>
                      </div>
                      {r.reasoning && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {r.reasoning}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {phase === "input" && (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("adminWizard.jd.cancel")}
              </Button>
              <Button onClick={onExtract} disabled={!canExtract}>
                <Sparkles className="h-4 w-4 me-2" />
                {t("adminWizard.jd.extract")}
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button variant="ghost" onClick={reset}>
                {t("adminWizard.jd.back")}
              </Button>
              <Button
                onClick={handleApply}
                disabled={picked.size === 0 || (!onApply && picked.size > 15)}
              >
                {onApply
                  ? t("adminWizard.jd.apply", { count: picked.size })
                  : t("adminWizard.jd.applyToEngagement", { count: picked.size })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// VIFM domain ordering - matches `competency_domains.sort_order` in the seed.
// Industry vendors typically split competencies along Functional / Digital /
// Leadership / Behavioural lines. VIFM uses its own native 4-domain framework
// (THINKING / RESULTS / PEOPLE / SELF) so admins recognise the buckets used
// throughout the AC reports.
const DOMAIN_ORDER = ["THINKING", "RESULTS", "PEOPLE", "SELF"] as const;

type DomainTone = { bg: string; fg: string; border: string };
const DOMAIN_TONES: Record<string, DomainTone> = {
  THINKING: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
  RESULTS:  { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  PEOPLE:   { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa" },
  SELF:     { bg: "#f5f3ff", fg: "#6d28d9", border: "#ddd6fe" },
};

function DomainTallyCard({
  recs,
  domains,
}: {
  recs: ExtractedCompetencyRecommendation[];
  domains: CompetencyDomainMap;
}) {
  const { t } = useTranslation();

  // If the join didn't return data (e.g. domain seed missing), skip the card
  // rather than render an empty grid.
  if (Object.keys(domains).length === 0) return null;

  const counts: Record<string, number> = {};
  let unmapped = 0;
  for (const r of recs) {
    const domain = domains[r.competencyId];
    if (!domain) {
      unmapped += 1;
      continue;
    }
    counts[domain.name] = (counts[domain.name] ?? 0) + 1;
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("adminWizard.jd.tally.title")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t("adminWizard.jd.tally.total", { count: recs.length })}
          {unmapped > 0 ? t("adminWizard.jd.tally.unclassified", { count: unmapped }) : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DOMAIN_ORDER.map((name) => {
          const count = counts[name] ?? 0;
          const tone = DOMAIN_TONES[name];
          return (
            <div
              key={name}
              className="rounded-md border px-2.5 py-1.5"
              style={{
                backgroundColor: tone.bg,
                borderColor: tone.border,
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: tone.fg }}>
                {name}
              </p>
              <p className="text-lg font-bold leading-tight" style={{ color: tone.fg }}>
                {count}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
