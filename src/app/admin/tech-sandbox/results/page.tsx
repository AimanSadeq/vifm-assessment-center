import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listSubmittedSessions } from "@/lib/technical-sandbox/service";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

const bandClass = (b: string | null) =>
  b === "advanced"
    ? "bg-emerald-100 text-emerald-800"
    : b === "intermediate"
      ? "bg-sky-100 text-sky-800"
      : "bg-orange-100 text-orange-800";

export default async function TechResultsListPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const rows = await listSubmittedSessions();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <BackLink href="/admin/tech-sandbox" label="Technical Assessment" history />
      <header>
        <h1 className="text-2xl font-semibold text-[#010131]">Completed sittings</h1>
        <p className="text-sm text-muted-foreground">
          Candidate results are not shown to the candidate; open a sitting to review the development
          report (definitions + per-category/subcategory bands + narrative) and download the PDF.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No completed sittings yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Candidate</th>
                <th className="px-4 py-2">Function</th>
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Completed</th>
                <th className="px-4 py-2 text-right">Overall</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s) => (
                <tr key={s.token} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <div className="font-medium text-[#121232]">{s.candidateName ?? "Candidate"}</div>
                    {s.candidateEmail ? (
                      <div className="text-xs text-muted-foreground">{s.candidateEmail}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-[#121232]">
                    {s.nodeId ? `${s.nodeId} · ` : ""}
                    {s.functionName}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{s.organizationName ?? "-"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.overallPct != null ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${bandClass(s.overallBand)}`}>
                        {s.overallPct}%
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/tech-sandbox/results/${s.token}`}
                      className="text-sm font-medium text-[#5391D5] hover:underline"
                    >
                      View report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
