"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Check,
  X,
  Archive,
  Pencil,
  CheckCircle2,
  Loader2,
  Target,
  Languages,
  Plus,
} from "lucide-react";
import type { BankItem, CutScore } from "@/lib/competencies/technical-item-bank";
import {
  generateDraftItemsAction,
  backfillArabicAction,
  setItemStatusAction,
  updateItemAction,
  setCutScoreAction,
  type EditItemFields,
} from "../actions";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  in_review: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  retired: "bg-slate-100 text-slate-500 border-slate-200",
};
const DIFF_TONE: Record<string, string> = {
  easy: "bg-sky-50 text-sky-700 border-sky-200",
  medium: "bg-violet-50 text-violet-700 border-violet-200",
  hard: "bg-rose-50 text-rose-700 border-rose-200",
};
const TYPE_TONE: Record<string, string> = {
  single: "bg-slate-50 text-slate-600 border-slate-200",
  multi: "bg-blue-50 text-blue-700 border-blue-200",
  scenario: "bg-violet-50 text-violet-700 border-violet-200",
  true_false: "bg-teal-50 text-teal-700 border-teal-200",
};
type ItemType = "single" | "multi" | "scenario" | "true_false";
const STATUS_ORDER = ["in_review", "draft", "approved", "rejected", "retired"];

