"use client";

/**
 * The eight checks 4.36 requires of an exercise, and its trial record.
 *
 * Each check shows the question it is actually asking rather than its name. A
 * list of eight nouns - "content validity, face validity, timings..." - is a
 * list people tick; a list of eight questions is one they answer. The last of
 * them, whether the exercise can actually produce evidence for the criteria
 * mapped to it, is the one most often skipped and the one that decides whether
 * the exercise works at all.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatLocalDate } from "@/components/shared/local-date";
import { EXERCISE_CHECKS } from "@/lib/ac/exercise-quality";
import type { ExerciseQualityReview } from "@/lib/ac/exercise-quality";
import { saveExerciseCheckAction, recordExerciseTrialAction } from "../actions";

type Row = Record<string, unknown>;

const STATUS_TONE: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-900",
  concern: "bg-amber-100 text-amber-900",
  not_applicable: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  pass: "Checked",
  concern: "Concern",
  not_applicable: "Does not apply",
};

export function ExerciseQualityPanel({
  exerciseId,
  checks = [],
  trials = [],
  review,
}: {
  exerciseId: string;
  checks?: Row[];
  trials?: Row[];
  review: ExerciseQualityReview;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [trialOpen, setTrialOpen] = useState(false);
  const [trial, setTrial] = useState({
    trialledOn: "",
    participantCount: "",
    representativeNote: "",
    findings: "",
    changesMade: "",
    wasPilot: false,
  });

  const recorded = new Map(checks.map((c) => [c.check_key as string, c]));

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

  const save = async (checkKey: string, status: "pass" | "concern" | "not_applicable") => {
    const ok = await run(
      checkKey,
      () => saveExerciseCheckAction({ exerciseId, checkKey, status, note }),
      "Recorded."
    );
    if (ok) {
      setOpenCheck(null);
      setNote("");
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Is this exercise fit to assess anyone?
          {review.complete ? (
            <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-900">
              All checks made
            </span>
          ) : (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              {review.unchecked.length} of {EXERCISE_CHECKS.length} not checked
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          The standard names eight checks for every exercise (4.36), and requires a new one to be trialled before
          it is used on anyone (4.37).
        </p>

        {review.needsTrial && (
          <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            This exercise has never been used at a centre and has no trial recorded. A new exercise is trialled on
            people representative of the intended participants, who are not themselves participants (4.37).
          </p>
        )}

        <div className="divide-y rounded border">
          {EXERCISE_CHECKS.map((c) => {
            const row = recorded.get(c.key);
            const editing = openCheck === c.key;
            return (
              <div key={c.key} className="space-y-1 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-[10px] text-muted-foreground">{c.clause}</span>
                      {row ? (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_TONE[row.status as string]}`}>
                          {STATUS_LABEL[row.status as string]}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
                          not checked
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.question}</p>
                    {row?.note ? <p className="mt-1 text-xs">{row.note as string}</p> : null}
                    {row?.checked_by_name ? (
                      <p className="text-[10px] text-muted-foreground">
                        {row.checked_by_name as string} · {formatLocalDate(row.checked_at as string)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOpenCheck(editing ? null : c.key);
                      setNote((row?.note as string) ?? "");
                    }}
                  >
                    {editing ? "Cancel" : row ? "Update" : "Check"}
                  </Button>
                </div>

                {editing && (
                  <div className="space-y-2 rounded bg-muted/40 p-2">
                    <Textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What did you look at, and what did you find?"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy === c.key || note.trim().length < 10} onClick={() => save(c.key, "pass")}>
                        Checked, fine
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === c.key || note.trim().length < 10}
                        onClick={() => save(c.key, "concern")}
                      >
                        Checked, concern
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === c.key}
                        onClick={() => save(c.key, "not_applicable")}
                      >
                        Does not apply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 4.37 / 4.38 */}
        <div className="border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">
              Trials
              {review.trials > 0 && (
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {review.trials} recorded{review.piloted ? ", including a pilot of the process" : ""}
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setTrialOpen((v) => !v)}>
              {trialOpen ? "Cancel" : "Record a trial"}
            </Button>
          </div>

          {trialOpen && (
            <div className="mt-2 space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="max-w-[11rem]"
                  value={trial.trialledOn}
                  onChange={(e) => setTrial((p) => ({ ...p, trialledOn: e.target.value }))}
                />
                <Input
                  type="number"
                  className="max-w-[8rem]"
                  value={trial.participantCount}
                  onChange={(e) => setTrial((p) => ({ ...p, participantCount: e.target.value }))}
                  placeholder="How many"
                />
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={trial.wasPilot}
                    onChange={(e) => setTrial((p) => ({ ...p, wasPilot: e.target.checked }))}
                  />
                  This was a pilot of the whole process (4.38)
                </label>
              </div>
              <Textarea
                rows={2}
                value={trial.representativeNote}
                onChange={(e) => setTrial((p) => ({ ...p, representativeNote: e.target.value }))}
                placeholder="Who was it tried on? They should look like the intended participants and must not be participants themselves."
              />
              <Textarea
                rows={2}
                value={trial.findings}
                onChange={(e) => setTrial((p) => ({ ...p, findings: e.target.value }))}
                placeholder="What did the trial show?"
              />
              <Textarea
                rows={2}
                value={trial.changesMade}
                onChange={(e) => setTrial((p) => ({ ...p, changesMade: e.target.value }))}
                placeholder="What changed as a result?"
              />
              <Button
                size="sm"
                disabled={busy === "trial" || !trial.trialledOn || trial.representativeNote.trim().length < 10}
                onClick={async () => {
                  const ok = await run(
                    "trial",
                    () =>
                      recordExerciseTrialAction({
                        exerciseId,
                        trialledOn: trial.trialledOn,
                        participantCount: trial.participantCount ? Number(trial.participantCount) : null,
                        representativeNote: trial.representativeNote,
                        findings: trial.findings,
                        changesMade: trial.changesMade,
                        wasPilot: trial.wasPilot,
                      }),
                    "Trial recorded."
                  );
                  if (ok) {
                    setTrialOpen(false);
                    setTrial({
                      trialledOn: "",
                      participantCount: "",
                      representativeNote: "",
                      findings: "",
                      changesMade: "",
                      wasPilot: false,
                    });
                  }
                }}
              >
                Record
              </Button>
            </div>
          )}

          {trials.length > 0 && (
            <ul className="mt-2 space-y-1">
              {trials.map((t) => (
                <li key={t.id as string} className="rounded border p-2 text-xs">
                  <div className="text-muted-foreground">
                    {formatLocalDate(t.trialled_on as string, { dateOnly: true })}
                    {t.participant_count ? ` · ${t.participant_count as number} people` : ""}
                    {t.was_pilot ? " · pilot of the process" : ""}
                  </div>
                  <p className="mt-0.5">{t.representative_note as string}</p>
                  {t.findings ? <p className="mt-0.5">Found: {t.findings as string}</p> : null}
                  {t.changes_made ? <p className="mt-0.5">Changed: {t.changes_made as string}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
