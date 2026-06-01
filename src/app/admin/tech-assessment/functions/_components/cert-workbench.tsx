"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ShieldCheck, AlertCircle, Check, X, Archive, ChevronDown, Gauge } from "lucide-react";
import type { BankItem } from "@/lib/competencies/technical-item-bank";
import type { FunctionReadiness, FunctionCutScore } from "@/lib/competencies/technical-function-bank";
import {
  draftFunctionSkillItemsAction,
  setFunctionItemStatusAction,
  setFunctionCutScoreAction,
  calibrateFunctionBankAction,
} from "../cert-actions";

type Fn = { ref: string; id: string | null; name: string; skillsEn: string[]; skills: string[] };

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-800 border-amber-300",
  rejected: "bg-rose-100 text-rose-800 border-rose-300",
  retired: "bg-slate-200 text-slate-500 border-slate-300",
};

const DRAFT_COUNT = 4;

export function CertWorkbench({
  fn,
  readiness,
  items,
  cut,
  aiOn,
}: {
  fn: Fn;
  readiness: FunctionReadiness;
  items: BankItem[];
  cut: FunctionCutScore;
  aiOn: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [passPct, setPassPct] = useState(String(cut.passPct));
  const [minPer, setMinPer] = useState(String(cut.minItemsPerSkill));
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const [draftingSkill, setDraftingSkill] = useState<string | null>(null);

  const skillLabel = (en: string) => {
    const i = fn.skillsEn.indexOf(en);
    return i >= 0 ? fn.skills[i] : en;
  };
  const approvedBySkill = useMemo(
    () => new Map(readiness.perSkill.map((p) => [p.skill, p.approved])),
    [readiness]
  );
  const itemsBySkill = useMemo(() => {
    const m = new Map<string, BankItem[]>();
    for (const s of fn.skillsEn) m.set(s, []);
    for (const it of items) if (m.has(it.skill)) m.get(it.skill)!.push(it);
    return m;
  }, [items, fn.skillsEn]);

  const run = (fn2: () => Promise<{ error?: string } | { ok: true } | { ok: true; inserted: number }>, okMsg?: string) =>
    startTransition(async () => {
      const res = await fn2();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });

  const draftSkill = (skill: string) => {
    setDraftingSkill(skill);
    startTransition(async () => {
      const res = await draftFunctionSkillItemsAction({ ref: fn.ref, skill, count: DRAFT_COUNT, context: fn.name });
      setDraftingSkill(null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("techFn.cert.drafted", { n: res.inserted }));
      setOpenSkill(skill);
      router.refresh();
    });
  };

  const setStatus = (itemId: string, status: string) =>
    run(() => setFunctionItemStatusAction({ ref: fn.ref, itemId, status }));

  const saveCut = () => {
    if (!fn.id) {
      toast.error(t("techFn.cert.needFnId"));
      return;
    }
    run(
      () =>
        setFunctionCutScoreAction({
          ref: fn.ref,
          functionId: fn.id!,
          passPct: Number(passPct),
          minItemsPerSkill: Number(minPer),
        }),
      t("techFn.cert.cutSaved")
    );
  };

  return (
    <div className="space-y-5">
      {/* Readiness summary + passing standard */}
      <Card className={readiness.certifiable ? "border-emerald-300" : ""}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className={`h-4 w-4 ${readiness.certifiable ? "text-emerald-600" : "text-slate-400"}`} />
              {t("techFn.cert.cutTitle")}
            </CardTitle>
            {readiness.certifiable ? (
              <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">{t("techFn.cert.certifiable")}</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" /> {t("techFn.cert.notYet")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t("techFn.cert.certIntro")}</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-28 space-y-1.5">
            <Label className="text-xs">{t("techFn.cert.passPct")}</Label>
            <Input type="number" min={1} max={100} value={passPct} onChange={(e) => setPassPct(e.target.value)} />
          </div>
          <div className="w-44 space-y-1.5">
            <Label className="text-xs">{t("techFn.cert.minPerSkill")}</Label>
            <Input type="number" min={1} max={20} value={minPer} onChange={(e) => setMinPer(e.target.value)} />
          </div>
          <Button onClick={saveCut} disabled={pending} variant="outline" className="gap-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("techFn.cert.saveCut")}
          </Button>
          <Button
            onClick={() =>
              run(() => calibrateFunctionBankAction({ ref: fn.ref, skills: fn.skillsEn }), t("techFn.cert.calibrated"))
            }
            disabled={pending}
            variant="ghost"
            className="gap-1.5"
            title={t("techFn.cert.calibrateHint")}
          >
            <Gauge className="h-4 w-4" /> {t("techFn.cert.calibrate")}
          </Button>
          {!aiOn && <span className="text-xs text-amber-700">{t("techFn.aiOff")}</span>}
        </CardContent>
      </Card>

      {/* Per-skill bank */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("techFn.cert.certTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fn.skillsEn.map((skill) => {
            const approved = approvedBySkill.get(skill) ?? 0;
            const ok = approved >= readiness.minItemsPerSkill;
            const skillItems = itemsBySkill.get(skill) ?? [];
            const isOpen = openSkill === skill;
            return (
              <div key={skill} className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpenSkill(isOpen ? null : skill)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#010131]"
                  >
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    {skillLabel(skill)}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {t("techFn.cert.skillFloor", { approved, min: readiness.minItemsPerSkill })}
                    </span>
                    {skillItems.length > 0 && (
                      <span className="text-[10px] text-slate-400">· {skillItems.length} total</span>
                    )}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5"
                    disabled={!aiOn || pending}
                    onClick={() => draftSkill(skill)}
                  >
                    {draftingSkill === skill ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {draftingSkill === skill ? t("techFn.cert.drafting") : t("techFn.cert.draftItems", { n: DRAFT_COUNT })}
                  </Button>
                </div>

                {isOpen && (
                  <div className="space-y-2 border-t bg-muted/20 p-3">
                    {skillItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("techFn.cert.noItems")}</p>
                    ) : (
                      skillItems.map((it) => (
                        <div key={it.id} className="rounded-md border bg-white p-3">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[it.status] ?? ""}`}>
                              {t(`techFn.cert.st.${it.status}`)}
                            </Badge>
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">{t(`tech.sme.diff.${it.difficulty}`)}</span>
                            {it.irt_b != null && (
                              <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600" title="Rasch difficulty (logit)">
                                b={Number(it.irt_b).toFixed(1)}
                              </span>
                            )}
                            {!it.question_ar && <span className="text-[10px] text-amber-600">EN only</span>}
                          </div>
                          <p className="text-sm font-medium text-[#010131]">{it.question_en}</p>
                          <ul className="mt-1.5 space-y-0.5">
                            {it.options_en.map((opt, oi) => (
                              <li key={oi} className={`text-[12px] ${oi === it.correct_index ? "font-semibold text-emerald-700" : "text-slate-600"}`}>
                                {oi === it.correct_index ? "✓ " : "• "}{opt}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {it.status !== "approved" && (
                              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-emerald-700" disabled={pending} onClick={() => setStatus(it.id, "approved")}>
                                <Check className="h-3 w-3" /> {t("techFn.cert.approve")}
                              </Button>
                            )}
                            {it.status !== "rejected" && (
                              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-rose-600" disabled={pending} onClick={() => setStatus(it.id, "rejected")}>
                                <X className="h-3 w-3" /> {t("techFn.cert.reject")}
                              </Button>
                            )}
                            {it.status === "approved" && (
                              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-slate-500" disabled={pending} onClick={() => setStatus(it.id, "retired")}>
                                <Archive className="h-3 w-3" /> {t("techFn.cert.retire")}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
