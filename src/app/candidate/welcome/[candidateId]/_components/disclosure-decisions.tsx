"use client";

/**
 * Someone outside the agreed list has asked for this participant's report
 * (BPS 8.13). The decision is theirs, so this is the only place it can be
 * made, and a refusal is recorded rather than simply ignored.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LocalDate } from "@/components/shared/local-date";
import { decideDisclosureAction } from "../actions";

type Row = Record<string, unknown>;

export function DisclosureDecisions({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (rows.length === 0) return null;
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  const decide = async (id: string, status: "granted" | "refused" | "withdrawn") => {
    setBusy(id);
    const res = await decideDisclosureAction({ disclosureId: id, status, note: notes[id] ?? "" });
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(typeof res.error === "string" ? res.error : "That could not be saved.");
      return;
    }
    toast.success(
      status === "granted"
        ? "Permission given."
        : status === "withdrawn"
          ? "Permission withdrawn."
          : "Recorded. They will not be given your report."
    );
    router.refresh();
  };

  return (
    <div className="space-y-3 rounded-lg border p-4 text-sm">
      <div className="font-medium">Requests to see your report</div>

      {pending.map((r) => (
        <div key={r.id as string} className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p>
            <span className="font-medium">{r.recipient_name as string}</span>
            {r.recipient_role ? ` (${r.recipient_role as string})` : ""} has asked to see your assessment report.
          </p>
          <p className="mt-1">Why: {r.reason as string}</p>
          <p className="mt-1 text-xs">
            It is your decision. Saying no does not affect your results or how you are treated.
          </p>
          <Textarea
            className="mt-2 bg-white"
            rows={2}
            value={notes[r.id as string] ?? ""}
            onChange={(e) => setNotes((p) => ({ ...p, [r.id as string]: e.target.value }))}
            placeholder="Anything you want to add. Optional."
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={busy === (r.id as string)} onClick={() => decide(r.id as string, "granted")}>
              Yes, they may see it
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy === (r.id as string)}
              onClick={() => decide(r.id as string, "refused")}
            >
              No
            </Button>
          </div>
        </div>
      ))}

      {decided.map((r) => (
        <div key={r.id as string} className="rounded border p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{r.recipient_name as string}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${
                r.status === "granted" ? "bg-emerald-100 text-emerald-900" : "bg-muted text-muted-foreground"
              }`}
            >
              {r.status === "granted" ? "You said yes" : r.status === "withdrawn" ? "Permission withdrawn" : "You said no"}
            </span>
            {r.decided_at ? (
              <span className="text-xs text-muted-foreground">
                <LocalDate value={r.decided_at as string} />
              </span>
            ) : null}
          </div>
          {r.status === "granted" && !r.released_at && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={busy === (r.id as string)}
              onClick={() => decide(r.id as string, "withdrawn")}
            >
              Change my mind
            </Button>
          )}
          {r.released_at ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Report shared on <LocalDate value={r.released_at as string} />.
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
