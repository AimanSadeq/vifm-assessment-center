"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ban, ChevronDown, ChevronRight, ShieldCheck, CheckCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PersonaBankCompetency, PersonaBankItem, PersonaBankCluster, PersonaBankDomain } from "@/lib/persona/bank-admin";
import { DOMAIN_DEFINITIONS, CLUSTER_DEFINITIONS, DOMAIN_VISUALS } from "@/lib/competencies/framework-definitions";
import { setPersonaItemsStatusAction, updatePersonaItemAction } from "../actions";

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

/** Collect all pending item ids under a cluster (for bulk approve). */
function pendingIds(competencies: PersonaBankCompetency[]): string[] {
  return competencies.flatMap((c) => c.items.filter((i) => i.status === "pending").map((i) => i.id));
}

function ItemRow({ item }: { item: PersonaBankItem }) {
  const { pending, run } = useRunner();
  const [editing, setEditing] = useState(false);
  const [en, setEn] = useState(item.text_en);
  const [ar, setAr] = useState(item.text_ar ?? "");
  const [rev, setRev] = useState(item.reverse);

  if (editing) {
    return (
      <li className="space-y-2 rounded-md border border-sky-300 bg-sky-50/50 p-2">
        <textarea className="w-full rounded border border-input bg-background px-2 py-1 text-sm" rows={2} value={en} onChange={(e) => setEn(e.target.value)} placeholder="English item text" />
        <textarea dir="rtl" className="w-full rounded border border-input bg-background px-2 py-1 text-xs" rows={2} value={ar} onChange={(e) => setAr(e.target.value)} placeholder="Arabic (MSA)" />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={rev} onChange={(e) => setRev(e.target.checked)} /> reverse-keyed
        </label>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending}
            onClick={() => run(() => updatePersonaItemAction({ itemId: item.id, text_en: en, text_ar: ar, reverse: rev }).then((r) => { if (r.ok) setEditing(false); return r; }))}>
            Save
          </Button>
          <Button size="sm" variant="outline" disabled={pending}
            onClick={() => { setEn(item.text_en); setAr(item.text_ar ?? ""); setRev(item.reverse); setEditing(false); }}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-slate-200 bg-white p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${TONE[item.status] ?? "bg-sky-50 text-sky-700 ring-sky-200"}`}>{item.status}</span>
          {item.reverse && <span className="ml-1 text-[10px] text-slate-400">reverse-keyed</span>}
          <p className="mt-1 text-sm text-slate-800">{item.text_en}</p>
          {item.text_ar && <p dir="rtl" className="text-xs text-slate-500">{item.text_ar}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-sky-700" title="Edit" disabled={pending} onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {item.status !== "approved" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700" title="Approve" disabled={pending}
              onClick={() => run(() => setPersonaItemsStatusAction({ status: "approved", itemIds: [item.id] }), "Approved.")}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          {item.status !== "rejected" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" title="Reject" disabled={pending}
              onClick={() => run(() => setPersonaItemsStatusAction({ status: "rejected", itemIds: [item.id] }), "Rejected.")}>
              <Ban className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function CompetencyCard({ c }: { c: PersonaBankCompetency }) {
  const { pending, run } = useRunner();
  const [open, setOpen] = useState(false);
  const allApproved = c.pending === 0 && c.items.some((i) => i.status === "approved");

  return (
    <div className={`rounded-lg border bg-card p-3 shadow-sm ${allApproved ? "border-emerald-200" : c.pending > 0 ? "border-amber-200" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex items-center gap-1.5 text-left" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-sm font-semibold text-[#010131]">{c.nameEn}</span>
          {c.nameAr && <span className="text-[11px] text-muted-foreground" dir="rtl">{c.nameAr}</span>}
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
          {c.items.map((it) => <ItemRow key={it.id} item={it} />)}
        </ul>
      )}
    </div>
  );
}

function ClusterBlock({ cluster }: { cluster: PersonaBankCluster }) {
  const { pending, run } = useRunner();
  const def = CLUSTER_DEFINITIONS[cluster.clusterNameEn];
  const ids = pendingIds(cluster.competencies);
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-[#1A3A6B]">{cluster.clusterNameEn}</h4>
        {cluster.clusterNameAr && <span className="text-[11px] text-muted-foreground" dir="rtl">{cluster.clusterNameAr}</span>}
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] tabular-nums text-slate-600 ring-1 ring-slate-200">
          {cluster.competencies.length} competencies · {cluster.approved}/{cluster.total} approved
        </span>
        {cluster.pending > 0 && (
          <Button size="sm" variant="outline" className="ml-auto h-7" disabled={pending}
            onClick={() => run(() => setPersonaItemsStatusAction({ status: "approved", itemIds: ids }), "Approved cluster.")}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Approve cluster ({cluster.pending})
          </Button>
        )}
      </div>
      {def && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{def}</p>}
      <div className="mt-2.5 space-y-2">
        {cluster.competencies.map((c) => <CompetencyCard key={c.acCompetencyId} c={c} />)}
      </div>
    </section>
  );
}

function DomainBlock({ domain }: { domain: PersonaBankDomain }) {
  const { pending, run } = useRunner();
  const [open, setOpen] = useState(true);
  const visual = DOMAIN_VISUALS[domain.domain];
  const def = DOMAIN_DEFINITIONS[domain.domain];
  const ids = domain.clusters.flatMap((cl) => pendingIds(cl.competencies));
  const clusterCount = domain.clusters.length;
  const compCount = domain.clusters.reduce((s, cl) => s + cl.competencies.length, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <button
        className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-white"
        style={{ background: visual?.color ?? "#010131" }}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-4 w-4 opacity-90" /> : <ChevronRight className="h-4 w-4 opacity-90" />}
        <span className="text-base font-semibold tracking-wide">{domain.domain}</span>
        {visual?.captionEn && <span className="text-[11px] font-normal opacity-80">{visual.captionEn}</span>}
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] tabular-nums">
          {clusterCount} clusters · {compCount} competencies · {domain.approved}/{domain.total} approved
        </span>
        {domain.pending > 0 && (
          <span
            role="button"
            tabIndex={0}
            aria-disabled={pending}
            onClick={(e) => { e.stopPropagation(); if (!pending) run(() => setPersonaItemsStatusAction({ status: "approved", itemIds: ids }), "Approved domain."); }}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-[#010131] hover:bg-white disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Approve domain ({domain.pending})
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-3 bg-card p-3">
          {def && <p className="text-[11px] leading-relaxed text-muted-foreground">{def}</p>}
          {domain.clusters.map((cl) => <ClusterBlock key={cl.clusterOrder} cluster={cl} />)}
        </div>
      )}
    </div>
  );
}

export function PersonaBankConsole({ domains, totalPending }: { domains: PersonaBankDomain[]; totalPending: number }) {
  const { pending, run } = useRunner();
  if (domains.length === 0) {
    return <p className="text-sm text-muted-foreground">No items yet. Seed the Persona bank (scripts/seed-persona-bank.ts), then review + approve here.</p>;
  }
  return (
    <div className="space-y-4">
      {totalPending > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5">
          <span className="text-sm text-amber-900">{totalPending} item(s) pending SME review. Results stay provisional until approved.</span>
          <Button size="sm" variant="outline" disabled={pending}
            onClick={() => run(() => setPersonaItemsStatusAction({ status: "approved", all: true }), "Approved all pending.")}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Approve all pending
          </Button>
        </div>
      )}
      {domains.map((d) => <DomainBlock key={d.domain} domain={d} />)}
    </div>
  );
}
