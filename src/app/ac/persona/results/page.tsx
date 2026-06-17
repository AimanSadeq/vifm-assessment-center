import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, FileText, Target, GraduationCap } from "lucide-react";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { listPersonaResults } from "@/lib/scoring/persona-results";
import { fitBand, FIT_BAND_TW } from "@/lib/scoring/persona-fit";
import { personaBand, PERSONA_BAND_TW } from "@/lib/scoring/persona-bands";

export const dynamic = "force-dynamic";
export const metadata = { title: "Persona · Completed results" };

export default async function PersonaResultsPage({ searchParams }: { searchParams?: { org?: string } }) {
  // Admin-only: this surfaces candidate names, fit scores and report links.
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const all = await listPersonaResults();
  const orgFilter = searchParams?.org?.trim() || null;
  const rows = all && orgFilter ? all.filter((r) => r.orgName === orgFilter) : all;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <Link href="/ac/persona" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to Persona
          </Link>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">Completed Persona results</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Completed sittings (voucher and self-served). Hiring sittings show the role-fit score; the
            report PDF carries the full per-competency detail. Results are a screening signal - pair
            Persona (self) with a 360 (others) and an interview before any decision.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {rows === null && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>No result store.</strong> Apply migration{" "}
            <code className="text-xs">00094_behavioral_assessment.sql</code> to enable results.
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
            No completed Persona results yet. Issue a voucher from{" "}
            <Link href="/ac/persona/vouchers" className="text-[#5391D5] underline">Vouchers</Link>{" "}
            or run one from <Link href="/ac/persona" className="text-[#5391D5] underline">Persona</Link>.
          </div>
        )}

        {/* Client filter chips */}
        {all && all.length > 0 && (() => {
          const clients = Array.from(new Set(all.map((r) => r.orgName).filter((n): n is string => !!n))).sort();
          if (clients.length === 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Client:</span>
              <Link
                href="/ac/persona/results"
                className={`rounded-full border px-2.5 py-0.5 ${!orgFilter ? "border-[#5391D5] bg-[#5391D5]/10 font-medium text-[#5391D5]" : "text-slate-600 hover:bg-slate-100"}`}
              >
                All
              </Link>
              {clients.map((c) => (
                <Link
                  key={c}
                  href={`/ac/persona/results?org=${encodeURIComponent(c)}`}
                  className={`rounded-full border px-2.5 py-0.5 ${orgFilter === c ? "border-[#5391D5] bg-[#5391D5]/10 font-medium text-[#5391D5]" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {c}
                </Link>
              ))}
            </div>
          );
        })()}

        {rows !== null && rows.length > 0 && (
          <section className="rounded-xl border bg-white shadow-sm">
            <h2 className="border-b px-6 py-4 text-sm font-semibold text-[#010131]">
              {rows.length} completed sitting{rows.length === 1 ? "" : "s"}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 font-medium">Purpose</th>
                    <th className="px-4 py-2.5 font-medium">Target role</th>
                    <th className="px-3 py-2.5 text-center font-medium">Fit</th>
                    <th className="px-3 py-2.5 text-center font-medium">Self-rating</th>
                    <th className="px-4 py-2.5 font-medium">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                        {new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[#111232]">{r.takerName || <span className="text-slate-400">Anonymous</span>}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.orgName ?? <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          {r.purpose === "hiring" ? <Target className="h-3.5 w-3.5 text-[#5391D5]" /> : <GraduationCap className="h-3.5 w-3.5 text-slate-400" />}
                          {r.purpose === "hiring" ? "Hiring" : "Development"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{r.roleName ?? <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.fitPct != null && r.fitBand ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${FIT_BAND_TW[r.fitBand]}`}>
                            {r.fitPct}% · {fitBand(r.fitPct).label}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.overall != null ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${PERSONA_BAND_TW[personaBand(r.overall).key]}`}>
                            {r.overall.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.itemCount > 0 ? (
                          <a
                            href={`/api/ac/persona/${r.id}/report`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" /> Open report
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t px-6 py-3 text-xs text-muted-foreground">
              Self-rating is the overall mean across the assessed competencies; Fit is the weighted
              match against the target role.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
