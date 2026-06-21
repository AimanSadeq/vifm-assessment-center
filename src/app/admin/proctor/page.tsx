import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Camera } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  context: string;
  ref_id: string | null;
  subject_name: string | null;
  subject_email: string | null;
  snapshot_count: number;
  status: string;
  started_at: string;
  consent_at: string | null;
};

function fmt(ts: string | null): string {
  return ts
    ? new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "-";
}

export default async function ProctorListPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return notFound();
    throw e;
  }

  const sb = createServiceClient();
  let rows: Row[] = [];
  let tableMissing = false;
  const { data, error } = await sb
    .from("proctor_sessions")
    .select("id, context, ref_id, subject_name, subject_email, snapshot_count, status, started_at, consent_at")
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) tableMissing = true;
  else rows = (data ?? []) as Row[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/ac/fluent/cohort" label="Back to Fluent" />
      <div className="mt-4 flex items-center gap-2">
        <Camera className="h-5 w-5 text-[#5391D5]" />
        <h1 className="text-2xl font-bold text-[#010131]">Proctoring sessions</h1>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Camera-proctoring sessions (Phase 1: consented periodic snapshots, no continuous recording). Snapshots are
        stored securely and auto-deleted after 90 days.
      </p>

      {tableMissing ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-medium">Table not migrated yet.</div>
            <div className="mt-1 text-amber-800">
              Apply migration <code>00147_proctor_sessions.sql</code> to enable proctoring.
            </div>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No proctoring sessions yet. They appear here when a candidate takes a proctored test (a test launched with
          proctoring enabled).
        </p>
      ) : (
        <div className="mt-6 divide-y rounded-lg border">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/admin/proctor/${r.id}`}
              className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[#010131]">{r.subject_name || "Anonymous taker"}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {r.context}
                  </span>
                  {r.status !== "active" && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
                      ended
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.subject_email ? `${r.subject_email} · ` : ""}
                  {fmt(r.started_at)} · {r.snapshot_count} snapshot{r.snapshot_count === 1 ? "" : "s"}
                </div>
              </div>
              <span className="shrink-0 text-xs text-[#5391D5]">View report →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
