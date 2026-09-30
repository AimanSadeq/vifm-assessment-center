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
import { CHECKLISTS } from "@/lib/checklists/definitions";
import { PHASE_LABEL, type ChecklistService, type ChecklistStatus } from "@/lib/checklists/types";
import type { ChecklistSubject } from "@/lib/checklists/load";

type Row = { service: ChecklistService; subject: ChecklistSubject; status: ChecklistStatus };

export default async function ChecklistsPage({ searchParams }: { searchParams: { service?: string; all?: string } }) {
  await requireRole(["admin"]);
  const sb = createServiceClient();
  const showAll = searchParams?.all === "1";

  const [engagements, assessments] = await Promise.all([
    sb.from("engagements").select("id, status, created_at").order("created_at", { ascending: false }).limit(60)
      .then((r) => (r.data ?? []) as { id: string; status: string }[], () => []),
    // Personal snapshots (stage 'individual') are self-served, not client
    // engagements, so they have no checklist.
    sb.from("ara_assessments").select("id, status, created_at, is_sandbox, engagement_stage").neq("engagement_stage", "individual").order("created_at", { ascending: false }).limit(60)
      .then((r) => (r.data ?? []) as { id: string; status: string; is_sandbox: boolean }[], () => []),
  ]);
  const acIds = engagements.filter((e) => showAll || (e.status !== "archived")).map((e) => e.id);
  const arcIds = assessments.filter((a) => !a.is_sandbox && (showAll || (a.status !== "frozen" && a.status !== "archived"))).map((a) => a.id);

  // Each checklist is a dozen reads; run them a few at a time rather than one
  // after another, or a busy quarter makes the page crawl.
  const wanted = searchParams?.service;
  const jobs: { service: ChecklistService; id: string }[] = [
    ...(wanted !== "arc" ? acIds.map((id) => ({ service: "ac" as const, id })) : []),
    ...(wanted !== "ac" ? arcIds.map((id) => ({ service: "arc" as const, id })) : []),
  ];
  const rows: Row[] = [];
  for (let i = 0; i < jobs.length; i += 6) {
    const batch = await Promise.all(jobs.slice(i, i + 6).map(async (j) => {
      const r = await loadChecklist(sb, j.service, j.id);
      return r ? { service: j.service, ...r } : null;
    }));
    for (const r of batch) if (r) rows.push(r);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <BackLink href="/admin" label="Back to the admin portal" />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Engagement checklists</h1>
          <p className="text-sm text-muted-foreground">
            What has been done and what is missing on every live engagement, before the agreement and before delivery.
            Open an engagement to tick items or print its checklist.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[["", "All services"], ["ac", "Assessment Center"], ["arc", "AI Readiness Compass"]].map(([v, label]) => (
          <Link key={v} href={`/admin/checklists?${v ? `service=${v}&` : ""}${showAll ? "all=1" : ""}`} className={`rounded border px-3 py-1 ${(wanted ?? "") === v ? "bg-accent text-white" : "hover:bg-muted"}`}>
            {label}
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
                    <td className="py-1.5 pe-3"><Link className="text-accent hover:underline" href={subject.href}>{subject.name}</Link></td>
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
