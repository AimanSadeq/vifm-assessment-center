"use client";

/**
 * The participant's side of a centre, from the centre's side of the desk.
 *
 * Three duties the standard puts on us, which had nowhere to live before:
 *   concerns and appeals must be dealt with, and the dealing recorded  (5.44, 5.48, 6.11)
 *   a participant disturbed or taken ill must be offered re-assessment (5.50)
 *   participants must be told the decision made, and when              (5.9)
 *
 * They sit together because they are the same conversation with the same
 * person, and because an open concern on a participant whose decision is about
 * to be sent is something you want to see at the same moment.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatLocalDate } from "@/components/shared/local-date";
import {
  respondToConcernAction,
  requestReassessmentAction,
  updateReassessmentAction,
  recordCandidateDecisionAction,
  notifyCandidateOfDecisionAction,
} from "../actions";

type Row = Record<string, unknown>;

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  acknowledged: "bg-sky-100 text-sky-900",
  resolved: "bg-emerald-100 text-emerald-900",
  withdrawn: "bg-muted text-muted-foreground",
  requested: "bg-amber-100 text-amber-900",
  scheduled: "bg-sky-100 text-sky-900",
  completed: "bg-emerald-100 text-emerald-900",
  declined: "bg-muted text-muted-foreground",
};

const STAGE_LABEL: Record<string, string> = {
  before: "before the centre",
  during: "during the centre",
  after: "after the centre",
};

// One rendering of a timestamp across every surface: the participant's page is
// a server component and would otherwise print the UTC date while this client
// panel printed the local one, so the same appeal showed two different days.
const dateOf = (v: unknown) => formatLocalDate(v as string | null);
const dateTimeOf = (v: unknown) => formatLocalDate(v as string | null, { withTime: true });
const plainDateOf = (v: unknown) => formatLocalDate(v as string | null, { dateOnly: true });

export function ParticipantRightsPanel({
  engagementId,
  candidates = [],
  exercises = [],
  concerns = [],
  reassessments = [],
}: {
  engagementId: string;
  candidates?: Row[];
  exercises?: Row[];
  concerns?: Row[];
  reassessments?: Row[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [reaOpen, setReaOpen] = useState(false);
  const [reaCandidate, setReaCandidate] = useState("");
  const [reaExercise, setReaExercise] = useState("");
  const [reaReason, setReaReason] = useState("");
  const [decisionFor, setDecisionFor] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [decidedOn, setDecidedOn] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const nameOf = (id: unknown) =>
    (candidates.find((c) => c.id === id)?.full_name as string | undefined) ?? "Unknown participant";

  const run = async (key: string, fn: () => Promise<{ error?: unknown; ok?: boolean; inApp?: boolean }>, onOk: (r: { inApp?: boolean }) => string) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res && "error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That did not save.");
      return false;
    }
    toast.success(onOk(res ?? {}));
    router.refresh();
    return true;
  };

  const openConcerns = concerns.filter((c) => c.status === "open").length;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Participants: concerns, re-assessment and decisions
          {openConcerns > 0 && (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              {openConcerns} unanswered
            </span>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setReaOpen((v) => !v)}>
          {reaOpen ? "Cancel" : "Arrange re-assessment"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 text-sm">
        {/* ── Concerns and appeals ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Raised by participants
          </h3>
          {concerns.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing raised. Participants can raise a concern or appeal from their own portal, before, during or
              after the centre.
            </p>
          ) : (
            concerns.map((c) => (
              <div key={c.id as string} className="rounded border p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{nameOf(c.candidate_id)}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {c.kind === "appeal" ? "Appeal" : "Concern"}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_TONE[c.status as string] ?? "bg-muted"}`}>
                    {c.status as string}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STAGE_LABEL[c.stage as string] ?? (c.stage as string)} · {dateTimeOf(c.raised_at)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{c.body as string}</p>

                {c.response ? (
                  <div className="mt-2 rounded border-s-2 border-accent bg-muted/40 p-2">
                    <div className="text-xs text-muted-foreground">
                      Answered{c.responded_by_name ? ` by ${c.responded_by_name as string}` : ""}
                      {dateOf(c.acknowledged_at) ? ` · ${dateOf(c.acknowledged_at)}` : ""}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{c.response as string}</p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      rows={2}
                      value={replies[c.id as string] ?? ""}
                      onChange={(e) => setReplies((p) => ({ ...p, [c.id as string]: e.target.value }))}
                      placeholder="What the participant will read. Once sent it becomes part of the record and cannot be rewritten."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy === (c.id as string) || (replies[c.id as string] ?? "").trim().length < 10}
                        onClick={() =>
                          run(
                            c.id as string,
                            () =>
                              respondToConcernAction({
                                concernId: c.id as string,
                                response: replies[c.id as string] ?? "",
                                status: "acknowledged",
                              }),
                            () => "Answer sent to the participant."
                          )
                        }
                      >
                        Answer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === (c.id as string) || (replies[c.id as string] ?? "").trim().length < 10}
                        onClick={() =>
                          run(
                            c.id as string,
                            () =>
                              respondToConcernAction({
                                concernId: c.id as string,
                                response: replies[c.id as string] ?? "",
                                status: "resolved",
                              }),
                            () => "Answered and closed."
                          )
                        }
                      >
                        Answer and close
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        {/* ── Re-assessment ────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Re-assessment</h3>

          {reaOpen && (
            <div className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={reaCandidate}
                  onChange={(e) => setReaCandidate(e.target.value)}
                >
                  <option value="">Which participant...</option>
                  {candidates.map((c) => (
                    <option key={c.id as string} value={c.id as string}>
                      {c.full_name as string}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={reaExercise}
                  onChange={(e) => setReaExercise(e.target.value)}
                >
                  <option value="">The whole centre</option>
                  {exercises.map((x) => (
                    <option key={x.id as string} value={x.id as string}>
                      {x.name as string}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                rows={2}
                value={reaReason}
                onChange={(e) => setReaReason(e.target.value)}
                placeholder="What happened? For example: taken ill 10 minutes into the role play and could not continue."
              />
              <Button
                size="sm"
                disabled={busy === "rea" || !reaCandidate || reaReason.trim().length < 5}
                onClick={async () => {
                  const ok = await run(
                    "rea",
                    () =>
                      requestReassessmentAction({
                        engagementId,
                        candidateId: reaCandidate,
                        exerciseId: reaExercise || null,
                        reason: reaReason,
                      }),
                    () => "Re-assessment recorded. The participant can see it on their portal."
                  );
                  if (ok) {
                    setReaOpen(false);
                    setReaCandidate("");
                    setReaExercise("");
                    setReaReason("");
                  }
                }}
              >
                Record
              </Button>
            </div>
          )}

          {reassessments.length === 0 ? (
            <p className="text-muted-foreground">
              None arranged. If a participant was disturbed or taken ill, they are entitled to be re-assessed.
            </p>
          ) : (
            reassessments.map((r) => (
              <div key={r.id as string} className="rounded border p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{nameOf(r.candidate_id)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_TONE[r.status as string] ?? "bg-muted"}`}>
                    {r.status as string}
                  </span>
                  {r.scheduled_for ? (
                    <span className="text-xs text-muted-foreground">
                      for {dateTimeOf(r.scheduled_for)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1">{r.reason as string}</p>
                {r.outcome_note ? (
                  <p className="mt-1 text-xs text-muted-foreground">{r.outcome_note as string}</p>
                ) : null}
                {r.status === "requested" || r.status === "scheduled" ? (
                  <ReassessmentControls
                    requestId={r.id as string}
                    busy={busy === (r.id as string)}
                    onRun={(fn, msg) => run(r.id as string, fn, () => msg)}
                  />
                ) : null}
              </div>
            ))
          )}
        </section>

        {/* ── Decisions ────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Decisions, and telling the participant
          </h3>
          <p className="text-xs text-muted-foreground">
            The decision is the client&apos;s. Recording it here is how the participant gets told what was decided
            and when, which the centre is responsible for.
          </p>
          <div className="divide-y rounded border">
            {candidates.map((c) => {
              const told = c.decision_communicated_at as string | null;
              const out = c.decision_outcome as string | null;
              const editing = decisionFor === (c.id as string);
              return (
                <div key={c.id as string} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{c.full_name as string}</span>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {out
                          ? `${out}${plainDateOf(c.decision_made_at) ? ` · decided ${plainDateOf(c.decision_made_at)}` : ""}`
                          : "No decision recorded"}
                      </span>
                      {told ? (
                        <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900">
                          Told {dateOf(told)}
                        </span>
                      ) : out ? (
                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                          Not told yet
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDecisionFor(editing ? null : (c.id as string));
                          setOutcome((c.decision_outcome as string) ?? "");
                          setDecidedOn((c.decision_made_at as string) ?? "");
                          setDecisionNote((c.decision_note as string) ?? "");
                        }}
                      >
                        {out ? "Edit" : "Record decision"}
                      </Button>
                      {out && !told && (
                        <Button
                          size="sm"
                          disabled={busy === `tell-${c.id as string}`}
                          onClick={() =>
                            run(
                              `tell-${c.id as string}`,
                              () => notifyCandidateOfDecisionAction(c.id as string),
                              (r) =>
                                r.inApp
                                  ? "The participant has been told."
                                  : "Recorded as told. This participant has no portal account, so tell them directly as well."
                            )
                          }
                        >
                          Tell the participant
                        </Button>
                      )}
                    </div>
                  </div>

                  {editing && (
                    <div className="space-y-2 rounded bg-muted/40 p-2">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          className="max-w-xs"
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                          placeholder="What was decided"
                        />
                        <Input
                          type="date"
                          className="max-w-[11rem]"
                          value={decidedOn}
                          onChange={(e) => setDecidedOn(e.target.value)}
                        />
                      </div>
                      <Textarea
                        rows={2}
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Anything the participant should be told alongside it. Optional."
                      />
                      <Button
                        size="sm"
                        disabled={busy === `dec-${c.id as string}` || outcome.trim().length < 2}
                        onClick={async () => {
                          const ok = await run(
                            `dec-${c.id as string}`,
                            () =>
                              recordCandidateDecisionAction({
                                candidateId: c.id as string,
                                outcome,
                                decidedOn: decidedOn || null,
                                note: decisionNote,
                              }),
                            () => "Decision recorded. Tell the participant when you are ready."
                          );
                          if (ok) setDecisionFor(null);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function ReassessmentControls({
  requestId,
  busy,
  onRun,
}: {
  requestId: string;
  busy: boolean;
  onRun: (fn: () => Promise<{ error?: unknown; ok?: boolean }>, msg: string) => void;
}) {
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        type="datetime-local"
        className="max-w-[14rem]"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !when}
        onClick={() =>
          onRun(
            () =>
              updateReassessmentAction({
                requestId,
                status: "scheduled",
                scheduledFor: new Date(when).toISOString(),
              }),
            "Scheduled. The participant can see the time on their portal."
          )
        }
      >
        Schedule
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onRun(() => updateReassessmentAction({ requestId, status: "completed" }), "Marked as done.")}
      >
        Done
      </Button>
      <Input
        className="max-w-xs"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="If declined, why"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || note.trim().length < 5}
        onClick={() =>
          onRun(
            () => updateReassessmentAction({ requestId, status: "declined", outcomeNote: note }),
            "Recorded as offered and declined."
          )
        }
      >
        Declined
      </Button>
    </div>
  );
}
