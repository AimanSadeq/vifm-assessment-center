"use client";

/**
 * Validity evidence for this centre (BPS 3.10, 3.20, 9.6-9.10).
 *
 * The platform could show that assessors agreed and that outcomes fell evenly,
 * but nothing ever asked the client how the people it rated actually did in
 * the role, so it could say nothing about validity. This panel holds the plan
 * agreed with the client, the follow-ups that make a validation study possible,
 * the evaluation record, and the numbers as they stand today, each with the
 * sample size that decides whether it means anything.
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
import {
  saveEvaluationPlanAction,
  scheduleFollowupsAction,
  recordFollowupAction,
  addEvaluationAction,
} from "../validity-actions";
import type { CriterionValidity, CriteriaOverlap, EvaluationCalendar, FollowupSummary } from "@/lib/ac/validity";
import { FOLLOWUP_WAVES } from "@/lib/ac/validity";

type Row = Record<string, unknown>;

export type EvidencePlan = {
  validation?: boolean;
  reaction?: boolean;
  utility?: boolean;
  trigger?: "participants" | "date";
  trigger_participants?: number | null;
  trigger_date?: string | null;
  criterion?: string | null;
  note?: string | null;
} | null;

export function EvidencePanel({
  engagementId,
  plan,
  followups = [],
  followupSummary,
  candidates = [],
  ratedCount,
  evaluations = [],
  calendar,
  validity,
  overlap = [],
  icc,
  fairnessNote,
  seriesName = "",
}: {
  engagementId: string;
  plan: EvidencePlan;
  followups?: Row[];
  followupSummary: FollowupSummary;
  candidates?: Row[];
  ratedCount: number;
  evaluations?: Row[];
  calendar: EvaluationCalendar;
  validity: CriterionValidity;
  overlap?: CriteriaOverlap[];
  icc: { value: number | null; subjects: number } | null;
  fairnessNote: string;
  seriesName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    validation: plan?.validation ?? false,
    reaction: plan?.reaction ?? false,
    utility: plan?.utility ?? false,
    trigger: (plan?.trigger ?? "participants") as "participants" | "date",
    triggerParticipants: String(plan?.trigger_participants ?? 100),
    triggerDate: plan?.trigger_date ?? "",
    criterion: plan?.criterion ?? "",
    note: plan?.note ?? "",
  });
  const [fu, setFu] = useState({ inRole: "", rating: "", basis: "", raterName: "", raterRole: "", note: "" });
  const [ev, setEv] = useState({
    kind: "annual" as "annual" | "major" | "ad_hoc",
    periodStart: "", periodEnd: "", participants: "", reliability: "", validity: "", diversity: "",
    participantImpact: "", utility: "", recommendations: "", conductedByName: "", conductedAt: "", nextDueOn: "",
  });

  const run = async (key: string, fn: () => Promise<{ error?: unknown } | { ok?: boolean }>, msg: string) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res && "error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That did not save.", { duration: 9000 });
      return false;
    }
    toast.success(msg);
    router.refresh();
    return true;
  };

  const nameOf = (id: unknown) => (candidates.find((c) => c.id === id)?.full_name as string | undefined) ?? "Participant";
  const waveLabel = (w: unknown) => FOLLOWUP_WAVES.find((x) => x.wave === w)?.label ?? String(w);
  const today = new Date().toISOString().slice(0, 10);
  const powerTone = { none: "bg-muted text-muted-foreground", too_small: "bg-amber-100 text-amber-900", early: "bg-sky-100 text-sky-900", adequate: "bg-emerald-100 text-emerald-900" }[validity.power];

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Validity evidence
          {followupSummary.overdue > 0 && (
            <span className="ms-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-normal text-rose-900">
              {followupSummary.overdue} follow-up{followupSummary.overdue === 1 ? "" : "s"} overdue
            </span>
          )}
          {calendar.annualOverdue && (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              Annual evaluation overdue
            </span>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/admin/engagements/${engagementId}/evidence-pack`} title="What VIFM can show a client about this centre: reliability, validity, fairness, participant impact and utility, with the sample behind each number.">
              Evidence pack (PDF)
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPlanOpen((v) => !v)}>
            {planOpen ? "Close" : plan ? "Edit plan" : "Agree the plan"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        <p className="text-muted-foreground">
          What this centre can show about whether it works. Reliability and fairness are computed from the ratings;
          validity needs the client to say how the people it rated actually did, which is what the follow-ups collect.
          Every number carries the sample behind it (BPS 9.10): a small sample is shown as an early indication, not
          as evidence.
        </p>

        {/* ── Where the evidence stands ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Assessor agreement (reliability)">
            {icc && icc.value !== null
              ? <>ICC {icc.value.toFixed(2)} <span className="text-xs text-muted-foreground">from {icc.subjects} co-rated ratings</span></>
              : <span className="text-muted-foreground">Not yet computable: needs two assessors rating the same participants.</span>}
          </Stat>
          <Stat label="Later performance (criterion validity)">
            <span className={`me-2 rounded px-1.5 py-0.5 text-xs ${powerTone}`}>
              {validity.power === "none" ? "No data" : validity.power === "too_small" ? "Too few" : validity.power === "early" ? "Provisional" : "Adequate sample"}
            </span>
            {validity.r !== null ? <>r = {validity.r.toFixed(2)} over {validity.n} participants</> : <>{validity.n} participants with both ratings</>}
          </Stat>
          <Stat label="Fairness (diversity)">{fairnessNote}</Stat>
          <Stat label="Criteria overlap (4.6)">
            {overlap.length === 0
              ? <span className="text-muted-foreground">Needs at least 10 participants rated on a pair of criteria.</span>
              : overlap.some((o) => o.merge)
                ? <>{overlap.filter((o) => o.merge).map((o) => `${o.a} and ${o.b} (r ${o.r.toFixed(2)})`).join("; ")} correlate above 0.7: consider merging.</>
                : <>No pair above 0.7 across {overlap[0].n} participants.</>}
          </Stat>
        </div>
        <p className="text-xs text-muted-foreground">{validity.statement}</p>

        {/* ── The plan agreed with the client (3.20) ── */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agreed with the client (3.20)</h3>
          {!plan && !planOpen && (
            <p className="text-muted-foreground">
              Nothing agreed yet. The agreement template (clause 11.3 and 14) asks the client whether VIFM may collect
              outcome data after the centre; record the answer here.
            </p>
          )}
          {plan && !planOpen && (
            <ul className="list-disc space-y-0.5 ps-5">
              <li>Validation study (ratings against later performance): {plan.validation ? "agreed" : "not agreed"}</li>
              <li>Participant reaction study: {plan.reaction ? "agreed" : "not agreed"}</li>
              <li>Business-outcome (utility) evaluation: {plan.utility ? "agreed" : "not agreed"}</li>
              <li>
                Evaluation runs {plan.trigger === "date" ? `on ${formatLocalDate(plan.trigger_date ?? null, { dateOnly: true }) ?? "a date to be set"}` : `once ${plan.trigger_participants ?? "?"} participants have been assessed`}
              </li>
              {plan.criterion && <li>Performance measure the client will provide: {plan.criterion}</li>}
              {plan.note && <li>{plan.note}</li>}
            </ul>
          )}
          {planOpen && (
            <div className="space-y-3 rounded border p-3">
              {([["validation", "Validation study: compare centre ratings with later performance"], ["reaction", "Participant reaction study"], ["utility", "Business-outcome (utility) evaluation"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={planForm[k]} onChange={(e) => setPlanForm((p) => ({ ...p, [k]: e.target.checked }))} />
                  {label}
                </label>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs">Evaluate</Label>
                <select className="rounded border px-2 py-1 text-sm" value={planForm.trigger} onChange={(e) => setPlanForm((p) => ({ ...p, trigger: e.target.value as "participants" | "date" }))}>
                  <option value="participants">once this many participants are assessed</option>
                  <option value="date">on a date</option>
                </select>
                {planForm.trigger === "participants" ? (
                  <Input type="number" min={1} className="max-w-[7rem]" value={planForm.triggerParticipants} onChange={(e) => setPlanForm((p) => ({ ...p, triggerParticipants: e.target.value }))} />
                ) : (
                  <Input type="date" className="max-w-[11rem]" value={planForm.triggerDate} onChange={(e) => setPlanForm((p) => ({ ...p, triggerDate: e.target.value }))} />
                )}
              </div>
              <Input value={planForm.criterion} onChange={(e) => setPlanForm((p) => ({ ...p, criterion: e.target.value }))} placeholder="The performance measure the client will provide, for example the annual performance rating or the probation outcome." />
              <Textarea rows={2} value={planForm.note} onChange={(e) => setPlanForm((p) => ({ ...p, note: e.target.value }))} placeholder="Anything else agreed, such as who at the client supplies the ratings." />
              <Button size="sm" disabled={busy === "plan"} onClick={() => run("plan", () => saveEvaluationPlanAction({ engagementId, ...planForm, triggerParticipants: Number(planForm.triggerParticipants) || null, triggerDate: planForm.triggerDate || null }), "Plan saved.").then((ok) => ok && setPlanOpen(false))}>
                Save plan
              </Button>
            </div>
          )}
        </section>

        {/* ── Outcome follow-ups ── */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome follow-ups</h3>
            <Button size="sm" variant="outline" disabled={busy === "schedule" || ratedCount === 0} onClick={() => run("schedule", () => scheduleFollowupsAction(engagementId), "Follow-ups scheduled at 6 and 12 months.")}>
              {followups.length ? "Add any missing" : "Schedule follow-ups"}
            </Button>
          </div>
          {followups.length === 0 ? (
            <p className="text-muted-foreground">
              {ratedCount === 0
                ? "Follow-ups are scheduled once participants have a finalised overall rating."
                : `${ratedCount} rated participant${ratedCount === 1 ? "" : "s"}. Schedule the 6- and 12-month follow-ups so the client is asked how each one did.`}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {followupSummary.collected} collected · {followupSummary.due} due · {followupSummary.overdue} overdue · {followupSummary.notAvailable} not available · {followupSummary.inRole} went into the role
              </p>
              <div className="space-y-1">
                {followups.map((f) => {
                  const id = f.id as string;
                  const status = f.status as string;
                  const overdue = status === "due" && String(f.due_on).slice(0, 10) < today;
                  return (
                    <div key={id} className="rounded border p-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{nameOf(f.candidate_id)}</span>
                        <span className="text-xs text-muted-foreground">{waveLabel(f.wave)} · due {formatLocalDate(f.due_on as string, { dateOnly: true })}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs ${status === "collected" ? "bg-emerald-100 text-emerald-900" : status === "not_available" ? "bg-muted text-muted-foreground" : overdue ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900"}`}>
                          {status === "collected" ? (f.in_role === true ? `In role · rated ${f.performance_rating ?? "-"}` : f.in_role === false ? "Not in role" : "Collected") : status === "not_available" ? "Not available" : overdue ? "Overdue" : "Due"}
                        </span>
                        {status === "collected" && f.rater_name ? <span className="text-xs text-muted-foreground">by {f.rater_name as string}{f.rater_role ? `, ${f.rater_role as string}` : ""}</span> : null}
                        {status === "due" && (
                          <Button size="sm" variant="ghost" className="ms-auto h-7" onClick={() => setEditing(editing === id ? null : id)}>
                            {editing === id ? "Cancel" : "Record"}
                          </Button>
                        )}
                      </div>
                      {editing === id && (
                        <div className="mt-2 space-y-2 rounded bg-muted/40 p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <select className="rounded border px-2 py-1 text-sm" value={fu.inRole} onChange={(e) => setFu((p) => ({ ...p, inRole: e.target.value }))}>
                              <option value="">Went into the role?</option>
                              <option value="yes">Yes, in the role</option>
                              <option value="no">No</option>
                            </select>
                            <Input type="number" min={1} max={5} className="max-w-[8rem]" value={fu.rating} onChange={(e) => setFu((p) => ({ ...p, rating: e.target.value }))} placeholder="Rating 1-5" />
                            <Input className="max-w-[14rem]" value={fu.raterName} onChange={(e) => setFu((p) => ({ ...p, raterName: e.target.value }))} placeholder="Who rated them" />
                            <Input className="max-w-[12rem]" value={fu.raterRole} onChange={(e) => setFu((p) => ({ ...p, raterRole: e.target.value }))} placeholder="Their role" />
                          </div>
                          <Input value={fu.basis} onChange={(e) => setFu((p) => ({ ...p, basis: e.target.value }))} placeholder="What the rating is based on, for example the mid-year review." />
                          <Textarea rows={2} value={fu.note} onChange={(e) => setFu((p) => ({ ...p, note: e.target.value }))} placeholder="Note (optional)" />
                          <div className="flex gap-2">
                            <Button size="sm" disabled={busy === id} onClick={() => run(id, () => recordFollowupAction({ followupId: id, status: "collected", inRole: fu.inRole === "" ? null : fu.inRole === "yes", performanceRating: fu.rating ? Number(fu.rating) : null, ratingBasis: fu.basis, raterName: fu.raterName, raterRole: fu.raterRole, note: fu.note }), "Follow-up recorded.").then((ok) => ok && setEditing(null))}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy === id} onClick={() => run(id, () => recordFollowupAction({ followupId: id, status: "not_available", note: fu.note }), "Marked as not available.").then((ok) => ok && setEditing(null))}>
                              Not available
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ── Evaluations (9.6, 9.8) ── */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evaluations (9.6, 9.8)</h3>
            <Button size="sm" variant="outline" onClick={() => setEvalOpen((v) => !v)}>{evalOpen ? "Cancel" : "Record an evaluation"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {calendar.annualDueOn
              ? <>Next annual evaluation due {formatLocalDate(calendar.annualDueOn, { dateOnly: true })}{calendar.majorDueOn ? <>; major review due {formatLocalDate(calendar.majorDueOn, { dateOnly: true })}</> : null}.</>
              : "Set the centre's dates to start the evaluation calendar."}
            {seriesName ? ` This centre is part of the series "${seriesName}"; an evaluation can cover the series.` : ""}
          </p>
          {evaluations.length === 0 && !evalOpen && <p className="text-muted-foreground">No evaluation recorded yet.</p>}
          {evaluations.map((e) => (
            <div key={e.id as string} className="rounded border p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{e.kind === "major" ? "Major review" : e.kind === "annual" ? "Annual evaluation" : "Evaluation"}</span>
                <span className="text-xs text-muted-foreground">{formatLocalDate(e.conducted_at as string, { dateOnly: true })} · {e.conducted_by_name as string}{e.participants ? ` · ${e.participants as number} participants` : ""}{e.series_name ? ` · series ${e.series_name as string}` : ""}</span>
              </div>
              <dl className="mt-1 grid gap-1 sm:grid-cols-2">
                {([["Reliability", e.reliability], ["Validity", e.validity], ["Diversity", e.diversity], ["Participant impact", e.participant_impact], ["Utility", e.utility], ["Recommendations", e.recommendations]] as const).map(([k, v]) => v ? (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v as string}</dd></div>
                ) : null)}
              </dl>
            </div>
          ))}
          {evalOpen && (
            <div className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select className="rounded border px-2 py-1 text-sm" value={ev.kind} onChange={(e) => setEv((p) => ({ ...p, kind: e.target.value as typeof ev.kind }))}>
                  <option value="annual">Annual evaluation</option>
                  <option value="major">Major review (3 to 5 years)</option>
                  <option value="ad_hoc">Evaluation after a substantial change</option>
                </select>
                <Input type="date" className="max-w-[11rem]" value={ev.periodStart} onChange={(e) => setEv((p) => ({ ...p, periodStart: e.target.value }))} title="Period start" />
                <Input type="date" className="max-w-[11rem]" value={ev.periodEnd} onChange={(e) => setEv((p) => ({ ...p, periodEnd: e.target.value }))} title="Period end" />
                <Input type="number" min={0} className="max-w-[9rem]" value={ev.participants} onChange={(e) => setEv((p) => ({ ...p, participants: e.target.value }))} placeholder="Participants" />
              </div>
              {([["reliability", "Reliability: did assessors agree, and how consistent was the rating?"], ["validity", "Validity: what do the follow-ups show, and what is the sample?"], ["diversity", "Diversity: did outcomes fall evenly across groups?"], ["participantImpact", "Participant impact: what did participants report, and any wellbeing concerns?"], ["utility", "Utility: what did the centre contribute against its cost?"], ["recommendations", "Recommendations for the next centre"]] as const).map(([k, ph]) => (
                <Textarea key={k} rows={2} value={ev[k]} onChange={(e) => setEv((p) => ({ ...p, [k]: e.target.value }))} placeholder={ph} />
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-[16rem]" value={ev.conductedByName} onChange={(e) => setEv((p) => ({ ...p, conductedByName: e.target.value }))} placeholder="Conducted by" />
                <Input type="date" className="max-w-[11rem]" value={ev.conductedAt} onChange={(e) => setEv((p) => ({ ...p, conductedAt: e.target.value }))} title="Conducted on" />
                <Input type="date" className="max-w-[11rem]" value={ev.nextDueOn} onChange={(e) => setEv((p) => ({ ...p, nextDueOn: e.target.value }))} title="Next due" />
                <Button size="sm" disabled={busy === "eval"} onClick={() => run("eval", () => addEvaluationAction({ engagementId, seriesName: seriesName || null, ...ev, participants: ev.participants ? Number(ev.participants) : null, periodStart: ev.periodStart || null, periodEnd: ev.periodEnd || null, nextDueOn: ev.nextDueOn || null }), "Evaluation recorded.").then((ok) => ok && setEvalOpen(false))}>
                  Save evaluation
                </Button>
              </div>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
