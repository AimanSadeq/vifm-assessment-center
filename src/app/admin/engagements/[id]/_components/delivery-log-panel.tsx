"use client";

/**
 * What happened on the day.
 *
 * A fire alarm during an exercise, a participant taken ill, a role-player who
 * broke character, a late assessor: each can change what a score means, and none
 * of it was written down anywhere. The standard requires the record (BPS 6.10)
 * and that deviations and staff issues are dealt with (6.7, 6.13). Entries
 * cannot be edited afterwards; a correction is another entry.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addDeliveryLogEntryAction } from "../actions";

type Row = Record<string, unknown>;

const KINDS = [
  { value: "incident", label: "Something happened", hint: "Fire alarm, illness, technology failure" },
  { value: "deviation", label: "We departed from the plan", hint: "Timetable, exercise or procedure changed" },
  { value: "staff", label: "Staff issue", hint: "Late, absent, or performance concern" },
  { value: "other", label: "Other", hint: "" },
] as const;

export function DeliveryLogPanel({
  engagementId,
  entries = [],
  candidates = [],
}: {
  engagementId: string;
  entries?: Row[];
  candidates?: Row[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"incident" | "deviation" | "staff" | "other">("incident");
  const [summary, setSummary] = useState("");
  const [action, setAction] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [affects, setAffects] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await addDeliveryLogEntryAction({
      engagementId,
      kind,
      summary,
      actionTaken: action,
      candidateId: candidateId || null,
      affectsAssessment: affects,
    });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "Could not save the entry.");
      return;
    }
    toast.success("Recorded. Entries cannot be edited, so add another if you need to correct this.");
    setSummary("");
    setAction("");
    setCandidateId("");
    setAffects(false);
    setOpen(false);
    router.refresh();
  };

  const nameOf = (id: unknown) =>
    (candidates.find((c) => c.id === id)?.full_name as string | undefined) ?? null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Delivery log</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Record an event"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {open && (
          <div className="space-y-2 rounded border p-3">
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Button
                  key={k.value}
                  size="sm"
                  variant={kind === k.value ? "default" : "outline"}
                  onClick={() => setKind(k.value)}
                  title={k.hint}
                >
                  {k.label}
                </Button>
              ))}
            </div>
            <Textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What happened? For example: the fire alarm sounded 20 minutes into the in-basket."
            />
            <Textarea
              rows={2}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="What was done about it? For example: the exercise was restarted with the full time allowed."
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
              >
                <option value="">Affected the whole centre</option>
                {candidates.map((c) => (
                  <option key={c.id as string} value={c.id as string}>
                    {(c.full_name as string) ?? (c.id as string)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={affects} onChange={(e) => setAffects(e.target.checked)} />
                This could affect how the results should be read
              </label>
              <Button size="sm" onClick={save} disabled={busy || summary.trim().length < 5}>
                Record
              </Button>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing recorded. Anything that could change how a result should be read belongs here: interruptions,
            timetable changes, illness, or a staffing problem.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id as string} className="rounded border p-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">
                    {KINDS.find((k) => k.value === e.kind)?.label ?? (e.kind as string)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.occurred_at as string).toLocaleString()}
                    {e.logged_by_name ? ` · ${e.logged_by_name as string}` : ""}
                    {nameOf(e.candidate_id) ? ` · ${nameOf(e.candidate_id)}` : " · whole centre"}
                  </span>
                  {e.affects_assessment ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                      May affect results
                    </span>
                  ) : null}
                </div>
                <p className="mt-1">{e.summary as string}</p>
                {e.action_taken ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">Action: {e.action_taken as string}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
