import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getSessionWithSnapshots } from "@/lib/proctor/access";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

function fmt(ts: string | null): string {
  return ts
    ? new Date(ts).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "-";
}

export default async function ProctorReportPage({ params }: { params: { sessionId: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return notFound();
    throw e;
  }

  const view = await getSessionWithSnapshots(params.sessionId);
  if (!view) return notFound();
  const { session, snapshots } = view;

  const durationMin = session.ended_at
    ? Math.max(0, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000))
    : null;

  const Meta = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-[#010131]">{value}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/admin/proctor" label="Back to proctoring sessions" />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#010131]">Proctoring report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.subject_name || "Anonymous taker"}
            {session.subject_email ? ` · ${session.subject_email}` : ""} · {session.context}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            session.status === "active"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {session.status === "active" ? "Active" : "Ended"}
        </span>
      </div>

      {/* Session metadata */}
      <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-4">
        <Meta label="Started" value={fmt(session.started_at)} />
        <Meta label="Ended" value={fmt(session.ended_at)} />
        <Meta label="Duration" value={durationMin === null ? "-" : `${durationMin} min`} />
        <Meta label="Snapshots" value={String(session.snapshot_count)} />
        <Meta label="Reference" value={session.ref_id || "-"} />
        <Meta label="Consented at" value={fmt(session.consent_at)} />
        <Meta label="Auto-delete after" value={fmt(session.expires_at)} />
      </div>

      {/* Consent record */}
      {session.consent_text && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <div className="font-medium">Consent recorded</div>
            <div className="mt-1 text-emerald-800">{session.consent_text}</div>
          </div>
        </div>
      )}

      {/* Snapshot grid */}
      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Snapshots ({snapshots.length})
      </h2>
      {snapshots.length === 0 ? (
        <p className="mt-2 rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No snapshots were captured for this session.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {snapshots.map((snap) => (
            <div key={snap.id} className="overflow-hidden rounded-lg border bg-card">
              {snap.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={snap.signedUrl} alt={`Snapshot ${snap.sequence}`} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  image unavailable
                </div>
              )}
              <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-muted-foreground">
                <span>#{snap.sequence}</span>
                <span>
                  {new Date(snap.captured_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs italic text-muted-foreground">
        Phase 1: consented periodic snapshots for human integrity review. Automated flags (no-face / multiple faces /
        off-screen / movement) are a later phase. Images auto-delete 90 days after the test.
      </p>
    </div>
  );
}
