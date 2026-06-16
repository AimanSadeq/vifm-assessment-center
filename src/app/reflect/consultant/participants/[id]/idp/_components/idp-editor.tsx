"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Save, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertReflectIdp,
  signOffReflectIdp,
  type IdpAction,
  type IdpPriority,
  type ReflectIdpStatus,
} from "@/lib/reflect/idp-actions";
import { cn } from "@/lib/utils";

type CompetencyOption = {
  id: string;
  name_en: string;
  name_ar: string | null;
  display_order: number;
};

type Props = {
  participantId: string;
  competencies: CompetencyOption[];
  initial: {
    top_priorities: IdpPriority[];
    action_plan: IdpAction[];
    success_measures: string;
    target_review_date: string;
    status: ReflectIdpStatus;
    signed_off_at: string | null;
  };
};

const STATUS_ORDER: ReflectIdpStatus[] = [
  "draft",
  "agreed",
  "in_progress",
  "reviewed",
  "closed",
];

const STATUS_TONE: Record<ReflectIdpStatus, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  agreed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-sky-50 text-sky-700 border-sky-200",
  reviewed: "bg-violet-50 text-violet-700 border-violet-200",
  closed: "bg-muted text-muted-foreground border-border",
};

export function IdpEditor({ participantId, competencies, initial }: Props) {
  const { t } = useTranslation();
  const statusLabel = (s: ReflectIdpStatus): string => t(`reflectAdmin.idp.status.${s}`);
  const [priorities, setPriorities] = useState<IdpPriority[]>(
    initial.top_priorities.length > 0
      ? initial.top_priorities
      : [makeEmptyPriority(), makeEmptyPriority(), makeEmptyPriority()]
  );
  const [actions, setActions] = useState<IdpAction[]>(initial.action_plan);
  const [successMeasures, setSuccessMeasures] = useState(initial.success_measures);
  const [targetReview, setTargetReview] = useState(initial.target_review_date);
  const [status, setStatus] = useState<ReflectIdpStatus>(initial.status);
  const [signedOffAt, setSignedOffAt] = useState<string | null>(initial.signed_off_at);
  const [saveMessage, setSaveMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (newStatus?: ReflectIdpStatus) => {
    setSaveMessage(null);
    startTransition(async () => {
      // Strip empty priorities - anything where competency_name + why are both blank
      const cleanedPriorities = priorities
        .filter((p) => p.competency_name.trim() || p.why.trim())
        .map((p) => ({
          ...p,
          target_behaviors: p.target_behaviors.filter((b) => b.trim().length > 0),
        }));
      const cleanedActions = actions.filter((a) => a.action.trim().length > 0);

      const res = await upsertReflectIdp({
        participant_id: participantId,
        top_priorities: cleanedPriorities,
        action_plan: cleanedActions,
        success_measures: successMeasures.trim() ? successMeasures.trim() : null,
        target_review_date: targetReview || null,
        status: newStatus ?? status,
      });
      if (!res.ok) {
        setSaveMessage({ kind: "err", text: res.error ?? t("reflectAdmin.idp.saveFailed") });
        return;
      }
      if (newStatus) setStatus(newStatus);
      setSaveMessage({ kind: "ok", text: t("reflectAdmin.idp.saved") });
    });
  };

  const signOff = () => {
    setSaveMessage(null);
    startTransition(async () => {
      // Save current state first so the agreed version is what we expected
      await save();
      const res = await signOffReflectIdp(participantId);
      if (!res.ok) {
        setSaveMessage({ kind: "err", text: res.error ?? t("reflectAdmin.idp.signOffFailed") });
        return;
      }
      setStatus("agreed");
      setSignedOffAt(new Date().toISOString());
      setSaveMessage({ kind: "ok", text: t("reflectAdmin.idp.signedOff") });
    });
  };

  const updatePriority = (i: number, patch: Partial<IdpPriority>) => {
    setPriorities((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const removePriority = (i: number) =>
    setPriorities((prev) => prev.filter((_, idx) => idx !== i));
  const addPriority = () => setPriorities((prev) => [...prev, makeEmptyPriority()]);

  const updateAction = (i: number, patch: Partial<IdpAction>) => {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };
  const removeAction = (i: number) => setActions((prev) => prev.filter((_, idx) => idx !== i));
  const addAction = () =>
    setActions((prev) => [...prev, { action: "", owner: "", deadline: null, support: "" }]);

  return (
    <div className="space-y-8">
      {/* Status header */}
      <section className="rounded-lg border bg-card p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
            {t("reflectAdmin.idp.heading")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("reflectAdmin.idp.headingCaption")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              STATUS_TONE[status]
            )}
          >
            {statusLabel(status)}
            {signedOffAt && status === "agreed" && (
              <span className="text-[10px] opacity-80">
                · {fmtDate(signedOffAt)}
              </span>
            )}
          </span>
        </div>
      </section>

      {/* Top priorities */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{t("reflectAdmin.idp.priorities.heading")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("reflectAdmin.idp.priorities.caption")}
          </p>
        </div>
        {priorities.map((p, i) => (
          <div key={i} className="rounded-md border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                {t("reflectAdmin.idp.priorities.itemLabel", { n: i + 1 })}
              </span>
              <button
                type="button"
                onClick={() => removePriority(i)}
                className="text-muted-foreground hover:text-rose-700 transition-colors"
                title={t("reflectAdmin.idp.priorities.remove")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>{t("reflectAdmin.idp.priorities.competency")}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={p.competency_id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const name = id
                      ? competencies.find((c) => c.id === id)?.name_en ?? ""
                      : p.competency_name;
                    updatePriority(i, { competency_id: id, competency_name: name });
                  }}
                >
                  <option value="">{t("reflectAdmin.idp.priorities.freeTextOption")}</option>
                  {competencies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("reflectAdmin.idp.priorities.customName")}</Label>
                <Input
                  value={p.competency_name}
                  onChange={(e) =>
                    updatePriority(i, { competency_name: e.target.value, competency_id: null })
                  }
                  placeholder={t("reflectAdmin.idp.priorities.customNamePlaceholder")}
                />
              </div>
            </div>
            <div>
              <Label>{t("reflectAdmin.idp.priorities.why")}</Label>
              <Textarea
                rows={2}
                placeholder={t("reflectAdmin.idp.priorities.whyPlaceholder")}
                value={p.why}
                onChange={(e) => updatePriority(i, { why: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("reflectAdmin.idp.priorities.targetBehaviours")} <span className="text-muted-foreground">{t("reflectAdmin.idp.priorities.onePerLine")}</span></Label>
              <Textarea
                rows={3}
                placeholder={t("reflectAdmin.idp.priorities.targetBehavioursPlaceholder")}
                value={p.target_behaviors.join("\n")}
                onChange={(e) =>
                  updatePriority(i, {
                    target_behaviors: e.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter((line) => line.length > 0),
                  })
                }
              />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addPriority} className="text-xs">
          <Plus className="h-3.5 w-3.5 me-1" /> {t("reflectAdmin.idp.priorities.add")}
        </Button>
      </section>

      {/* Action plan */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{t("reflectAdmin.idp.actions.heading")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("reflectAdmin.idp.actions.caption")}
          </p>
        </div>
        {actions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{t("reflectAdmin.idp.actions.empty")}</p>
        )}
        {actions.map((a, i) => (
          <div key={i} className="rounded-md border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                {t("reflectAdmin.idp.actions.itemLabel", { n: i + 1 })}
              </span>
              <button
                type="button"
                onClick={() => removeAction(i)}
                className="text-muted-foreground hover:text-rose-700 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <Label>{t("reflectAdmin.idp.actions.action")}</Label>
              <Textarea
                rows={2}
                placeholder={t("reflectAdmin.idp.actions.actionPlaceholder")}
                value={a.action}
                onChange={(e) => updateAction(i, { action: e.target.value })}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>{t("reflectAdmin.idp.actions.owner")}</Label>
                <Input
                  value={a.owner}
                  placeholder={t("reflectAdmin.idp.actions.ownerPlaceholder")}
                  onChange={(e) => updateAction(i, { owner: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("reflectAdmin.idp.actions.deadline")}</Label>
                <Input
                  type="date"
                  value={a.deadline ?? ""}
                  onChange={(e) => updateAction(i, { deadline: e.target.value || null })}
                />
              </div>
              <div>
                <Label>{t("reflectAdmin.idp.actions.support")}</Label>
                <Input
                  value={a.support}
                  placeholder={t("reflectAdmin.idp.actions.supportPlaceholder")}
                  onChange={(e) => updateAction(i, { support: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addAction} className="text-xs">
          <Plus className="h-3.5 w-3.5 me-1" /> {t("reflectAdmin.idp.actions.add")}
        </Button>
      </section>

      {/* Success measures + review */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{t("reflectAdmin.idp.review.heading")}</h3>
        </div>
        <div>
          <Label>{t("reflectAdmin.idp.review.successQuestion")}</Label>
          <Textarea
            rows={3}
            placeholder={t("reflectAdmin.idp.review.successPlaceholder")}
            value={successMeasures}
            onChange={(e) => setSuccessMeasures(e.target.value)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>{t("reflectAdmin.idp.review.targetReviewDate")}</Label>
            <Input
              type="date"
              value={targetReview}
              onChange={(e) => setTargetReview(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("reflectAdmin.idp.review.statusLabel")}</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as ReflectIdpStatus)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Save + sign off */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs">
          {saveMessage?.kind === "ok" && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {saveMessage.text}
            </span>
          )}
          {saveMessage?.kind === "err" && (
            <span className="inline-flex items-center gap-1.5 text-rose-700">
              <AlertCircle className="h-3.5 w-3.5" />
              {saveMessage.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => save()} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
            {t("reflectAdmin.idp.saveDraft")}
          </Button>
          <Button
            type="button"
            onClick={signOff}
            disabled={pending || status === "agreed" || status === "closed"}
            title={status === "agreed" ? t("reflectAdmin.idp.alreadySignedOff") : t("reflectAdmin.idp.signOffAgreed")}
          >
            <CheckCircle2 className="h-4 w-4 me-2" />
            {t("reflectAdmin.idp.signOffAgreed")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function makeEmptyPriority(): IdpPriority {
  return {
    competency_id: null,
    competency_name: "",
    why: "",
    target_behaviors: [],
  };
}
