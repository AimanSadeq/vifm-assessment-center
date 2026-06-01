"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, Loader2, Sparkles, FileText, Layers3, Trash2, ExternalLink, Plus, Wand2,
} from "lucide-react";
import type { LocalizedTechFunction } from "@/lib/competencies/technical-function";
import type { JdFunctionBlueprint } from "@/lib/ai/jd-technical-extractor";
import {
  extractFunctionFromJdAction,
  createTechnicalFunctionAction,
  deleteTechnicalFunctionAction,
} from "../actions";

type CategoryOpt = { value: string; label: string };

const WEIGHT_KEY: Record<number, string> = { 1: "techFn.w1", 2: "techFn.w2", 3: "techFn.w3" };

export function FunctionsClient({
  functions,
  categories,
  aiOn,
}: {
  functions: LocalizedTechFunction[];
  categories: CategoryOpt[];
  aiOn: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [targetRole, setTargetRole] = useState("");
  const [jdText, setJdText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extracting, startExtract] = useTransition();

  const [bp, setBp] = useState<JdFunctionBlueprint | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]?.value ?? "accounting");
  // selection + name overrides
  const [matchedOn, setMatchedOn] = useState<Record<string, boolean>>({});
  const [proposedOn, setProposedOn] = useState<Record<number, boolean>>({});
  const [proposedName, setProposedName] = useState<Record<number, string>>({});
  const [creating, startCreate] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, LocalizedTechFunction[]>();
    for (const f of functions) {
      const k = f.categoryLabel;
      (map.get(k) ?? map.set(k, []).get(k)!).push(f);
    }
    return Array.from(map.entries());
  }, [functions]);

  const handleExtract = () => {
    if (!jdText.trim() && !file) {
      toast.error(t("techFn.needJd"));
      return;
    }
    startExtract(async () => {
      const fd = new FormData();
      if (targetRole.trim()) fd.append("targetRole", targetRole.trim());
      if (file) fd.append("file", file);
      else fd.append("jdText", jdText);
      const res = await extractFunctionFromJdAction(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const b = res.blueprint;
      setBp(b);
      setName(b.suggestedName);
      setCategory(categories.some((c) => c.value === b.suggestedCategory) ? b.suggestedCategory : (categories[0]?.value ?? "accounting"));
      setMatchedOn(Object.fromEntries(b.matched.map((m) => [m.skill, true])));
      setProposedOn(Object.fromEntries(b.proposed.map((_, i) => [i, true])));
      setProposedName(Object.fromEntries(b.proposed.map((p, i) => [i, p.name])));
      toast.success(t("techFn.extracted", { matched: b.matched.length, proposed: b.proposed.length }));
    });
  };

  const finalSkills = (): string[] => {
    if (!bp) return [];
    const fromMatched = bp.matched.filter((m) => matchedOn[m.skill]).map((m) => m.skill);
    const fromProposed = bp.proposed
      .map((_, i) => (proposedOn[i] ? (proposedName[i] ?? bp.proposed[i].name).trim() : ""))
      .filter(Boolean);
    return Array.from(new Set([...fromMatched, ...fromProposed]));
  };

  const handleCreate = () => {
    const skills = finalSkills();
    if (!name.trim()) {
      toast.error(t("techFn.needName"));
      return;
    }
    if (skills.length < 3) {
      toast.error(t("techFn.atLeast3"));
      return;
    }
    startCreate(async () => {
      const res = await createTechnicalFunctionAction({ name: name.trim(), category, skills });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("techFn.created"));
      setBp(null);
      setJdText("");
      setFile(null);
      setTargetRole("");
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t("techFn.deleteConfirm"))) return;
    startCreate(async () => {
      const res = await deleteTechnicalFunctionAction({ id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("techFn.deleted"));
      router.refresh();
    });
  };

  const selectedCount = bp ? finalSkills().length : 0;

  return (
    <div className="space-y-5">
      {/* Import a JD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-[#5391D5]" /> {t("techFn.importTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("techFn.importIntro")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!aiOn && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("techFn.aiOff")}
            </div>
          )}
          <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder={t("techFn.targetRolePh")} disabled={!aiOn} />
          <textarea
            value={jdText}
            onChange={(e) => { setJdText(e.target.value); if (e.target.value) setFile(null); }}
            placeholder={t("techFn.jdPlaceholder")}
            rows={6}
            disabled={!aiOn || !!file}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!aiOn}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {file ? file.name : t("techFn.orUpload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) setJdText(""); }}
            />
            <Button onClick={handleExtract} disabled={!aiOn || extracting || (!jdText.trim() && !file)} className="gap-2">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {extracting ? t("techFn.analyzing") : t("techFn.analyze")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Review & create */}
      {bp && (
        <Card className="border-[#5391D5]/40">
          <CardHeader>
            <CardTitle className="text-base">{t("techFn.reviewTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[14rem] space-y-1.5">
                <Label className="text-xs">{t("techFn.nameLabel")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="w-48 space-y-1.5">
                <Label className="text-xs">{t("techFn.categoryLabel")}</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matched (reused) skills */}
            {bp.matched.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("techFn.matchedTitle")}</p>
                <div className="space-y-1.5">
                  {bp.matched.map((m) => (
                    <label key={m.skill} className="flex items-start gap-2.5 rounded-md border p-2.5 text-sm">
                      <Checkbox checked={matchedOn[m.skill] !== false} onCheckedChange={(c) => setMatchedOn((s) => ({ ...s, [m.skill]: c === true }))} className="mt-0.5" />
                      <span className="flex-1">
                        <span className="font-medium text-[#010131]">{m.skill}</span>
                        <Badge variant="secondary" className="ms-2 text-[10px]">{t(WEIGHT_KEY[m.weight] ?? "techFn.w2")}</Badge>
                        {m.rationale && <span className="mt-0.5 block text-[11px] text-muted-foreground">{m.rationale}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed new skills */}
            {bp.proposed.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("techFn.proposedTitle")}</p>
                <div className="space-y-1.5">
                  {bp.proposed.map((p, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-md border border-violet-200 bg-violet-50/40 p-2.5 text-sm">
                      <Checkbox checked={proposedOn[i] !== false} onCheckedChange={(c) => setProposedOn((s) => ({ ...s, [i]: c === true }))} className="mt-2" />
                      <span className="flex-1 space-y-1">
                        <span className="flex items-center gap-2">
                          <Input value={proposedName[i] ?? p.name} onChange={(e) => setProposedName((s) => ({ ...s, [i]: e.target.value }))} className="h-8 text-sm font-medium" disabled={proposedOn[i] === false} />
                          <Badge className="shrink-0 border-violet-200 bg-violet-100 text-[10px] text-violet-800">{t("techFn.newBadge")}</Badge>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{t(WEIGHT_KEY[p.weight] ?? "techFn.w2")}</Badge>
                        </span>
                        {p.description && <span className="block text-[11px] text-muted-foreground">{p.description}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{t("techFn.proposedHint")}</p>
              </div>
            )}

            <div className="flex items-center gap-2 border-t pt-3">
              <Button onClick={handleCreate} disabled={creating || selectedCount < 3 || !name.trim()} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("techFn.createBtn", { n: selectedCount })}
              </Button>
              <Button variant="ghost" onClick={() => setBp(null)} disabled={creating}>{t("techFn.discard")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-4 w-4 text-[#5391D5]" /> {t("techFn.libraryTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {grouped.map(([label, fns]) => (
            <div key={label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {fns.map((f) => (
                  <div key={f.ref} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-[#010131]">{f.name}</span>
                      <span className="flex items-center gap-1">
                        <Badge variant={f.source === "jd" ? "default" : "secondary"} className="text-[10px]">
                          {f.source === "jd" ? t("techFn.customBadge") : t("techFn.standardBadge")}
                        </Badge>
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{t("techFn.skillsN", { n: f.skillsEn.length })} · {f.skills.slice(0, 3).join(" · ")}…</p>
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={`/ac/tech-assessment?functionKey=${f.ref}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-accent"
                      >
                        <ExternalLink className="h-3 w-3" /> {t("techFn.run")}
                      </a>
                      {f.source === "jd" && f.id && (
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id!)}
                          disabled={creating}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" /> {t("techFn.delete")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {functions.every((f) => f.source !== "jd") && (
            <p className="flex items-center gap-2 rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
              <FileText className="ms-3 h-3.5 w-3.5" /> {t("techFn.noCustom")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
