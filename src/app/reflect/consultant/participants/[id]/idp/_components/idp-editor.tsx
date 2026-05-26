"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
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

const STATUS_LABEL: Record<ReflectIdpStatus, string> = {
  draft: "Draft",
  agreed: "Agreed",
  in_progress: "In progress",
  reviewed: "Reviewed",
  closed: "Closed",
};

const STATUS_TONE: Record<ReflectIdpStatus, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  agreed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-sky-50 text-sky-700 border-sky-200",
  reviewed: "bg-violet-50 text-violet-700 border-violet-200",
  closed: "bg-muted text-muted-foreground border-border",
};

export function IdpEditor({ participantId, competencies, initial }: Props) {
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
        setSaveMessage({ kind: "err", text: res.error ?? "Save failed" });
        return;
      }
      if (newStatus) setStatus(newStatus);
      setSaveMessage({ kind: "ok", text: "Saved" });
    });
  };

  const signOff = () => {
    setSaveMessage(null);
    startTransition(async () => {
      // Save current state first so the agreed version is what we expected
      await save();
      const res = await signOffReflectIdp(participantId);
      if (!res.ok) {
        setSaveMessage({ kind: "err", text: res.error ?? "Sign-off failed" });
        return;
      }
      setStatus("agreed");
      setSignedOffAt(new Date().toISOString());
      setSaveMessage({ kind: "ok", text: "IDP signed off" });
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
            Individual Development Plan
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Captured during the post-360 debrief session. Saves anonymously to the audit trail.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              STATUS_TONE[status]
            )}
          >
            {STATUS_LABEL[status]}
            {signedOffAt && status === "agreed" && (
              <span className="text-[10px] opacity-80">
                · {new Date(signedOffAt).toLocaleDateString()}
              </span>
            )}
          </span>
        </div>
      </section>

      {/* Top priorities */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">Top development priorities</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Lock in the 2–3 priorities the participant will work on between now and the review date. Keep it tight: focus beats breadth.
          </p>
        </div>
        {priorities.map((p, i) => (
          <div key={i} className="rounded-md border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Priority {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removePriority(i)}
                className="text-muted-foreground hover:text-rose-700 transition-colors"
                title="Remove priority"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Competency</Label>
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
                  <option value="">- or type free text below -</option>
                  {competencies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Custom competency name (free text)</Label>
                <Input
                  value={p.competency_name}
                  onChange={(e) =>
                    updatePriority(i, { competency_name: e.target.value, competency_id: null })
                  }
                  placeholder="e.g. Strategic Thinking"
                />
              </div>
            </div>
            <div>
              <Label>Why this priority?</Label>
              <Textarea
                rows={2}
                placeholder="What does the 360 say? What changes if this is closed?"
                value={p.why}
                onChange={(e) => updatePriority(i, { why: e.target.value })}
              />
            </div>
            <div>
              <Label>Target behaviours <span className="text-muted-foreground">(one per line)</span></Label>
              <Textarea
                rows={3}
                placeholder={"Behaviour to start doing more / better\nAnother behaviour …"}
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
          <Plus className="h-3.5 w-3.5 me-1" /> Add priority
        </Button>
      </section>

      {/* Action plan */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">Action plan</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Specific actions that lead toward the priorities above. Each gets an owner, a deadline, and the support needed.
          </p>
        </div>
        {actions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No actions yet.</p>
        )}
        {actions.map((a, i) => (
          <div key={i} className="rounded-md border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Action {i + 1}
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
              <Label>Action</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Shadow the Head of Strategy on the Q3 planning cycle"
                value={a.action}
                onChange={(e) => updateAction(i, { action: e.target.value })}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Owner</Label>
                <Input
                  value={a.owner}
                  placeholder="Self / Manager / VIFM coach"
                  onChange={(e) => updateAction(i, { owner: e.target.value })}
                />
              </div>
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={a.deadline ?? ""}
                  onChange={(e) => updateAction(i, { deadline: e.target.value || null })}
                />
              </div>
              <div>
                <Label>Support needed</Label>
                <Input
                  value={a.support}
                  placeholder="e.g. Calendar access · stretch budget"
                  onChange={(e) => updateAction(i, { support: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addAction} className="text-xs">
          <Plus className="h-3.5 w-3.5 me-1" /> Add action
        </Button>
      </section>

      {/* Success measures + review */}
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-primary">Success measures &amp; review</h3>
        </div>
        <div>
          <Label>How will success be measured?</Label>
          <Textarea
            rows={3}
            placeholder="Observable changes · stakeholder feedback · KPIs · the next 360 cycle …"
            value={successMeasures}
            onChange={(e) => setSuccessMeasures(e.target.value)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Target review date</Label>
            <Input
              type="date"
              value={targetReview}
              onChange={(e) => setTargetReview(e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as ReflectIdpStatus)}
            >
              {(["draft", "agreed", "in_progress", "reviewed", "closed"] as ReflectIdpStatus[]).map(
                (s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                )
              )}
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
            Save draft
          </Button>
          <Button
            type="button"
            onClick={signOff}
            disabled={pending || status === "agreed" || status === "closed"}
            title={status === "agreed" ? "Already signed off" : "Sign off as agreed"}
          >
            <CheckCircle2 className="h-4 w-4 me-2" />
            Sign off as agreed
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
