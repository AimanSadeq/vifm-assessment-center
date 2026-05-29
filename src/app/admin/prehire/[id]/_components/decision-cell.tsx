"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { setPrehireDecisionAction } from "../../actions";
import type { PrehireDecision } from "@/types/prehire";

const OPTIONS: { value: PrehireDecision; label: string }[] = [
  { value: "advanced", label: "Advance" },
  { value: "rejected", label: "Reject" },
  { value: "hold", label: "Hold" },
  { value: "withdrawn", label: "Withdrawn" },
];

const TONE: Record<PrehireDecision, string> = {
  advanced: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  hold: "bg-amber-100 text-amber-800 border-amber-200",
  withdrawn: "bg-slate-100 text-slate-600 border-slate-200",
};
const LABEL: Record<PrehireDecision, string> = {
  advanced: "Advanced",
  rejected: "Rejected",
  hold: "On hold",
  withdrawn: "Withdrawn",
};

/**
 * Captures the HUMAN hiring decision (distinct from the AI recommendation).
 * A job-related reason is encouraged for defensibility; the decision + reason +
 * actor + timestamp are persisted and written to the immutable audit trail.
 */
export function DecisionCell({
  candidateId,
  decision,
}: {
  candidateId: string;
  decision: PrehireDecision | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(decision == null);
  const [value, setValue] = useState<PrehireDecision | "">(decision ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value) return;
    setSaving(true);
    const res = await setPrehireDecisionAction({ candidateId, decision: value, reason: reason || undefined });
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Decision recorded.");
    setEditing(false);
    setReason("");
    router.refresh();
  };

  if (!editing && decision) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[decision]}`}>
          {LABEL[decision]}
        </span>
        <button
          onClick={() => { setValue(decision); setEditing(true); }}
          className="text-muted-foreground hover:text-foreground"
          title="Change decision"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as PrehireDecision | "")}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
      >
        <option value="">— Decide —</option>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {value && (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Job-related reason (recommended)"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-6 gap-1 px-2 text-xs" onClick={save} disabled={saving}>
              <Check className="h-3 w-3" /> {saving ? "Saving…" : "Save"}
            </Button>
            {decision && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => { setEditing(false); setValue(decision); setReason(""); }}
              >
                <X className="h-3 w-3" /> Cancel
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
