export const dynamic = "force-dynamic";

/**
 * Every live engagement with its checklist completion, so business
 * development, consultants and admin can see at a glance what is missing
 * before signature and before delivery. Admin only.
 */

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/shared/back-link";
import { loadChecklist } from "@/lib/checklists/load";
import { CHECKLISTS, isChecklistService } from "@/lib/checklists/definitions";
import { CHECKLIST_SERVICES, PHASE_LABEL, type ChecklistService, type ChecklistStatus } from "@/lib/checklists/types";
import { listVoucherSubjects, isVoucherService } from "@/lib/checklists/voucher-facts";
import type { ChecklistSubject } from "@/lib/checklists/load";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = { service: ChecklistService; subject: ChecklistSubject; status: ChecklistStatus };
type Lite = { id: string; status?: string; is_sandbox?: boolean };

const PER_SERVICE = 25;

const ids = (p: PromiseLike<{ data: unknown[] | null }>) => Promise.resolve(p).then((r) => (r.data ?? []) as Lite[], () => [] as Lite[]);

/** The most recent subjects of one service, open ones only unless `showAll`. */
async function listSubjects(sb: SupabaseClient, service: ChecklistService, showAll: boolean): Promise<string[]> {
  switch (service) {
    case "ac": {
      const rows = await ids(sb.from("engagements").select("id, status").order("created_at", { ascending: false }).limit(60));
      return rows.filter((e) => showAll || e.status !== "archived").map((e) => e.id).slice(0, PER_SERVICE);
    }
    case "arc": {
      // Personal snapshots (stage 'individual') are self-served, not client
      // engagements, so they have no checklist.
      const rows = await ids(sb.from("ara_assessments").select("id, status, is_sandbox").neq("engagement_stage", "individual").order("created_at", { ascending: false }).limit(60));
      return rows.filter((a) => !a.is_sandbox && (showAll || (a.status !== "frozen" && a.status !== "archived"))).map((a) => a.id).slice(0, PER_SERVICE);
    }
    case "reflect": {
      const rows = await ids(sb.from("reflect_engagements").select("id, status, is_sandbox").order("created_at", { ascending: false }).limit(60));
      return rows.filter((e) => !e.is_sandbox && (showAll || (e.status !== "archived" && e.status !== "complete"))).map((e) => e.id).slice(0, PER_SERVICE);
    }
    case "prehire": {
      const rows = await ids(sb.from("prehire_requisitions").select("id, status").order("created_at", { ascending: false }).limit(60));
      return rows.filter((r) => showAll || (r.status !== "closed" && r.status !== "archived")).map((r) => r.id).slice(0, PER_SERVICE);
    }
    default:
      return isVoucherService(service) ? listVoucherSubjects(sb, service, !showAll, PER_SERVICE) : [];
  }
}

export default async function ChecklistsPage({ searchParams }: { searchParams: { service?: string; all?: string } }) {
  await requireRole(["admin"]);
  const sb = createServiceClient();
  const showAll = searchParams?.all === "1";
  const wanted = searchParams?.service && isChecklistService(searchParams.service) ? searchParams.service : null;
  const services = wanted ? [wanted] : CHECKLIST_SERVICES;

  const lists = await Promise.all(services.map(async (service) => ({ service, ids: await listSubjects(sb, service, showAll) })));
  const jobs = lists.flatMap((l) => l.ids.map((id) => ({ service: l.service, id })));

  // Each checklist is a dozen reads; run them a few at a time rather than one
  // after another, or a busy quarter makes the page crawl.
  const rows: Row[] = [];
  for (let i = 0; i < jobs.length; i += 6) {
    const batch = await Promise.all(jobs.slice(i, i + 6).map(async (j) => {
      const r = await loadChecklist(sb, j.service, j.id);
      return r ? { service: j.service, ...r } : null;
    }));
    for (const r of batch) if (r) rows.push(r);
  }

  const filterHref = (service: string) => `/admin/checklists?${service ? `service=${service}&` : ""}${showAll ? "all=1" : ""}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <BackLink href="/admin" label="Back to the admin portal" />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Engagement checklists</h1>
          <p className="text-sm text-muted-foreground">
            What has been done and what is missing on every live engagement, before the agreement and before delivery.
            Open an engagement to tick items or print its checklist. The four voucher-based services show one line per issuance.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={filterHref("")} className={`rounded border px-3 py-1 ${wanted === null ? "bg-accent text-white" : "hover:bg-muted"}`}>All services</Link>
        {CHECKLIST_SERVICES.map((s) => (
          <Link key={s} href={filterHref(s)} className={`rounded border px-3 py-1 ${wanted === s ? "bg-accent text-white" : "hover:bg-muted"}`}>
            {CHECKLISTS[s].serviceLabel}
          </Link>
        ))}
        <Link href={`/admin/checklists?${wanted ? `service=${wanted}&` : ""}${showAll ? "" : "all=1"}`} className="rounded border px-3 py-1 hover:bg-muted">
          {showAll ? "Hide closed" : "Include closed"}
        </Link>
        <Link href="/admin/checklists/master" className="ms-auto rounded border px-3 py-1 hover:bg-muted">The master checklists</Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live engagements.</p>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{rows.length} engagement{rows.length === 1 ? "" : "s"}</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pe-3">Service</th>
                  <th className="py-1 pe-3">Engagement</th>
                  <th className="py-1 pe-3">Client</th>
                  <th className="py-1 pe-3">Status</th>
                  {Object.entries(PHASE_LABEL).map(([k, l]) => <th key={k} className="py-1 pe-3 text-center">{l}</th>)}
                  <th className="py-1 pe-3">Next open phase</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ service, subject, status }) => (
                  <tr key={`${service}-${subject.id}`} className="border-t">
                    <td className="py-1.5 pe-3 text-xs">{CHECKLISTS[service].serviceLabel}</td>
                    <td className="py-1.5 pe-3">
                      <Link className="text-accent hover:underline" href={`/admin/checklists/${service}/${subject.id}`}>{subject.name}</Link>
                    </td>
                    <td className="py-1.5 pe-3 text-muted-foreground">{subject.organisationName ?? "-"}</td>
                    <td className="py-1.5 pe-3 text-xs">{subject.status}</td>
                    {Object.keys(PHASE_LABEL).map((k) => {
                      const p = status.phases.find((x) => x.phase === k);
                      if (!p) return <td key={k} className="py-1.5 pe-3 text-center text-muted-foreground">-</td>;
                      const full = p.done === p.total;
                      return (
                        <td key={k} className="py-1.5 pe-3 text-center">
                          <span className={`rounded px-1.5 py-0.5 text-xs ${full ? "bg-emerald-100 text-emerald-900" : p.done ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"}`}>{p.done}/{p.total}</span>
                        </td>
                      );
                    })}
                    <td className="py-1.5 pe-3 text-xs">
                      {status.currentPhase ? status.phases.find((p) => p.phase === status.currentPhase)?.label : <span className="text-emerald-800">Complete</span>}
                      {!subject.href.startsWith("/admin/checklists/") && (
                        <Link className="ms-2 text-accent hover:underline" href={subject.href}>Open</Link>
                      )}
                      <a className="ms-2 text-accent hover:underline" href={`/api/admin/checklists/${service}/${subject.id}/pdf`}>PDF</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
