"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Calendar, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { updateReflectDebrief } from "@/lib/reflect/idp-actions";
import { cn } from "@/lib/utils";

type DebriefStatus = "not_scheduled" | "scheduled" | "completed" | "no_show";

const STATUS_LABEL: Record<DebriefStatus, string> = {
  not_scheduled: "Not scheduled",
  scheduled: "Scheduled",
  completed: "Completed",
  no_show: "No-show",
};

const STATUS_TONE: Record<DebriefStatus, string> = {
  not_scheduled: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
};

type Props = {
  participantId: string;
  initialStatus: DebriefStatus;
  initialScheduledAt: string | null;
};

export function DebriefRowActions({
  participantId,
  initialStatus,
  initialScheduledAt,
}: Props) {
  const [status, setStatus] = useState<DebriefStatus>(initialStatus);
  // ISO timestamp → YYYY-MM-DD for the date input
  const initialDate = initialScheduledAt ? initialScheduledAt.slice(0, 10) : "";
  const [scheduledDate, setScheduledDate] = useState<string>(initialDate);
  const [feedback, setFeedback] = useState<"saving" | "saved" | "err" | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (patch: { status?: DebriefStatus; scheduled?: string | null }) => {
    setFeedback("saving");
    setErrMsg(null);
    const next: DebriefStatus = patch.status ?? status;
    const nextDateRaw = patch.scheduled !== undefined ? patch.scheduled : scheduledDate;
    // Convert YYYY-MM-DD → midnight UTC ISO
    const nextIso = nextDateRaw ? new Date(nextDateRaw + "T00:00:00Z").toISOString() : null;
    startTransition(async () => {
      const res = await updateReflectDebrief({
        participant_id: participantId,
        debrief_status: next,
        debrief_scheduled_at: nextIso,
      });
      if (!res.ok) {
        setFeedback("err");
        setErrMsg(res.error ?? "Update failed");
        return;
      }
      setFeedback("saved");
      setTimeout(() => setFeedback(null), 1500);
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={status}
        onChange={(e) => {
          const next = e.target.value as DebriefStatus;
          setStatus(next);
          submit({ status: next });
        }}
        disabled={pending}
        className={cn(
          "text-[11px] rounded border px-1.5 py-0.5 transition-colors min-w-[110px]",
          STATUS_TONE[status]
        )}
      >
        {(Object.keys(STATUS_LABEL) as DebriefStatus[]).map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </select>

      <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <input
          type="date"
          value={scheduledDate}
          onChange={(e) => {
            const v = e.target.value;
            setScheduledDate(v);
            submit({ scheduled: v });
          }}
          disabled={pending}
          className="rounded border bg-background px-1 py-0.5 text-[11px]"
        />
      </label>

      <Link
        href={`/reflect/consultant/participants/${participantId}/idp`}
        className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
        title="Open IDP editor"
      >
        <FileText className="h-3 w-3" /> IDP
      </Link>

      {feedback === "saving" && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      )}
      {feedback === "saved" && (
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
      )}
      {feedback === "err" && (
        <span className="inline-flex items-center gap-1 text-[11px] text-rose-700" title={errMsg ?? ""}>
          <AlertCircle className="h-3 w-3" />
          err
        </span>
      )}
    </div>
  );
}
