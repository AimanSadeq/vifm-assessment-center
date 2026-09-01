"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Unlink, BarChart3 } from "lucide-react";
import { linkUnitToRollup, unlinkUnitFromRollup } from "@/lib/ara/consultant-actions";

export type LinkableUnit = {
  id: string;
  label: string;
  stage: string;
  status: string;
  respondents: number;
  /** The division/group this unit declared at creation (migration 00201). */
  parentUnitLabel?: string | null;
};

/**
 * Unit hierarchy panel (migration 00200).
 *
 * A Division is composed of departments; an Enterprise is composed of
 * divisions. Linking units here is what makes the cross-unit rollup report
 * possible - it is the only place the parent/child relationship is set.
 */
export function UnitRollupPanel({
  assessmentId,
  linked,
  available,
  suggestedUnitIds = [],
  stageLabel,
}: {
  assessmentId: string;
  linked: LinkableUnit[];
  /** Same-org assessments not already parented elsewhere. */
  available: LinkableUnit[];
  /**
   * Units that named THIS engagement as their division when they were created.
   * They are the reason the division name is captured up front: a client who
   * buys departments months apart can still be grouped without anyone
   * remembering the org chart.
   */
  suggestedUnitIds?: string[];
  stageLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const suggested = available.filter((u) => suggestedUnitIds.includes(u.id));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Something went wrong");
    });
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Units in this {stageLabel.toLowerCase()}</CardTitle>
        <CardDescription>
          Each unit is assessed on its own and keeps its own report. Linking them
          here builds the comparison view - which units are behind, and where
          they differ. Two or more units are needed before the comparison says
          anything a single report does not.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units linked yet.</p>
        ) : (
          <div className="space-y-2">
            {linked.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3 bg-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] capitalize">{u.stage}</Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">{u.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {u.respondents} completed
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                    <a href={`/ara/consultant/assessments/${u.id}`}>Open</a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={pending}
                    onClick={() => run(() => unlinkUnitFromRollup(assessmentId, u.id), "Unit removed")}
                  >
                    <Unlink className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {suggested.length > 0 && (
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
            <p className="text-sm font-medium">
              {suggested.length} assessment{suggested.length === 1 ? "" : "s"} named
              this {stageLabel.toLowerCase()} when {suggested.length === 1 ? "it was" : "they were"} set up
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {suggested.map((u) => u.label).join(", ")}
            </p>
            <Button
              size="sm"
              className="mt-2 h-8"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const results = await Promise.all(
                    suggested.map((u) => linkUnitToRollup(assessmentId, u.id))
                  );
                  const failed = results.filter((r) => !r.ok);
                  if (failed.length === 0) toast.success(`Linked ${results.length} units`);
                  else toast.error(`${failed.length} of ${results.length} could not be linked: ${failed[0].error ?? ""}`);
                })
              }
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Link all {suggested.length}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending || available.length === 0}
            aria-label="Select a unit to add"
          >
            <option value="">
              {available.length === 0
                ? "No unlinked assessments in this organisation"
                : "Add a unit..."}
            </option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} ({u.stage}, {u.respondents} completed)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-9 shrink-0"
            disabled={pending || !selected}
            onClick={() => {
              const id = selected;
              setSelected("");
              run(() => linkUnitToRollup(assessmentId, id), "Unit linked");
            }}
          >
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Link
          </Button>
        </div>

        {linked.length >= 1 && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={`/ara/consultant/assessments/${assessmentId}/rollup`}>
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Open cross-unit comparison
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
