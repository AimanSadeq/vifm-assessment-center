"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ban, ChevronDown, ChevronRight, ShieldCheck, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PersonaBankCompetency } from "@/lib/persona/bank-admin";
import { setPersonaItemsStatusAction } from "../actions";

type Res = { ok: true; message?: string } | { ok: false; error: string };

function useRunner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, okMsg?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { toast.success(res.message ?? okMsg ?? "Done"); router.refresh(); }
      else toast.error(res.error);
    });
  return { pending, run };
}

const TONE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  retired: "bg-slate-100 text-slate-500 ring-slate-200",
};

function CompetencyCard({ c }: { c: PersonaBankCompetency }) {
  const { pending, run } = useRunner();
  const [open, setOpen] = useState(false);
  const allApproved = c.pending === 0 && c.items.some((i) => i.status === "approved");

  return (
    <div className={`rounded-xl border bg-card p-3 shadow-sm ${allApproved ? "border-emerald-200" : c.pending > 0 ? "border-amber-200" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex items-center gap-1.5 text-left" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-sm font-semibold text-[#010131]">{c.nameEn}</span>
          <span className="text-[11px] text-muted-foreground">· {c.clusterNameEn}</span>
        </button>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${allApproved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {allApproved ? <><ShieldCheck className="inline h-3 w-3" /> approved</> : `${c.pending}/${c.items.length} pending`}
        </span>
        {c.pending > 0 && (
          <Button size="sm" variant="outline" className="ml-auto h-7" disabled={pending}
            onClick={() => run(() => setPersonaItemsStatusAction({ status: "approved", acCompetencyId: c.acCompetencyId }), "Approved.")}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Approve competency
          </Button>
        )}
      </div>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {c.items.map((it) => (
            <li key={it.id} className="rounded-md border border-slate-200 bg-white p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${TONE[it.status] ?? "bg-sky-50 text-sky-700 ring-sky-200"}`}>{it.status}</span>
                  {it.reverse && <span className="ml-1 text-[10px] text-slate-400">reverse-keyed</span>}
                  <p className="mt-1 text-sm text-slate-800">{it.text_en}</p>
                  {it.text_ar && <p dir="rtl" className="text-xs text-slate-500">{it.text_ar}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {it.status !== "approved" && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700" title="Approve" disabled={pending}
                      onClick={() => run(() => setPersonaItemsStatusAction({ status: "approved", itemIds: [it.id] }), "Approved.")}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  {it.status !== "rejected" && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" title="Reject" disabled={pending}
                      onClick={() => run(() => setPersonaItemsStatusAction({ status: "rejected", itemIds: [it.id] }), "Rejected.")}>
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PersonaBankConsole({ competencies, totalPending }: { competencies: PersonaBankCompetency[]; totalPending: number }) {
  const { pending, run } = useRunner();
  if (competencies.length === 0) {
    return <p className="text-sm text-muted-foreground">No items yet. Seed the Persona bank (scripts/seed-persona-bank.ts), then review + approve here.</p>;
  }
  return (
    <div className="space-y-3">
      {totalPending > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5">
          <span className="text-sm text-amber-900">{totalPending} item(s) pending SME review. Results stay provisional until approved.</span>
          <Button size="sm" variant="outline" disabled={pending}
            onClick={() => run(() => setPersonaItemsStatusAction({ status: "approved", all: true }), "Approved all pending.")}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Approve all pending
          </Button>
        </div>
      )}
      {competencies.map((c) => <CompetencyCard key={c.acCompetencyId} c={c} />)}
    </div>
  );
}
