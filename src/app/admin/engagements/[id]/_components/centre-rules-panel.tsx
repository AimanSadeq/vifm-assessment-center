"use client";

/**
 * How this centre runs: staffing, conflicts, the participant contact, and what
 * happens to results that did not come from an exercise.
 *
 * The BPS standard sets floors the platform used to ignore: more than one
 * assessor per participant (5.18), at least one assessor per three (5.21), a
 * workload each assessor can actually carry (5.20), and nobody assessing a
 * participant they know (5.36). This panel shows where the centre stands,
 * declares conflicts, and records a reason where a centre is activated anyway.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewStaffing, MIN_ASSESSORS_PER_PARTICIPANT } from "@/lib/ac/staffing";
import {
  declareAssessorConflictAction,
  removeAssessorConflictAction,
  recordStaffingOverrideAction,
  setParticipantContactAction,
  setOtherMethodsRuleAction,
} from "../actions";

type Row = Record<string, unknown>;

export function CentreRulesPanel({
  engagementId,
  candidates,
  assignments,
  assessors,
  conflicts = [],
  overrideReason,
  contactName = "",
  contactEmail = "",
  appealsNote = "",
  otherMethodsRule = "",
  otherMethodsNote = "",
}: {
  engagementId: string;
  candidates: Row[];
  assignments: Row[];
  assessors: Row[];
  conflicts?: Row[];
  overrideReason?: string | null;
  contactName?: string;
  contactEmail?: string;
  appealsNote?: string;
  otherMethodsRule?: string;
  otherMethodsNote?: string;
}) {
  const router = useRouter();
  const [conflictAssessor, setConflictAssessor] = useState("");
  const [conflictCandidate, setConflictCandidate] = useState("");
  const [conflictReason, setConflictReason] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // Printed on every report from this engagement (BPS 8.20, 5.49).
  const [cName, setCName] = useState(contactName);
  const [cEmail, setCEmail] = useState(contactEmail);
  const [appeals, setAppeals] = useState(appealsNote);
  // What a test or questionnaire result may do to a competency rating (BPS 4.32).
  const [methodsRule, setMethodsRule] = useState(otherMethodsRule);
  const [methodsNote, setMethodsNote] = useState(otherMethodsNote);

  const saveMethods = async (rule: string) => {
    setMethodsRule(rule);
    setBusy(true);
    const res = await setOtherMethodsRuleAction({
      engagementId,
      rule: rule as "context_only" | "documented_conversion",
      note: methodsNote,
    });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "Could not save the rule.");
      return;
    }
    toast.success("Saved. Assessors see this rule at the wash-up.");
    router.refresh();
  };

  const saveContact = async () => {
    setBusy(true);
    const res = await setParticipantContactAction({
      engagementId,
      contactName: cName,
      contactEmail: cEmail,
      appealsNote: appeals,
    });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "Could not save the contact.");
      return;
    }
    toast.success("Participant contact saved. It prints on every report from this engagement.");
    router.refresh();
  };

  const nameOf = (r: Row) => (r.full_name as string) ?? (r.name as string) ?? (r.id as string);

  const report = reviewStaffing({
    candidateIds: candidates.map((c) => c.id as string),
    candidateNames: Object.fromEntries(candidates.map((c) => [c.id as string, nameOf(c)])),
    assessorNames: Object.fromEntries(assessors.map((a) => [a.id as string, nameOf(a)])),
    assignments: assignments.map((a) => ({
      assessorId: a.assessor_id as string,
      candidateId: a.candidate_id as string,
    })),
  });

  const declare = async () => {
    if (!conflictAssessor || !conflictCandidate) return;
    setBusy(true);
    const res = await declareAssessorConflictAction({
      engagementId,
      assessorId: conflictAssessor,
      candidateId: conflictCandidate,
      reason: conflictReason || undefined,
    });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "Could not record the conflict.");
      return;
    }
    const removed = "assignmentsRemoved" in res ? (res.assignmentsRemoved as number) : 0;
    toast.success(removed > 0 ? `Conflict recorded. ${removed} assignment(s) removed.` : "Conflict recorded.");
    setConflictAssessor("");
    setConflictCandidate("");
    setConflictReason("");
    router.refresh();
  };

  const saveOverride = async () => {
    setBusy(true);
    const res = await recordStaffingOverrideAction(engagementId, reason);
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "Could not record the reason.");
      return;
    }
    toast.success("Reason recorded. The centre can now be activated.");
    setReason("");
    router.refresh();
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How this centre runs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Participants" value={report.participants} />
          <Figure label="Assessors" value={report.assessors} />
          <Figure label="Assessors required" value={report.assessorsRequired} hint="One per three participants" />
          <Figure
            label="Seen by one assessor"
            value={report.perCandidate.filter((c) => c.assessors > 0 && c.assessors < MIN_ASSESSORS_PER_PARTICIPANT).length}
            hint="Should be none"
          />
        </div>

        {report.blocking.length > 0 ? (
          <div className="rounded border border-rose-300 bg-rose-50 p-3">
            <p className="font-medium text-rose-900">This centre cannot be activated yet</p>
            <ul className="mt-1 list-disc ps-5 text-rose-900">
              {report.blocking.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {overrideReason ? (
              <p className="mt-2 text-xs text-rose-900">
                A reason is already recorded, so activation is allowed: {overrideReason}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <Label className="text-xs">Proceeding anyway? Record why, and it stays with the engagement.</Label>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="For example: the client has approved a two-assessor panel for this pilot cohort of four."
                />
                <Button size="sm" variant="outline" onClick={saveOverride} disabled={busy || reason.trim().length < 10}>
                  Record reason
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded border border-green-300 bg-green-50 p-2 text-green-900">
            Staffing meets the standard: every participant is seen by at least {MIN_ASSESSORS_PER_PARTICIPANT} assessors,
            with enough assessors for the cohort.
          </p>
        )}

        {report.cautions.map((c) => (
          <p key={c} className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
            {c}
          </p>
        ))}

        {report.perAssessor.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Load per assessor</p>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-start font-normal">Assessor</th>
                  <th className="w-24 text-end font-normal">Participants</th>
                  <th className="w-24 text-end font-normal">Observations</th>
                </tr>
              </thead>
              <tbody>
                {report.perAssessor.map((a) => (
                  <tr key={a.assessorId}>
                    <td className="py-0.5">{a.name ?? a.assessorId}</td>
                    <td className="py-0.5 text-end tabular-nums">{a.candidates}</td>
                    <td className="py-0.5 text-end tabular-nums">{a.observations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t pt-3">
          <p className="font-medium">Participant contact</p>
          <p className="text-xs text-muted-foreground">
            Printed on every report: who a participant asks about their assessment, and how they may challenge a result.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="Contact name"
            />
            <input
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={cEmail}
              onChange={(e) => setCEmail(e.target.value)}
              placeholder="Contact email"
            />
            <input
              className="h-9 min-w-64 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={appeals}
              onChange={(e) => setAppeals(e.target.value)}
              placeholder="How a result may be challenged (optional; standard wording is used if blank)"
            />
            <Button size="sm" variant="outline" onClick={saveContact} disabled={busy}>
              Save contact
            </Button>
          </div>
          {!cName && (
            <p className="mt-1 text-xs text-amber-800">
              No contact set, so reports name nobody. The standard requires a contact for questions.
            </p>
          )}
        </div>

        <div className="border-t pt-3">
          <p className="font-medium">Results from other methods</p>
          <p className="text-xs text-muted-foreground">
            Tests, questionnaires, interviews and 360s produce numbers on their own scales. Say what they may do to a
            competency rating, so assessors are not left to decide in the room.
          </p>
          <div className="mt-2 space-y-2">
            {[
              {
                value: "context_only",
                label: "Context only",
                hint: "Assessors may read them, but a rating comes from exercise evidence alone.",
              },
              {
                value: "documented_conversion",
                label: "Converted by a stated rule",
                hint: "The client agreed how a result maps onto the 1 to 5 scale. Write the rule below.",
              },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  name="other-methods-rule"
                  checked={methodsRule === opt.value}
                  onChange={() => saveMethods(opt.value)}
                  disabled={busy}
                />
                <span>
                  {opt.label}
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            ))}
            {methodsRule === "documented_conversion" && (
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  value={methodsNote}
                  onChange={(e) => setMethodsNote(e.target.value)}
                  placeholder="State the conversion. For example: a technical band of 4 or 5 supports a rating of 4 on Financial Acumen, but never raises it by more than one point."
                />
                <Button size="sm" variant="outline" onClick={() => saveMethods("documented_conversion")} disabled={busy}>
                  Save the rule
                </Button>
              </div>
            )}
            {!methodsRule && (
              <p className="text-xs text-amber-800">
                Not decided for this centre. Until it is, assessors see other results with no guidance on what to do
                with them.
              </p>
            )}
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="font-medium">Conflicts of interest</p>
          <p className="text-xs text-muted-foreground">
            An assessor who knows a participant must not assess them. A declared pair cannot be assigned.
          </p>
          {conflicts.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {conflicts.map((c) => (
                <li key={c.id as string} className="flex items-center justify-between gap-2">
                  <span>
                    {(assessors.find((a) => a.id === c.assessor_id) && nameOf(assessors.find((a) => a.id === c.assessor_id)!))
                      ?? (c.assessor_id as string)}
                    {" will not assess "}
                    {(candidates.find((x) => x.id === c.candidate_id) && nameOf(candidates.find((x) => x.id === c.candidate_id)!))
                      ?? (c.candidate_id as string)}
                    {c.reason ? ` - ${c.reason as string}` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await removeAssessorConflictAction(c.id as string);
                      router.refresh();
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={conflictAssessor}
              onChange={(e) => setConflictAssessor(e.target.value)}
            >
              <option value="">Assessor...</option>
              {assessors.map((a) => (
                <option key={a.id as string} value={a.id as string}>
                  {nameOf(a)}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={conflictCandidate}
              onChange={(e) => setConflictCandidate(e.target.value)}
            >
              <option value="">Participant...</option>
              {candidates.map((c) => (
                <option key={c.id as string} value={c.id as string}>
                  {nameOf(c)}
                </option>
              ))}
            </select>
            <input
              className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={conflictReason}
              onChange={(e) => setConflictReason(e.target.value)}
              placeholder="Reason (optional)"
            />
            <Button size="sm" variant="outline" onClick={declare} disabled={busy || !conflictAssessor || !conflictCandidate}>
              Declare conflict
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
