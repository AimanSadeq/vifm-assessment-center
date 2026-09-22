"use client";

/**
 * The centre timetable.
 *
 * Caliber knew who assessed whom in which exercise and nothing about when or
 * where, so it could not answer the first question every participant and every
 * assessor asks. The four documents the standard wants (5.35) are all views of
 * these slots rather than four files kept by hand, which would disagree with
 * each other by the second edit.
 *
 * The clash checks are the point. A person in two rooms at once or a room
 * holding two things at once stops the day; a participant running three hours
 * with no break is the quieter failure, and the one nobody notices until
 * afterwards.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addScheduleSlotAction, removeScheduleSlotAction, generateTimetableDraftAction } from "../actions";
import type { TimetableReview } from "@/lib/ac/timetable";

type Row = Record<string, unknown>;

const KINDS = [
  { value: "exercise", label: "Exercise" },
  { value: "briefing", label: "Briefing" },
  { value: "break", label: "Break" },
  { value: "lunch", label: "Lunch" },
  { value: "washup", label: "Wash-up" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
] as const;

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

export function TimetablePanel({
  engagementId,
  slots = [],
  review,
  candidates = [],
  assessors = [],
  exercises = [],
}: {
  engagementId: string;
  slots?: Row[];
  review: TimetableReview;
  candidates?: Row[];
  assessors?: Row[];
  exercises?: Row[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "exercise" as (typeof KINDS)[number]["value"],
    exerciseId: "",
    candidateId: "",
    assessorId: "",
    startsAt: "",
    endsAt: "",
    room: "",
  });
  const [dayStart, setDayStart] = useState("");

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

  const nameOfCandidate = (id: unknown) =>
    (candidates.find((c) => c.id === id)?.full_name as string | undefined) ?? null;
  const nameOfAssessor = (id: unknown) => {
    const p = assessors.find((a) => a.id === id);
    return (p?.full_name as string | undefined) ?? (p?.email as string | undefined) ?? null;
  };
  const nameOfExercise = (id: unknown) =>
    (exercises.find((x) => x.id === id)?.name as string | undefined) ?? null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Timetable
          {review.blocking.length > 0 && (
            <span className="ms-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-normal text-rose-900">
              {review.blocking.length} clash{review.blocking.length === 1 ? "" : "es"}
            </span>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Add a slot"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {slots.length === 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Nothing scheduled. The assessor assignments already say who assesses whom in which exercise, so a
              first pass can be laid out from them - rooms and real-world constraints are yours to add.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="datetime-local"
                className="max-w-[14rem]"
                value={dayStart}
                onChange={(e) => setDayStart(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy === "gen" || !dayStart}
                onClick={() =>
                  run(
                    "gen",
                    () =>
                      generateTimetableDraftAction({
                        engagementId,
                        dayStart: new Date(dayStart).toISOString(),
                      }),
                    "Laid out. Check the clashes and add rooms and breaks."
                  )
                }
              >
                Lay out a first pass
              </Button>
            </div>
          </div>
        ) : null}

        {review.blocking.map((p) => (
          <p key={p.message} className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
            {p.message}
          </p>
        ))}
        {review.problems
          .filter((p) => p.severity === "caution")
          .map((p) => (
            <p key={p.message} className="rounded border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-900">
              {p.message}
            </p>
          ))}
        {review.unscheduledExercises.length > 0 && (
          <p className="rounded border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-900">
            Not on the timetable yet: {review.unscheduledExercises.map((x) => x.name).join(", ")}.
          </p>
        )}

        {open && (
          <div className="space-y-2 rounded border p-3">
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Button
                  key={k.value}
                  size="sm"
                  variant={form.kind === k.value ? "default" : "outline"}
                  aria-pressed={form.kind === k.value}
                  onClick={() => set("kind", k.value)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {form.kind === "exercise" && (
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={form.exerciseId}
                  onChange={(e) => set("exerciseId", e.target.value)}
                >
                  <option value="">Which exercise...</option>
                  {exercises.map((x) => (
                    <option key={x.id as string} value={x.id as string}>
                      {x.name as string}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={form.candidateId}
                onChange={(e) => set("candidateId", e.target.value)}
              >
                <option value="">Whole cohort</option>
                {candidates.map((c) => (
                  <option key={c.id as string} value={c.id as string}>
                    {c.full_name as string}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={form.assessorId}
                onChange={(e) => set("assessorId", e.target.value)}
              >
                <option value="">No assessor</option>
                {assessors.map((a) => (
                  <option key={a.id as string} value={a.id as string}>
                    {(a.full_name as string) ?? (a.email as string)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="datetime-local"
                className="max-w-[13rem]"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="datetime-local"
                className="max-w-[13rem]"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
              <Input
                className="max-w-[10rem]"
                value={form.room}
                onChange={(e) => set("room", e.target.value)}
                placeholder="Room"
              />
              <Button
                size="sm"
                disabled={busy === "add" || !form.startsAt || !form.endsAt}
                onClick={async () => {
                  const ok = await run(
                    "add",
                    () =>
                      addScheduleSlotAction({
                        engagementId,
                        kind: form.kind,
                        exerciseId: form.exerciseId || null,
                        candidateId: form.candidateId || null,
                        assessorId: form.assessorId || null,
                        startsAt: new Date(form.startsAt).toISOString(),
                        endsAt: new Date(form.endsAt).toISOString(),
                        room: form.room,
                      }),
                    "Added."
                  );
                  if (ok) setOpen(false);
                }}
              >
                Add
              </Button>
            </div>
          </div>
        )}

        {slots.length > 0 && (
          <div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-start font-normal">When</th>
                  <th className="text-start font-normal">What</th>
                  <th className="text-start font-normal">Who</th>
                  <th className="text-start font-normal">Assessor</th>
                  <th className="text-start font-normal">Room</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id as string} className="border-t">
                    <td className="py-1 tabular-nums">
                      {day(s.starts_at as string)} {clock(s.starts_at as string)}-{clock(s.ends_at as string)}
                    </td>
                    <td className="py-1">
                      {nameOfExercise(s.exercise_id) ??
                        KINDS.find((k) => k.value === s.kind)?.label ??
                        (s.kind as string)}
                    </td>
                    <td className="py-1">{nameOfCandidate(s.candidate_id) ?? "Everyone"}</td>
                    <td className="py-1">{nameOfAssessor(s.assessor_id) ?? "-"}</td>
                    <td className="py-1">{(s.room as string) ?? "-"}</td>
                    <td className="py-1 text-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-rose-600"
                        disabled={busy === (s.id as string)}
                        onClick={() =>
                          run(s.id as string, () => removeScheduleSlotAction(s.id as string), "Removed.")
                        }
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Individual timetables ({review.individual.length})
              </summary>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {review.individual.map((p) => (
                  <div key={`${p.role}-${p.personId}`} className="rounded border p-2">
                    <div className="font-medium">
                      {p.name}
                      <span className="ms-2 text-xs text-muted-foreground">{p.role}</span>
                    </div>
                    {p.slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nothing scheduled.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {p.slots.map((s) => (
                          <li key={s.id} className="tabular-nums">
                            {clock(s.startsAt)}-{clock(s.endsAt)}{" "}
                            <span className="tabular-nums-none">
                              {s.exerciseName ?? KINDS.find((k) => k.value === s.kind)?.label ?? s.kind}
                              {s.room ? ` · ${s.room}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
