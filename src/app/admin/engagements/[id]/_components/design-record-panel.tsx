"use client";

/**
 * Why this centre is designed the way it is.
 *
 * Section 4 of the standard is mostly about decisions Caliber already makes and
 * never recorded the reasons for. The checklist names what is still unwritten
 * by clause; the cautions are the two things that can actually be computed
 * (criteria load, and criteria with nothing to rate them against) rather than
 * merely asserted.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatLocalDate } from "@/components/shared/local-date";
import { saveDesignRecordAction, approveCentrePlanAction, setCompetencyRationaleAction } from "../actions";
import type { DesignReview } from "@/lib/ac/design-record";

type Row = Record<string, unknown>;

const JOB_ANALYSIS_METHODS = [
  { value: "jd_extraction", label: "From the job description" },
  { value: "role_profile", label: "From a role profile" },
  { value: "interviews", label: "Interviews with job holders" },
  { value: "observation", label: "Observing the work" },
  { value: "workshop", label: "Workshop with the client" },
  { value: "other", label: "Other" },
];

export function DesignRecordPanel({
  engagementId,
  engagement,
  review,
  competencies = [],
}: {
  engagementId: string;
  engagement: Row;
  review: DesignReview;
  competencies?: { competencyId: string; name: string; rationale: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [rationales, setRationales] = useState<Record<string, string>>(
    () => Object.fromEntries(competencies.map((c) => [c.competencyId, c.rationale ?? ""]))
  );
  const [form, setForm] = useState({
    designRationale: (engagement.design_rationale as string) ?? "",
    alternativesConsidered: (engagement.alternatives_considered as string) ?? "",
    jobAnalysisMethod: (engagement.job_analysis_method as string) ?? "",
    jobAnalysisNote: (engagement.job_analysis_note as string) ?? "",
    workContext: (engagement.work_context as string) ?? "",
    smeReviewNote: (engagement.sme_review_note as string) ?? "",
    exerciseIndependenceNote: (engagement.exercise_independence_note as string) ?? "",
    existingExercisesNote: (engagement.existing_exercises_note as string) ?? "",
    criteriaLoadAck: (engagement.criteria_load_ack as string) ?? "",
    facilitiesNote: (engagement.facilities_note as string) ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const run = async (key: string, fn: () => Promise<{ error?: unknown } | { ok?: boolean }>, msg: string) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res && "error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That did not save.", { duration: 8000 });
      return false;
    }
    toast.success(msg);
    router.refresh();
    return true;
  };

  const approvedAt = engagement.plan_approved_at as string | null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Design record and centre plan
          {review.missing.length > 0 && (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              {review.missing.length} unwritten
            </span>
          )}
          {approvedAt && (
            <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-900">
              Agreed {formatLocalDate(approvedAt)}
            </span>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/admin/engagements/${engagementId}/centre-plan`}>Centre plan (PDF)</a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Edit"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Why these criteria, why these exercises, and how they map to the job. The plan is the document the
          standard asks to be agreed with the client before the centre runs.
        </p>

        {review.missing.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="font-medium">Not written down yet</div>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {review.missing.map((m) => (
                <li key={m.field}>
                  {m.label} <span className="text-xs opacity-70">({m.clause})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {review.cautions.map((c) => (
          <p key={c} className="rounded border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-900">
            {c}
          </p>
        ))}

        {/* The computed picture: what each exercise is carrying. */}
        {review.exerciseLoad.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What each exercise carries
            </div>
            <table className="mt-1 w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-start font-normal">Exercise</th>
                  <th className="w-24 text-end font-normal">Criteria</th>
                  <th className="w-20 text-end font-normal">Minutes</th>
                </tr>
              </thead>
              <tbody>
                {review.exerciseLoad.map((x) => (
                  <tr key={x.id} className={x.overloaded ? "text-amber-900" : undefined}>
                    <td className="py-0.5">{x.name}</td>
                    <td className="py-0.5 text-end tabular-nums">{x.competencies}</td>
                    <td className="py-0.5 text-end tabular-nums">{x.minutes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {review.outputModes.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Output modes: {review.outputModes.join("; ")} (4.21).
              </p>
            )}
          </div>
        )}

        {/* 4.4 - why each criterion is here. */}
        {competencies.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Why each criterion is assessed ({competencies.length - review.withoutRationale.length} of{" "}
              {competencies.length} recorded)
            </summary>
            <div className="mt-2 space-y-2">
              {competencies.map((c) => (
                <div key={c.competencyId} className="rounded border p-2">
                  <div className="font-medium">{c.name}</div>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={rationales[c.competencyId] ?? ""}
                    onChange={(e) => setRationales((p) => ({ ...p, [c.competencyId]: e.target.value }))}
                    placeholder="Which part of the role needs this, and what effective performance looks like there."
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    disabled={busy === c.competencyId}
                    onClick={() =>
                      run(
                        c.competencyId,
                        () =>
                          setCompetencyRationaleAction({
                            engagementId,
                            competencyId: c.competencyId,
                            rationale: rationales[c.competencyId] ?? "",
                          }),
                        "Recorded."
                      )
                    }
                  >
                    Save
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}

        {open && (
          <div className="space-y-3 rounded border p-3">
            <Field label="Why this centre is designed the way it is" clause="4.1 / 3.26">
              <Textarea rows={2} value={form.designRationale} onChange={(e) => set("designRationale", e.target.value)} />
            </Field>
            <Field label="What else was considered, and why it was not chosen" clause="4.1">
              <Textarea rows={2} value={form.alternativesConsidered} onChange={(e) => set("alternativesConsidered", e.target.value)} placeholder="For example: a one-day centre was rejected as too thin for six criteria." />
            </Field>
            <Field label="How the criteria were derived from the job" clause="4.4">
              <div className="flex flex-wrap gap-2">
                {JOB_ANALYSIS_METHODS.map((m) => (
                  <Button
                    key={m.value}
                    size="sm"
                    variant={form.jobAnalysisMethod === m.value ? "default" : "outline"}
                    aria-pressed={form.jobAnalysisMethod === m.value}
                    onClick={() => set("jobAnalysisMethod", m.value)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
              <Textarea className="mt-2" rows={2} value={form.jobAnalysisNote} onChange={(e) => set("jobAnalysisNote", e.target.value)} placeholder="Who was involved, what was looked at, and when." />
            </Field>
            <Field label="The work, its context and the systems the role uses" clause="4.9 / 4.12">
              <Textarea rows={2} value={form.workContext} onChange={(e) => set("workContext", e.target.value)} />
            </Field>
            <Field label="Who from the job reviewed the exercises for difficulty" clause="4.23">
              <Textarea rows={2} value={form.smeReviewNote} onChange={(e) => set("smeReviewNote", e.target.value)} placeholder="Job content experts - current job holders or their managers - and what they said." />
            </Field>
            <Field label="No exercise carries into another" clause="4.19">
              <Textarea rows={2} value={form.exerciseIndependenceNote} onChange={(e) => set("exerciseIndependenceNote", e.target.value)} placeholder="Nothing here can be computed: only someone reading both exercises can say whether one gives away or depends on the other." />
            </Field>
            <Field label="Existing or adapted exercises" clause="4.28">
              <Textarea rows={2} value={form.existingExercisesNote} onChange={(e) => set("existingExercisesNote", e.target.value)} placeholder="Where an exercise was reused or adapted, how it was held to the same standard as a new one." />
            </Field>
            <Field label="The people and facilities the centre needs" clause="3.26">
              <Textarea rows={2} value={form.facilitiesNote} onChange={(e) => set("facilitiesNote", e.target.value)} placeholder="Rooms, equipment, anything the venue has to provide." />
            </Field>
            {competencies.length > 0 && (
              <Field label="Why this centre carries the number of criteria it does" clause="4.5">
                <Textarea rows={2} value={form.criteriaLoadAck} onChange={(e) => set("criteriaLoadAck", e.target.value)} placeholder="Only needed if the design carries more criteria than the exercises can comfortably assess." />
              </Field>
            )}
            <Button
              size="sm"
              disabled={busy === "save"}
              onClick={() => run("save", () => saveDesignRecordAction({ engagementId, ...form }), "Saved.")}
            >
              Save the design record
            </Button>
          </div>
        )}

        <div className="border-t pt-3">
          <div className="font-medium">Agreed with the client</div>
          {approvedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {(engagement.plan_approved_client_name as string) ?? "Client representative"} agreed this plan on{" "}
              {formatLocalDate(approvedAt)}.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                The standard asks for the plan to be agreed <em>with</em> the client (3.26), so record who at the
                client agreed it - our own approval is not what the clause asks for.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Who at the client agreed it"
                />
                <Button
                  size="sm"
                  disabled={busy === "approve" || clientName.trim().length < 2}
                  onClick={() =>
                    run("approve", () => approveCentrePlanAction({ engagementId, clientName }), "Recorded as agreed.")
                  }
                >
                  Record agreement
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, clause, children }: { label: string; clause: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">
        {label} <span className="font-normal text-muted-foreground">({clause})</span>
      </Label>
      {children}
    </div>
  );
}
