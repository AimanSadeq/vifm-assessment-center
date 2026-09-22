"use client";

/**
 * What each participant was told, and by whom.
 *
 * Releasing a report is not giving feedback. The platform tracked the first and
 * called it the second, so a development centre could close with every report
 * released and nobody having spoken to anyone - which is the situation clause
 * 8.14 exists to prevent.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatLocalDate } from "@/components/shared/local-date";
import { recordFeedbackAction } from "../actions";
import type { FeedbackReview } from "@/lib/ac/feedback";

type Row = Record<string, unknown>;

const FORMS = [
  { value: "oral", label: "A conversation", hint: "Talked through with them. Needs a written record of what was said." },
  { value: "written_report", label: "A written report", hint: "The report, with nothing spoken alongside it." },
  { value: "both", label: "Both", hint: "The report, plus a conversation about it." },
] as const;

export function FeedbackPanel({
  engagementId,
  candidates = [],
  records = [],
  review,
}: {
  engagementId: string;
  candidates?: Row[];
  records?: Row[];
  review: FeedbackReview;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [form, setForm] = useState<"oral" | "written_report" | "both">("both");
  const [summary, setSummary] = useState("");

  const recordsFor = (candidateId: unknown) => records.filter((r) => r.candidate_id === candidateId);

  const save = async (candidateId: string) => {
    setBusy(candidateId);
    const res = await recordFeedbackAction({ engagementId, candidateId, form, summary });
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That did not save.", { duration: 9000 });
      return;
    }
    toast.success(
      "trained" in res && res.trained
        ? "Recorded."
        : "Recorded. You are not currently listed as feedback-trained, which is noted on the record."
    );
    setOpenFor(null);
    setSummary("");
    router.refresh();
  };

  const formLabel = (v: string) =>
    v === "written_report" ? "Written report" : v === "oral" ? "Conversation" : "Report and conversation";

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Feedback to participants
          {review.owed.length > 0 && (
            <span
              className={`ms-2 rounded px-1.5 py-0.5 text-xs font-normal ${
                review.mandatory ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900"
              }`}
            >
              {review.owed.length} owed
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {review.mandatory
            ? "This centre must give feedback to every participant (8.14), and it should include a conversation so the findings can be worked through (8.22)."
            : "Feedback should be offered to every participant (8.15). Releasing a report is not the same as giving feedback."}
        </p>

        {review.problems.map((p) => (
          <p key={p} className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            {p}
          </p>
        ))}

        <div className="divide-y rounded border">
          {candidates.map((c) => {
            const given = recordsFor(c.id);
            const latest = given[0];
            const editing = openFor === (c.id as string);
            return (
              <div key={c.id as string} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{c.full_name as string}</span>
                    {latest ? (
                      <span className="ms-2 text-xs text-muted-foreground">
                        {formLabel(latest.form as string)} &middot;{" "}
                        {formatLocalDate(latest.delivered_at as string)} &middot;{" "}
                        {latest.delivered_by_name as string}
                        {latest.acknowledged_at ? " · they confirmed receipt" : ""}
                      </span>
                    ) : (
                      <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        nothing recorded
                      </span>
                    )}
                    {latest && !latest.deliverer_trained ? (
                      <span className="ms-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                        deliverer not recorded as trained
                      </span>
                    ) : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOpenFor(editing ? null : (c.id as string))}>
                    {editing ? "Cancel" : given.length > 0 ? "Record another session" : "Record feedback"}
                  </Button>
                </div>

                {given.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {given.length} session{given.length === 1 ? "" : "s"} recorded
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {given.map((g) => (
                        <li key={g.id as string} className="rounded bg-muted/40 p-2 text-xs">
                          <div className="text-muted-foreground">
                            {formatLocalDate(g.delivered_at as string)} &middot; {g.delivered_by_name as string}
                          </div>
                          {g.summary ? <p className="mt-1 whitespace-pre-wrap">{g.summary as string}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {editing && (
                  <div className="space-y-2 rounded bg-muted/40 p-2">
                    <div className="flex flex-wrap gap-2">
                      {FORMS.map((f) => (
                        <Button
                          key={f.value}
                          size="sm"
                          variant={form === f.value ? "default" : "outline"}
                          aria-pressed={form === f.value}
                          onClick={() => setForm(f.value)}
                        >
                          {f.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{FORMS.find((f) => f.value === form)?.hint}</p>
                    {(form === "oral" || form === "both") && (
                      <Textarea
                        rows={3}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="What was discussed: the strengths covered, the development areas, anything they raised, and what was agreed next. The participant sees this."
                      />
                    )}
                    <Button
                      size="sm"
                      disabled={
                        busy === (c.id as string) ||
                        ((form === "oral" || form === "both") && summary.trim().length < 20)
                      }
                      onClick={() => save(c.id as string)}
                    >
                      Record
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {candidates.length === 0 && <p className="p-3 text-muted-foreground">No participants yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
