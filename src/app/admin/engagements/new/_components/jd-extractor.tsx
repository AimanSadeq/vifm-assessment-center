"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
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
        toast.error("Choose a file first.");
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
    toast.success(`Found ${result.recommendations.length} competencies`);
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
      toast.error("Pick at least one competency to apply.");
      return;
    }

    if (onApply) {
      onApply(selectedFull);
      toast.success(`Applied ${selectedFull.length} competencies`);
      setOpen(false);
      reset();
      return;
    }

    if (selectedFull.length > 15) {
      toast.error(`Step 2 allows max 15 competencies; you've picked ${selectedFull.length}.`);
      return;
    }
    const compact = selectedFull.map((r) => ({ competencyId: r.competencyId, weight: r.weight }));
    dispatch({ type: "SET_COMPETENCIES", competencies: compact });
    toast.success(`Applied ${selectedFull.length} competencies to your engagement`);
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
          {triggerLabel ?? "Suggest from Job Description"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Suggest Competencies from Job Description
          </DialogTitle>
          <DialogDescription>
            Paste a job description (English or Arabic). Claude maps it to
            VIFM&apos;s 38-competency framework with suggested weights and
            priorities. You can then refine before applying.
          </DialogDescription>
        </DialogHeader>

        {phase === "input" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="jd-target-role">
                Target role <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="jd-target-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Branch Manager, Compliance Officer"
              />
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Paste text
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload file
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-1.5">
                <Label htmlFor="jd-text">Job description *</Label>
                <Textarea
                  id="jd-text"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job description here. Both English and Arabic are supported."
                  rows={14}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {jd.length} characters · minimum 50
                </p>
              </TabsContent>

              <TabsContent value="upload" className="space-y-2">
                <Label htmlFor="jd-file">Job description file *</Label>
                {file ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size)} · {file.type || "unknown type"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileChange(null)}
                      aria-label="Remove file"
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
                    <p className="text-sm font-medium">Click to upload a JD file</p>
                    <p className="text-xs text-muted-foreground">
                      PDF or TXT · max 10MB · English or Arabic
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
              <p className="font-semibold">Analyzing job description...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Claude is mapping the JD to VIFM&apos;s competency framework. This
                usually takes 15–30 seconds.
              </p>
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-3">
            <DomainTallyCard recs={recs} domains={domains} />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {picked.size} of {recs.length} competencies selected
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (picked.size === recs.length) setPicked(new Set());
                  else setPicked(new Set(recs.map((r) => r.competencyId)));
                }}
              >
                {picked.size === recs.length ? "Clear all" : "Select all"}
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
                          {r.priority}
                        </Badge>
                        <Badge variant="outline">weight {r.weight}</Badge>
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
                Cancel
              </Button>
              <Button onClick={onExtract} disabled={!canExtract}>
                <Sparkles className="h-4 w-4 me-2" />
                Extract competencies
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button variant="ghost" onClick={reset}>
                Back
              </Button>
              <Button
                onClick={handleApply}
                disabled={picked.size === 0 || (!onApply && picked.size > 15)}
              >
                Apply {picked.size}
                {onApply ? "" : " to engagement"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// VIFM domain ordering — matches `competency_domains.sort_order` in the seed.
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
          AI Mapping Summary
        </p>
        <p className="text-[11px] text-muted-foreground">
          {recs.length} total
          {unmapped > 0 ? ` · ${unmapped} unclassified` : ""}
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
