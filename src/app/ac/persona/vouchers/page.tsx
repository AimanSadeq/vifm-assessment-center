import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, ArrowRight, Ticket, FileText } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { loadPersonaRoleOptions } from "@/lib/scoring/persona-roles";
import { personaResultCountsByClient, personaVoucherActivity } from "@/lib/scoring/persona-results";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { BackLink } from "@/components/shared/back-link";
import { VoucherNav } from "@/components/shared/voucher-nav";
import { VouchersClient, type PersonaVoucherRow } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Persona® vouchers · VIFM" };

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function statusBadge(status: "completed" | "in_progress" | "not_started") {
  if (status === "completed") return <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Completed</span>;
  if (status === "in_progress") return <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">In progress</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">Not started</span>;
}

export default async function PersonaVouchersPage() {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const sb = createServiceClient();
  const { data: vouchers } = await sb
    .from("persona_vouchers")
    .select("id, code, label, client_name, default_language, max_uses, used_count, status, expires_at, created_at")
    .order("created_at", { ascending: false })
    .returns<PersonaVoucherRow[]>();
  const clients = await loadPlatformClients();

  // SD-1 scoping inputs: role profiles (with their competency ids, to pre-fill
  // the scope) + the Persona competency catalogue (grouped by cluster).
  const roleOptions = (await loadPersonaRoleOptions()).map((r) => ({
    id: r.id,
    name: r.name,
    competencyIds: r.comps.map((c) => c.competencyId),
  }));
  const personaCompetencies = BEHAVIORAL_COMPETENCIES.map((c) => ({
    id: c.acCompetencyId,
    name: c.nameEn,
    clusterOrder: c.clusterOrder,
    clusterName: c.clusterNameEn,
  }));

  // Discoverability: connect "I issued vouchers to this client" straight to
  // "here are their completed results" (each chip deep-links to the filtered
  // results page). This is the surface the admin lands on after issuing.
  const resultCounts = await personaResultCountsByClient();
  const totalCompleted = resultCounts.reduce((n, c) => n + c.completed, 0);
  const activity = await personaVoucherActivity();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink href="/ac/persona" label="Persona®" />
      <div className="mt-4 mb-6">
        <VoucherNav active="persona" />
      </div>

      <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#010131]">
            <ClipboardCheck className="h-4 w-4 text-[#5391D5]" />
            Completed results{totalCompleted > 0 ? ` (${totalCompleted})` : ""}
          </h2>
          <Link href="/ac/persona/results" className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline">
            View all results <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {resultCounts.length > 0 ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {resultCounts.map((c) => (
                <Link
                  key={c.client}
                  href={`/ac/persona/results?org=${encodeURIComponent(c.client)}`}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition hover:border-[#5391D5] hover:bg-[#5391D5]/5"
                >
                  <span className="font-medium text-[#111232]">{c.client}</span>
                  <span className="text-xs font-semibold text-emerald-700">{c.completed} completed</span>
                  {c.inProgress > 0 && <span className="text-xs text-amber-600">· {c.inProgress} in progress</span>}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Delegates&rsquo; sittings land here once submitted - click a client to open their results and report PDFs.
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            No completed sittings yet. Once delegates redeem a voucher and submit, results appear here grouped by client.
          </p>
        )}
      </div>

      {activity.some((v) => v.redeemers.length > 0) && (
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#010131]">
            <Ticket className="h-4 w-4 text-[#5391D5]" /> Voucher activity - when issued, to whom, and who completed
          </h2>
          <div className="mt-3 space-y-3">
            {activity
              .filter((v) => v.redeemers.length > 0)
              .map((v) => (
                <div key={v.code} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-mono text-xs font-semibold text-[#010131]">{v.code}</span>
                      <span className="font-medium text-slate-700">{v.clientName ?? "-"}</span>
                      {v.contactName && (
                        <span className="text-xs text-slate-500">
                          contact: {v.contactName}{v.contactEmail ? ` <${v.contactEmail}>` : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Issued {fmtDateTime(v.createdAt)} · {v.usedCount}/{v.maxUses} seats used
                    </div>
                  </div>
                  <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                    {v.redeemers.map((d, i) => (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-[#111232]">{d.name || "Anonymous"}</span>
                          {d.email && <span className="ml-2 text-xs text-slate-400">{d.email}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400">redeemed {fmtDateTime(d.redeemedAt)}</span>
                          {statusBadge(d.status)}
                          {d.status === "completed" && d.resultId && (
                            <a
                              href={`/api/ac/persona/${d.resultId}/report`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[#5391D5] hover:underline"
                            >
                              <FileText className="h-3 w-3" /> Report
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <VouchersClient
        vouchers={vouchers ?? []}
        clients={clients.map((c) => c.name)}
        roleOptions={roleOptions}
        personaCompetencies={personaCompetencies}
      />
    </div>
  );
}
