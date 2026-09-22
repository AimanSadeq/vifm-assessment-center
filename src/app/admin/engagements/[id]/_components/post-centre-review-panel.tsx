"use client";

/**
 * What we learned from running this centre, and whether the series still
 * matches itself.
 *
 * The platform used to end at the report, so whatever was learned lived in the
 * heads of whoever ran the centre - and the next centre repeated the same
 * mistakes. 9.13 is the clause that makes this more than a diary: the
 * recommendations SHALL inform the design, which is impossible if they were
 * never written down.
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
import { saveCentreReviewAction, addCentreFeedbackAction, setEngagementSeriesAction } from "../actions";
import type { SeriesConsistency } from "@/lib/ac/series-consistency";

type Row = Record<string, unknown>;

export function PostCentreReviewPanel({
  engagementId,
  review,
  feedback = [],
  seriesName = "",
  seriesNote = "",
  consistency,
}: {
  engagementId: string;
  review: Row | null;
  feedback?: Row[];
  seriesName?: string;
  seriesNote?: string;
  consistency: SeriesConsistency | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [form, setForm] = useState({
    wentWell: (review?.went_well as string) ?? "",
    didNot: (review?.did_not as string) ?? "",
    participantPerceptions: (review?.participant_perceptions as string) ?? "",
    itReview: (review?.it_review as string) ?? "",
    recommendations: (review?.recommendations as string) ?? "",
    designChanges: (review?.design_changes as string) ?? "",
  });
  const [fb, setFb] = useState({ wentWell: "", couldImprove: "", rating: "" });
  const [series, setSeries] = useState(seriesName);
  const [seriesNoteText, setSeriesNoteText] = useState(seriesNote);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

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

  const staff = feedback.filter((f) => f.source === "staff");
  const participants = feedback.filter((f) => f.source === "participant");
  const completedAt = review?.completed_at as string | null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          After the centre
          {completedAt ? (
            <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-900">
              Reviewed {formatLocalDate(completedAt)}
            </span>
          ) : (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              Not reviewed
            </span>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setFbOpen((v) => !v)}>
            {fbOpen ? "Cancel" : "Add my feedback"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : review ? "Edit review" : "Write the review"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Learning points from running this centre, and what changed as a result. The standard requires the
          recommendations to inform the design of the next one (9.13), which they cannot do if nobody wrote them
          down.
        </p>

        {fbOpen && (
          <div className="space-y-2 rounded border p-3">
            <p className="text-xs text-muted-foreground">
              Your view of the centre itself - not of any participant. Everyone who worked it is asked (9.2).
            </p>
            <Textarea
              rows={2}
              value={fb.wentWell}
              onChange={(e) => setFb((p) => ({ ...p, wentWell: e.target.value }))}
              placeholder="What worked?"
            />
            <Textarea
              rows={2}
              value={fb.couldImprove}
              onChange={(e) => setFb((p) => ({ ...p, couldImprove: e.target.value }))}
              placeholder="What would you change next time?"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={1}
                max={5}
                className="max-w-[7rem]"
                value={fb.rating}
                onChange={(e) => setFb((p) => ({ ...p, rating: e.target.value }))}
                placeholder="1-5"
              />
              <span className="text-xs text-muted-foreground">Optional</span>
              <Button
                size="sm"
                disabled={busy === "fb" || (!fb.wentWell.trim() && !fb.couldImprove.trim())}
                onClick={async () => {
                  const ok = await run(
                    "fb",
                    () =>
                      addCentreFeedbackAction({
                        engagementId,
                        source: "staff",
                        wentWell: fb.wentWell,
                        couldImprove: fb.couldImprove,
                        rating: fb.rating ? Number(fb.rating) : null,
                      }),
                    "Thank you - added to the review."
                  );
                  if (ok) {
                    setFbOpen(false);
                    setFb({ wentWell: "", couldImprove: "", rating: "" });
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
        )}

        {(staff.length > 0 || participants.length > 0) && (
          <div className="text-xs text-muted-foreground">
            {staff.length} from staff, {participants.length} from participants.
            {feedback.some((f) => f.rating) && (
              <>
                {" "}
                Average rating{" "}
                {(
                  feedback.filter((f) => f.rating).reduce((sum, f) => sum + (f.rating as number), 0) /
                  feedback.filter((f) => f.rating).length
                ).toFixed(1)}
                /5.
              </>
            )}
          </div>
        )}

        {open && (
          <div className="space-y-3 rounded border p-3">
            <Field label="What went well" clause="9.1">
              <Textarea rows={2} value={form.wentWell} onChange={(e) => set("wentWell", e.target.value)} />
            </Field>
            <Field label="What did not" clause="9.1">
              <Textarea
                rows={2}
                value={form.didNot}
                onChange={(e) => set("didNot", e.target.value)}
                placeholder="A centre where nothing went wrong is a centre nobody looked at closely."
              />
            </Field>
            <Field label="How participants found it" clause="9.1 / 9.3">
              <Textarea
                rows={2}
                value={form.participantPerceptions}
                onChange={(e) => set("participantPerceptions", e.target.value)}
                placeholder="Perceptions and acceptability - a different question from whether the day ran smoothly."
              />
            </Field>
            <Field label="The technology, where it delivered exercises" clause="9.4">
              <Textarea rows={2} value={form.itReview} onChange={(e) => set("itReview", e.target.value)} />
            </Field>
            <Field label="What should change" clause="9.13">
              <Textarea
                rows={2}
                value={form.recommendations}
                onChange={(e) => set("recommendations", e.target.value)}
              />
            </Field>
            <Field label="What actually changed as a result" clause="9.13">
              <Textarea
                rows={2}
                value={form.designChanges}
                onChange={(e) => set("designChanges", e.target.value)}
                placeholder="A recommendation with nothing beside it is the failure mode of every review document."
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy === "save"}
                onClick={() => run("save", () => saveCentreReviewAction({ engagementId, ...form }), "Saved.")}
              >
                Save
              </Button>
              <Button
                size="sm"
                disabled={busy === "complete"}
                onClick={() =>
                  run(
                    "complete",
                    () => saveCentreReviewAction({ engagementId, ...form, complete: true }),
                    "Review complete."
                  )
                }
              >
                Save and mark complete
              </Button>
            </div>
          </div>
        )}

        {review && !open && (
          <div className="space-y-2">
            {review.went_well ? (
              <p>
                <span className="font-medium">Went well:</span> {review.went_well as string}
              </p>
            ) : null}
            {review.did_not ? (
              <p>
                <span className="font-medium">Did not:</span> {review.did_not as string}
              </p>
            ) : null}
            {review.recommendations ? (
              <p>
                <span className="font-medium">Recommended:</span> {review.recommendations as string}
              </p>
            ) : null}
            {review.design_changes ? (
              <p>
                <span className="font-medium">Changed:</span> {review.design_changes as string}
              </p>
            ) : null}
          </div>
        )}

        {/* ── 5.19: is this centre part of a series, and does the series match? ── */}
        <div className="border-t pt-3">
          <div className="font-medium">Part of a series</div>
          <p className="text-xs text-muted-foreground">
            Where several centres are meant to run to the same design, naming the series lets drift between them be
            found (5.19). Results are only comparable within a series, so this is declared rather than guessed.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              placeholder="Series name, e.g. Senior Manager 2026"
            />
            <Input
              className="max-w-sm"
              value={seriesNoteText}
              onChange={(e) => setSeriesNoteText(e.target.value)}
              placeholder="What holds it together. Optional."
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "series"}
              onClick={() =>
                run(
                  "series",
                  () =>
                    setEngagementSeriesAction({
                      engagementId,
                      seriesName: series,
                      seriesNote: seriesNoteText,
                    }),
                  series.trim() ? "Recorded." : "Removed from the series."
                )
              }
            >
              Save
            </Button>
          </div>

          {consistency && consistency.centres > 1 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">{consistency.summary}</p>
              {consistency.differences.map((d) => (
                <div key={d.field} className="rounded border border-amber-200 bg-amber-50/60 p-2 text-xs">
                  <div className="font-medium text-amber-900">
                    {d.label} <span className="font-normal opacity-70">({d.clause})</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-amber-900">
                    {d.values.map((v) => (
                      <li key={v.engagementId}>
                        {v.name}: {v.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {consistency.withoutReview.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  No post-centre review yet for: {consistency.withoutReview.map((c) => c.name).join(", ")}. A change
                  in a centre with no review has no recorded reason behind it.
                </p>
              )}
            </div>
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
