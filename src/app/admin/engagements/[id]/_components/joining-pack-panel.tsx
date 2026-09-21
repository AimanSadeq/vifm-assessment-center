"use client";

/**
 * The joining pack, from the centre's side.
 *
 * Most of what a participant is owed (BPS 5.41) is already in the design: the
 * purpose, the dates, the exercises and their timings. This is the rest, plus
 * the adjustments a participant has asked for (5.45-5.47).
 *
 * Publishing is gated on the pack being complete, and the checklist names what
 * is still missing by clause. That is deliberate friction: consent collected
 * against a pack with no retention period or no named recipients is not
 * informed consent, and an admin should find that out here rather than in a
 * complaint.
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
import { saveJoiningPackAction, publishJoiningPackAction, decideAdjustmentAction } from "../actions";

type Row = Record<string, unknown>;

const FEEDBACK_OPTIONS = [
  { value: "written_report", label: "A written report" },
  { value: "verbal_debrief", label: "A conversation with an assessor" },
  { value: "both", label: "Both" },
  { value: "none", label: "No individual feedback" },
] as const;

export function JoiningPackPanel({
  engagementId,
  engagement,
  candidates = [],
  missing = [],
}: {
  engagementId: string;
  engagement: Row;
  candidates?: Row[];
  missing?: { field: string; label: string; clause: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    purposeStatement: (engagement.pack_purpose_statement as string) ?? "",
    location: (engagement.pack_location as string) ?? "",
    preparation: (engagement.pack_preparation as string) ?? "",
    resultsUse: (engagement.pack_results_use as string) ?? "",
    decisions: (engagement.pack_decisions as string) ?? "",
    decisionTiming: (engagement.pack_decision_timing as string) ?? "",
    reportRecipients: (engagement.pack_report_recipients as string) ?? "",
    feedbackOffer: (engagement.pack_feedback_offer as string) ?? "",
    feedbackWhen: (engagement.pack_feedback_when as string) ?? "",
    retentionMonths: String((engagement.retention_months as number) ?? 24),
    researchUse: Boolean(engagement.research_use),
    adjustmentsNote: (engagement.pack_adjustments_note as string) ?? "",
  });
  const [adjAnswer, setAdjAnswer] = useState<Record<string, { text: string; minutes: string }>>({});

  const publishedAt = engagement.pack_published_at as string | null;
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy("save");
    const res = await saveJoiningPackAction({
      engagementId,
      ...form,
      feedbackOffer: (form.feedbackOffer || "") as "written_report" | "verbal_debrief" | "both" | "none" | "",
      retentionMonths: Number(form.retentionMonths),
    });
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That did not save.");
      return;
    }
    toast.success("Saved.");
    router.refresh();
  };

  const publish = async () => {
    setBusy("publish");
    const res = await publishJoiningPackAction(engagementId);
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "Could not publish.", { duration: 9000 });
      return;
    }
    toast.success("Published. Participants can read it before they consent.");
    router.refresh();
  };

  const decide = async (candidateId: string, status: "agreed" | "declined") => {
    const entry = adjAnswer[candidateId] ?? { text: "", minutes: "" };
    setBusy(candidateId);
    const res = await decideAdjustmentAction({
      candidateId,
      status,
      agreed: entry.text,
      extraMinutes: entry.minutes ? Number(entry.minutes) : null,
    });
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That did not save.");
      return;
    }
    toast.success(status === "agreed" ? "Agreed, and the participant has been told." : "Recorded, and the participant has been told.");
    router.refresh();
  };

  const requested = candidates.filter((c) => c.adjustment_status === "requested");
  const decided = candidates.filter((c) => c.adjustment_status === "agreed" || c.adjustment_status === "declined");
  const notAsked = candidates.filter((c) => (c.adjustment_status ?? "not_asked") === "not_asked").length;
  const acked = candidates.filter((c) => c.pack_ack_at).length;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Joining pack
          {publishedAt ? (
            <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-900">
              Published {formatLocalDate(publishedAt)}
            </span>
          ) : (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              Not published
            </span>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Edit"}
          </Button>
          {!publishedAt && (
            <Button size="sm" onClick={publish} disabled={busy === "publish"}>
              Publish
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        <p className="text-muted-foreground">
          What participants are sent before they consent. The purpose, the dates and the exercises come from the
          design; this is the rest.{" "}
          {candidates.length > 0 && (
            <>
              {acked} of {candidates.length} participants have confirmed they read it.
            </>
          )}
        </p>

        {missing.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="font-medium">Still missing</div>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              {missing.map((m) => (
                <li key={m.field}>
                  {m.label} <span className="text-xs opacity-70">({m.clause})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              A participant cannot give informed consent against a pack that leaves these out, so it cannot be
              published until they are answered.
            </p>
          </div>
        )}

        {open && (
          <div className="space-y-3 rounded border p-3">
            <Field label="What this centre is for, in words a participant reads" clause="5.41.1">
              <Textarea rows={2} value={form.purposeStatement} onChange={(e) => set("purposeStatement", e.target.value)} placeholder="Why this centre is being run, and what it will be used for." />
            </Field>
            <Field label="Where it takes place" clause="5.39">
              <Textarea rows={2} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Venue and address, or the joining arrangements if it is online." />
            </Field>
            <Field label="How to prepare, and any practice materials" clause="5.41.3">
              <Textarea rows={2} value={form.preparation} onChange={(e) => set("preparation", e.target.value)} placeholder="What to read or bring, and anything they can practise on." />
            </Field>
            <Field label="How the results will be used" clause="5.41.4">
              <Textarea rows={2} value={form.resultsUse} onChange={(e) => set("resultsUse", e.target.value)} />
            </Field>
            <Field label="What decisions follow" clause="5.41.5">
              <Textarea rows={2} value={form.decisions} onChange={(e) => set("decisions", e.target.value)} />
            </Field>
            <Field label="When they will hear" clause="5.12">
              <Input value={form.decisionTiming} onChange={(e) => set("decisionTiming", e.target.value)} placeholder="For example: within two weeks of the centre." />
            </Field>
            <Field label="Who receives reports from this centre" clause="5.13">
              <Textarea rows={2} value={form.reportRecipients} onChange={(e) => set("reportRecipients", e.target.value)} placeholder="Name the roles, not just the organisation. Participants are asked to agree to this list." />
            </Field>
            <Field label="Feedback" clause="5.11">
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    size="sm"
                    variant={form.feedbackOffer === o.value ? "default" : "outline"}
                    onClick={() => set("feedbackOffer", o.value)}
                    aria-pressed={form.feedbackOffer === o.value}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              <Input className="mt-2" value={form.feedbackWhen} onChange={(e) => set("feedbackWhen", e.target.value)} placeholder="When, and how they get it." />
            </Field>
            <Field label="How long results are kept, and research use" clause="5.41.6 / 5.41.7">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="number"
                  className="max-w-[7rem]"
                  value={form.retentionMonths}
                  onChange={(e) => set("retentionMonths", e.target.value)}
                />
                <span className="text-xs text-muted-foreground">months</span>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.researchUse}
                    onChange={(e) => set("researchUse", e.target.checked)}
                  />
                  Anonymised results may be used for validation or research, with separate consent
                </label>
              </div>
            </Field>
            <Field label="How to request an adjustment" clause="5.41.8 / 5.45">
              <Textarea rows={2} value={form.adjustmentsNote} onChange={(e) => set("adjustmentsNote", e.target.value)} placeholder="Who to tell, by when, and what happens next." />
            </Field>
            <Button size="sm" onClick={save} disabled={busy === "save"}>
              Save
            </Button>
          </div>
        )}

        {/* ── Adjustments ──────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reasonable adjustments
          </h3>
          {notAsked > 0 && (
            <p className="text-xs text-muted-foreground">
              {notAsked} of {candidates.length} have not been asked yet. They are asked when they open the pack.
            </p>
          )}

          {requested.length === 0 && decided.length === 0 ? (
            <p className="text-muted-foreground">Nothing requested.</p>
          ) : null}

          {requested.map((c) => (
            <div key={c.id as string} className="rounded border border-amber-300 bg-amber-50/50 p-3">
              <div className="font-medium">{c.full_name as string} asked for an adjustment</div>
              <p className="mt-1">{c.adjustment_request as string}</p>
              <div className="mt-2 space-y-2">
                <Textarea
                  rows={2}
                  value={adjAnswer[c.id as string]?.text ?? ""}
                  onChange={(e) =>
                    setAdjAnswer((p) => ({
                      ...p,
                      [c.id as string]: { text: e.target.value, minutes: p[c.id as string]?.minutes ?? "" },
                    }))
                  }
                  placeholder="What will actually be put in place, in words the participant and the centre staff can both act on."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    className="max-w-[9rem]"
                    value={adjAnswer[c.id as string]?.minutes ?? ""}
                    onChange={(e) =>
                      setAdjAnswer((p) => ({
                        ...p,
                        [c.id as string]: { text: p[c.id as string]?.text ?? "", minutes: e.target.value },
                      }))
                    }
                    placeholder="Extra minutes"
                  />
                  <Button size="sm" disabled={busy === (c.id as string)} onClick={() => decide(c.id as string, "agreed")}>
                    Agree
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === (c.id as string)}
                    onClick={() => decide(c.id as string, "declined")}
                  >
                    Cannot be made
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {decided.map((c) => (
            <div key={c.id as string} className="rounded border p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{c.full_name as string}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    c.adjustment_status === "agreed" ? "bg-emerald-100 text-emerald-900" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.adjustment_status === "agreed" ? "Agreed" : "Not made"}
                </span>
                {c.adjustment_extra_minutes ? (
                  <span className="text-xs text-muted-foreground">
                    +{c.adjustment_extra_minutes as number} minutes per timed exercise
                  </span>
                ) : null}
              </div>
              <p className="mt-1">{c.adjustment_agreed as string}</p>
              {c.adjustment_request ? (
                <p className="mt-1 text-xs text-muted-foreground">They asked: {c.adjustment_request as string}</p>
              ) : null}
            </div>
          ))}
        </section>
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
