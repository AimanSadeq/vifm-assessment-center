"use client";

/**
 * The engagement checklist, as seen on an engagement and printed for a
 * signing meeting. Automatic items show what the record says; manual items
 * are ticked here with a note. Every item names its owner, so business
 * development can read the list without knowing the platform.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLocalDate } from "@/components/shared/local-date";
import { setChecklistItemAction } from "@/app/admin/checklists/actions";
import { OWNER_LABEL, type ChecklistStatus, type ChecklistService } from "@/lib/checklists/types";

const OWNER_TONE: Record<string, string> = {
  bd: "bg-violet-100 text-violet-900",
  consultant: "bg-sky-100 text-sky-900",
  admin: "bg-slate-200 text-slate-800",
  client: "bg-amber-100 text-amber-900",
};

export function ServiceChecklist({
  service,
  subjectId,
  status,
  serviceLabel,
  canTick,
  compact = false,
}: {
  service: ChecklistService;
  subjectId: string;
  status: ChecklistStatus;
  serviceLabel: string;
  canTick: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(!compact);

  const tick = async (itemKey: string, done: boolean, withNote?: string) => {
    setBusy(itemKey);
    const res = await setChecklistItemAction({ service, subjectId, itemKey, done, note: withNote });
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(res.error, { duration: 8000 });
      return;
    }
    toast.success(done ? "Ticked." : "Unticked.");
    setNoteFor(null);
    setNote("");
    router.refresh();
  };

  const pct = status.total ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          Engagement checklist
          <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {status.done} of {status.total} · {pct}%
          </span>
          {status.currentPhase === null ? (
            <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-900">Complete</span>
          ) : (
            <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900">
              Open items in: {status.phases.find((p) => p.phase === status.currentPhase)?.label}
            </span>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/admin/checklists/${service}/${subjectId}/pdf`}>Print (PDF)</a>
          </Button>
          {compact && (
            <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide" : "Show"}
            </Button>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5 text-sm">
          <p className="text-muted-foreground">
            The {serviceLabel} process from first conversation to close, with an owner for every step. Items marked
            <span className="mx-1 rounded bg-emerald-100 px-1 text-xs text-emerald-900">record</span>
            are read from the platform and tick themselves; the rest are ticked here by the person responsible.
          </p>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          {status.phases.map((phase) => (
            <section key={phase.phase} className="space-y-1">
              <h3 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {phase.label}
                <span className="font-normal normal-case tracking-normal">{phase.done} of {phase.total}</span>
              </h3>
              {phase.items.map((it) => (
                <div key={it.key} className={`rounded border p-2 ${it.done ? "bg-emerald-50/40" : ""}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={it.done}
                      disabled={!canTick || busy === it.key || (it.done && it.source === "auto")}
                      title={it.done && it.source === "auto" ? "Read from the record; it cannot be unticked here" : undefined}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNoteFor(it.key);
                          setNote("");
                        } else {
                          void tick(it.key, false);
                        }
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={it.done ? "text-muted-foreground line-through decoration-emerald-600/40" : "font-medium"}>{it.label}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${OWNER_TONE[it.owner]}`}>{OWNER_LABEL[it.owner]}</span>
                        {it.auto && <span className="rounded bg-emerald-100 px-1 text-[10px] text-emerald-900">record</span>}
                        {it.href && (
                          <a className="text-xs text-accent hover:underline" href={it.href}>Go</a>
                        )}
                      </div>
                      {(it.detail || it.hint) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {it.detail ?? it.hint}
                        </p>
                      )}
                      {it.source === "manual" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Ticked{it.doneBy ? ` by ${it.doneBy}` : ""}{it.doneAt ? ` on ${formatLocalDate(it.doneAt)}` : ""}{it.note ? `: ${it.note}` : ""}
                        </p>
                      )}
                      {!it.done && it.note && <p className="mt-0.5 text-xs text-muted-foreground">Note: {it.note}</p>}
                      {noteFor === it.key && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input
                            className="max-w-[24rem]"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Note (optional): where the evidence is, or what was agreed"
                          />
                          <Button size="sm" disabled={busy === it.key} onClick={() => tick(it.key, true, note)}>Tick</Button>
                          <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