export function ReviewConsole({
  domainKey,
  domainName,
  skills,
  items,
  cut,
  approvedHere,
  certifiableHere,
}: {
  domainKey: string;
  domainName: string;
  skills: string[];
  items: BankItem[];
  cut: CutScore;
  approvedHere: number;
  certifiableHere: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [draftCount, setDraftCount] = useState(6);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Cut-score form state
  const [passPct, setPassPct] = useState(String(cut.passPct));
  const [minItems, setMinItems] = useState(String(cut.minItems));
  const [method, setMethod] = useState(cut.method ?? "");
  const [rationale, setRationale] = useState(cut.rationale ?? "");

  const run = (fn: () => Promise<{ error?: string; ok?: boolean; inserted?: number }>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(typeof res.inserted === "number" ? `${res.inserted} ${okMsg}` : okMsg);
      router.refresh();
    });

  const sorted = [...items].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Cut-score editor */}
        <Card id="cutscores" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-rose-600" />
              {t("tech.sme.cutTitle", { domain: domainName })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("tech.sme.passMark")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={passPct}
                  onChange={(e) => setPassPct(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">{t("tech.sme.minItems")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={minItems}
                  onChange={(e) => setMinItems(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("tech.sme.method")}</Label>
              <Input
                placeholder={t("tech.sme.methodPh")}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("tech.sme.rationale")}</Label>
              <Textarea
                rows={2}
                placeholder={t("tech.sme.rationalePh")}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    setCutScoreAction({
                      domainKey,
                      passPct: Number(passPct),
                      minItems: Number(minItems),
                      method: method.trim() || null,
                      rationale: rationale.trim() || null,
                    }),
                  t("tech.sme.tCutSaved")
                )
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t("tech.sme.saveCut")}
            </Button>
          </CardContent>
        </Card>

        {/* AI draft + readiness */}
        <Card id="draft" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#5391D5]" />
              {t("tech.sme.draftTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">{t("tech.sme.draftBlurb", { domain: domainName })}</div>
            <div className="flex items-end gap-3">
              <div>
                <Label className="text-xs">{t("tech.sme.howMany")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={draftCount}
                  onChange={(e) => setDraftCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="w-24"
                />
              </div>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => generateDraftItemsAction(domainKey, draftCount), t("tech.sme.tDrafted"))}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {t("tech.sme.generate")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => backfillArabicAction(domainKey), t("tech.sme.tBackfilled"))}
                title={t("tech.sme.fillArabicHint")}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                {t("tech.sme.fillArabic")}
              </Button>
            </div>
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#010131]">{t("tech.sme.certStatus")}</span>
                {certifiableHere ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {t("tech.cmd.certifiable")}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t("tech.sme.indicativeOnly")}</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("tech.sme.certNote", { approved: approvedHere, min: cut.minItems, pct: cut.passPct })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Item list */}
      <Card id="items" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">
            {t("tech.sme.itemsTitle", { domain: domainName })}{" "}
            <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("tech.sme.noItems")}
            </p>
          )}
          {sorted.map((item) =>
            editingId === item.id ? (
              <ItemEditor
                key={item.id}
                item={item}
                skills={skills}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSave={(fields) =>
                  run(async () => {
                    const res = await updateItemAction(item.id, fields);
                    if (!("error" in res)) setEditingId(null);
                    return res;
                  }, t("tech.sme.tUpdated"))
                }
              />
            ) : (
              <ItemRow
                key={item.id}
                item={item}
                pending={pending}
                onEdit={() => setEditingId(item.id)}
                onStatus={(status) => run(() => setItemStatusAction(item.id, status), t("tech.sme.tStatusChanged"))}
              />
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemRow({
  item,
  pending,
  onEdit,
  onStatus,
}: {
  item: BankItem;
  pending: boolean;
  onEdit: () => void;
  onStatus: (status: string) => void;
}) {
  const { t } = useTranslation();
  const type = (item.question_type ?? "single") as ItemType;
  const correctSet = new Set<number>(
    type === "multi" ? (item.correct_indices ?? []) : [item.correct_index]
  );
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <Badge variant="outline" className={STATUS_TONE[item.status]}>
          {t(`tech.sme.status.${item.status}`)}
        </Badge>
        <Badge variant="outline" className={TYPE_TONE[type] ?? TYPE_TONE.single}>
          {t(`tech.sme.type.${type}`)}
        </Badge>
        <Badge variant="outline" className={DIFF_TONE[item.difficulty]}>
          {t(`tech.sme.diff.${item.difficulty}`)}
        </Badge>
        <span className="text-xs text-muted-foreground">{item.skill}</span>
        {item.source === "ai_generated" && (
          <span className="text-[10px] text-muted-foreground/70">· {t("tech.sme.aiDraft")}</span>
        )}
        {item.reviewer_name && (
          <span className="text-[10px] text-muted-foreground/70">· {t("tech.sme.reviewedBy", { name: item.reviewer_name })}</span>
        )}
      </div>

      {type === "scenario" && item.scenario_en && (
        <p className="mb-1.5 rounded-md border-s-2 border-violet-300 bg-violet-50/40 px-3 py-2 text-xs leading-relaxed text-slate-700">
          {item.scenario_en}
        </p>
      )}
      <p className="text-sm font-medium text-[#010131]">{item.question_en}</p>
      <ul className="mt-1.5 space-y-1">
        {item.options_en.map((o, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-xs ${
              correctSet.has(i) ? "text-emerald-700 font-medium" : "text-muted-foreground"
            }`}
          >
            {correctSet.has(i) ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/30 mt-0.5" />
            )}
            <span>{o}</span>
          </li>
        ))}
      </ul>
      {item.explanation_en && (
        <p className="mt-1.5 text-[11px] text-muted-foreground italic">{t("tech.sme.rationaleLabel")} {item.explanation_en}</p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        {item.status !== "approved" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200" disabled={pending} onClick={() => onStatus("approved")}>
            <Check className="h-3.5 w-3.5" /> {t("tech.sme.approve")}
          </Button>
        )}
        {item.status !== "rejected" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-rose-700 border-rose-200" disabled={pending} onClick={() => onStatus("rejected")}>
            <X className="h-3.5 w-3.5" /> {t("tech.sme.reject")}
          </Button>
        )}
        {item.status === "approved" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-slate-600" disabled={pending} onClick={() => onStatus("retired")}>
            <Archive className="h-3.5 w-3.5" /> {t("tech.sme.retire")}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={pending} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> {t("tech.sme.edit")}
        </Button>
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  skills,
  pending,
  onCancel,
  onSave,
}: {
  item: BankItem;
  skills: string[];
  pending: boolean;
  onCancel: () => void;
  onSave: (fields: EditItemFields) => void;
}) {
  const { t } = useTranslation();
  const initialType = (item.question_type ?? "single") as ItemType;
  const [qType, setQType] = useState<ItemType>(initialType);
  const [question, setQuestion] = useState(item.question_en);
  const [scenario, setScenario] = useState(item.scenario_en ?? "");
  const [options, setOptions] = useState<string[]>(() => {
    if (initialType === "true_false") {
      return item.options_en.length === 2 ? item.options_en : [t("tech.sme.optTrue"), t("tech.sme.optFalse")];
    }
    const base = item.options_en.slice(0, 6);
    while (base.length < 4) base.push("");
    return base;
  });
  const [correct, setCorrect] = useState<Set<number>>(
    () => new Set<number>(initialType === "multi" ? item.correct_indices ?? [] : [item.correct_index])
  );
  const [skill, setSkill] = useState(item.skill);
  const [difficulty, setDifficulty] = useState(item.difficulty);
  const [explanation, setExplanation] = useState(item.explanation_en ?? "");

  const multi = qType === "multi";

  function changeType(next: ItemType) {
    setQType(next);
    setOptions((prev) => {
      if (next === "true_false") return [t("tech.sme.optTrue"), t("tech.sme.optFalse")];
      const arr = prev.slice(0, 6);
      while (arr.length < 4) arr.push("");
      return next === "multi" ? arr : arr.slice(0, 4);
    });
    setCorrect((prev) => {
      const arr = [...prev].sort((a, b) => a - b);
      if (next === "multi") return new Set(arr);
      if (next === "true_false") return new Set([arr[0] === 1 ? 1 : 0]);
      return new Set([arr.find((n) => n < 4) ?? 0]); // single / scenario — one correct, < 4
    });
  }

  const toggleCorrect = (i: number) =>
    setCorrect((prev) => {
      if (!multi) return new Set([i]);
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const addOption = () => setOptions((o) => (o.length < 6 ? [...o, ""] : o));
  const removeOption = (i: number) =>
    setOptions((o) => {
      if (o.length <= 4) return o;
      setCorrect((c) => new Set([...c].filter((n) => n !== i).map((n) => (n > i ? n - 1 : n))));
      return o.filter((_, j) => j !== i);
    });

  const valid = (() => {
    if (!question.trim() || options.some((o) => !o.trim())) return false;
    if (qType === "multi") return options.length >= 4 && options.length <= 6 && correct.size >= 2 && correct.size < options.length;
    if (qType === "true_false") return options.length === 2 && correct.size === 1;
    if (qType === "scenario") return options.length === 4 && correct.size === 1 && !!scenario.trim();
    return options.length === 4 && correct.size === 1;
  })();

  return (
    <div className="rounded-md border border-rose-200 bg-rose-50/30 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t("tech.sme.itemType")}</Label>
          <Select value={qType} onValueChange={(v) => changeType(v as ItemType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t("tech.sme.type.single")}</SelectItem>
              <SelectItem value="multi">{t("tech.sme.type.multi")}</SelectItem>
              <SelectItem value="scenario">{t("tech.sme.type.scenario")}</SelectItem>
              <SelectItem value="true_false">{t("tech.sme.type.true_false")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {qType === "scenario" && (
        <div>
          <Label className="text-xs">{t("tech.sme.scenarioLabel")}</Label>
          <Textarea rows={2} placeholder={t("tech.sme.scenarioPh")} value={scenario} onChange={(e) => setScenario(e.target.value)} />
        </div>
      )}
      <div>
        <Label className="text-xs">{t("tech.sme.question")}</Label>
        <Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">{t("tech.sme.optionsLabel")}</Label>
        {multi && <p className="text-[11px] text-[#2b6cb0]">{t("tech.sme.selectAllHint")}</p>}
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(i)}
              className={`h-4 w-4 shrink-0 border-2 ${multi ? "rounded-[3px]" : "rounded-full"} ${
                correct.has(i) ? "border-emerald-600 bg-emerald-500" : "border-muted-foreground/40"
              }`}
              aria-label={t("tech.sme.markCorrect", { n: i + 1 })}
            />
            <Input
              value={o}
              onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
            />
            {multi && options.length > 4 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                aria-label={t("tech.sme.removeOption")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {multi && options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> {t("tech.sme.addOption")}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t("tech.sme.skill")}</Label>
          <Select value={skill} onValueChange={setSkill}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {skills.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("tech.sme.difficulty")}</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">{t("tech.sme.diff.easy")}</SelectItem>
              <SelectItem value="medium">{t("tech.sme.diff.medium")}</SelectItem>
              <SelectItem value="hard">{t("tech.sme.diff.hard")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">{t("tech.sme.rationaleLabel")}</Label>
        <Textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !valid}
          onClick={() => {
            const sortedCorrect = [...correct].sort((a, b) => a - b);
            onSave({
              question_type: qType,
              question_en: question.trim(),
              scenario_en: qType === "scenario" ? scenario.trim() || null : null,
              options_en: options.map((o) => o.trim()),
              correct_index: sortedCorrect[0] ?? 0,
              correct_indices: qType === "multi" ? sortedCorrect : null,
              skill,
              difficulty,
              explanation_en: explanation.trim() || null,
            });
          }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("tech.bridge.save")}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          {t("tech.bridge.cancel")}
        </Button>
      </div>
    </div>
  );
}
