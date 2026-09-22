"use client";

/**
 * What the participant was told about their results (BPS 8.21).
 *
 * An oral session is the most useful thing a centre gives someone and the
 * easiest to misremember, so the written record of it belongs where they can
 * find it again - not only in the assessor's notes.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LocalDate } from "@/components/shared/local-date";
import { acknowledgeFeedbackAction } from "../actions";

type Row = Record<string, unknown>;

export function FeedbackReceived({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (rows.length === 0) return null;

  const confirm = async (id: string) => {
    setBusy(id);
    const res = await acknowledgeFeedbackAction(id);
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That could not be saved.");
      return;
    }
    toast.success("Thank you.");
    router.refresh();
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
      <div className="font-medium text-foreground">Your feedback</div>
      {rows.map((r) => (
        <div key={r.id as string} className="rounded border bg-background p-3">
          <div className="text-xs text-muted-foreground">
            {(r.form as string) === "written_report"
              ? "A written report"
              : (r.form as string) === "oral"
                ? "A conversation"
                : "A report and a conversation"}{" "}
            · <LocalDate value={r.delivered_at as string} /> · {r.delivered_by_name as string}
          </div>
          {r.summary ? <p className="mt-1 whitespace-pre-wrap">{r.summary as string}</p> : null}
          {r.acknowledged_at ? (
            <p className="mt-2 text-xs text-muted-foreground">
              You confirmed you received this on <LocalDate value={r.acknowledged_at as string} />.
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={busy === (r.id as string)}
              onClick={() => confirm(r.id as string)}
            >
              Confirm I received this
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
