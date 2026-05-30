"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import type { BankItem, CutScore } from "@/lib/competencies/technical-item-bank";
import {
  generateDraftItemsAction,
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-rose-600" />
              Cut-score — {domainName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Pass mark (%)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={passPct}
                  onChange={(e) => setPassPct(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Min approved items</Label>
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
              <Label className="text-xs">Standard-setting method</Label>
              <Input
                placeholder="e.g. Modified Angoff, 3-SME panel"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Rationale (for the audit file)</Label>
              <Textarea
                rows={2}
                placeholder="Why this standard is defensible for this domain…"
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
                  "Cut-score saved"
                )
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save cut-score
            </Button>
          </CardContent>
        </Card>

        {/* AI draft + readiness */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#5391D5]" />
              Draft items with AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate candidate items for <strong>{domainName}</strong>. They land as{" "}
              <Badge variant="secondary" className="text-[10px]">
                draft
              </Badge>{" "}
              for your review — nothing is administered until you approve it.
            </p>
            <div className="flex items-end gap-3">
              <div>
                <Label className="text-xs">How many</Label>
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
                onClick={() => run(() => generateDraftItemsAction(domainKey, draftCount), "items drafted")}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate drafts
              </Button>
            </div>
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#010131]">Certification status</span>
                {certifiableHere ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Certifiable
                  </Badge>
                ) : (
                  <Badge variant="secondary">Indicative only</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {approvedHere} approved · needs {cut.minItems} to certify ({cut.passPct}% to pass).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Item list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Items — {domainName}{" "}
            <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No items yet. Use “Generate drafts” above to seed the bank, then review each one.
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
                  }, "Item updated")
                }
              />
            ) : (
              <ItemRow
                key={item.id}
                item={item}
                pending={pending}
                onEdit={() => setEditingId(item.id)}
                onStatus={(status) => run(() => setItemStatusAction(item.id, status), `Item ${status}`)}
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
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <Badge variant="outline" className={STATUS_TONE[item.status]}>
          {item.status.replace("_", " ")}
        </Badge>
        <Badge variant="outline" className={DIFF_TONE[item.difficulty]}>
          {item.difficulty}
        </Badge>
        <span className="text-xs text-muted-foreground">{item.skill}</span>
        {item.source === "ai_generated" && (
          <span className="text-[10px] text-muted-foreground/70">· AI draft</span>
        )}
        {item.reviewer_name && (
          <span className="text-[10px] text-muted-foreground/70">· reviewed by {item.reviewer_name}</span>
        )}
      </div>

      <p className="text-sm font-medium text-[#010131]">{item.question_en}</p>
      <ul className="mt-1.5 space-y-1">
        {item.options_en.map((o, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-xs ${
              i === item.correct_index ? "text-emerald-700 font-medium" : "text-muted-foreground"
            }`}
          >
            {i === item.correct_index ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/30 mt-0.5" />
            )}
            <span>{o}</span>
          </li>
        ))}
      </ul>
      {item.explanation_en && (
        <p className="mt-1.5 text-[11px] text-muted-foreground italic">Rationale: {item.explanation_en}</p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        {item.status !== "approved" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200" disabled={pending} onClick={() => onStatus("approved")}>
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        )}
        {item.status !== "rejected" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-rose-700 border-rose-200" disabled={pending} onClick={() => onStatus("rejected")}>
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        )}
        {item.status === "approved" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-slate-600" disabled={pending} onClick={() => onStatus("retired")}>
            <Archive className="h-3.5 w-3.5" /> Retire
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={pending} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit
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
  const [question, setQuestion] = useState(item.question_en);
  const [options, setOptions] = useState<string[]>(
    item.options_en.length === 4 ? item.options_en : [...item.options_en, "", "", "", ""].slice(0, 4)
  );
  const [correct, setCorrect] = useState(item.correct_index);
  const [skill, setSkill] = useState(item.skill);
  const [difficulty, setDifficulty] = useState(item.difficulty);
  const [explanation, setExplanation] = useState(item.explanation_en ?? "");

  return (
    <div className="rounded-md border border-rose-200 bg-rose-50/30 p-3 space-y-3">
      <div>
        <Label className="text-xs">Question</Label>
        <Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Options (select the correct one)</Label>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrect(i)}
              className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                i === correct ? "border-emerald-600 bg-emerald-500" : "border-muted-foreground/40"
              }`}
              aria-label={`Mark option ${i + 1} correct`}
            />
            <Input
              value={o}
              onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Skill</Label>
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
          <Label className="text-xs">Difficulty</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">easy</SelectItem>
              <SelectItem value="medium">medium</SelectItem>
              <SelectItem value="hard">hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Rationale</Label>
        <Textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            onSave({
              question_en: question.trim(),
              options_en: options.map((o) => o.trim()),
              correct_index: correct,
              skill,
              difficulty,
              explanation_en: explanation.trim() || null,
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
