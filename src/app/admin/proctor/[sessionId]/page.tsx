import { notFound } from "next/navigation";
import { ShieldCheck, ScanFace, FileDown } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getSessionWithSnapshots, type SnapshotFlags } from "@/lib/proctor/access";
import { BackLink } from "@/components/shared/back-link";
import { ReviewButton } from "./_components/review-button";

export const dynamic = "force-dynamic";

const HIGH_MOTION = 25;

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

type Chip = { label: string; tone: "rose" | "amber" };

function flagChips(flags: SnapshotFlags | null): Chip[] {
  const chips: Chip[] = [];
  if (typeof flags?.faces === "number") {
    if (flags.faces === 0) chips.push({ label: "no face", tone: "rose" });
    else if (flags.faces >= 2) chips.push({ label: `${flags.faces} faces`, tone: "rose" });
  }
  if (flags?.device_or_screen) chips.push({ label: "device", tone: "rose" });
  if (flags?.looking_away) chips.push({ label: "looking away", tone: "amber" });
  if (typeof flags?.motion === "number" && flags.motion >= HIGH_MOTION) {
    chips.push({ label: `motion ${flags.motion}`, tone: "amber" });
  }
  return chips;
}

function borderTone(chips: Chip[]): string {
  if (chips.some((c) => c.tone === "rose")) return "border-rose-300";
  if (chips.some((c) => c.tone === "amber")) return "border-amber-300";
  return "";
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

  const SummaryStat = ({ label, n }: { label: string; n: number }) => (
    <div className={`rounded-lg border px-3 py-2 ${n > 0 ? "border-rose-200 bg-rose-50" : "bg-muted/30"}`}>
      <div className="text-lg font-bold tabular-nums text-[#010131]">{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );

  const review = session.ai_review;

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
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/admin/proctor/${session.id}/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileDown className="h-3.5 w-3.5" /> Download report (PDF)
          </a>
          <ReviewButton sessionId={session.id} reviewed={!!session.ai_reviewed_at} />
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

      {/* AI integrity review summary (Phase 2) */}
      {review && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ScanFace className="h-4 w-4 text-[#5391D5]" />
            <h2 className="text-sm font-semibold text-[#010131]">AI integrity review</h2>
            <span className="text-xs text-muted-foreground">
              {review.configured
                ? `${review.analyzed} of ${review.total} frames analysed`
                : "AI not configured - motion only"}{" "}
              · {fmt(session.ai_reviewed_at)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryStat label="No face" n={review.no_face} />
            <SummaryStat label="Multiple faces" n={review.multiple_faces} />
            <SummaryStat label="Looking away" n={review.looking_away} />
            <SummaryStat label="Device / screen" n={review.device_or_screen} />
            <SummaryStat label="High motion" n={review.high_motion} />
          </div>
          <p className="mt-2 text-xs italic text-muted-foreground">
            A review aid for a human reviewer - never an automatic pass/fail. Flags reflect the sampled frames.
          </p>
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
          {snapshots.map((snap) => {
            const chips = flagChips(snap.flags);
            return (
              <div key={snap.id} className={`overflow-hidden rounded-lg border bg-card ${borderTone(chips)}`}>
                {snap.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={snap.signedUrl} alt={`Snapshot ${snap.sequence}`} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                    image unavailable
                  </div>
                )}
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-2 pt-1.5">
                    {chips.map((c, i) => (
                      <span
                        key={i}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                          c.tone === "rose" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-muted-foreground">
                  <span>#{snap.sequence}</span>
                  <span>
                    {new Date(snap.captured_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs italic text-muted-foreground">
        Consented periodic snapshots, a client-side motion signal, and an optional AI integrity review (faces /
        looking-away / device). A review aid for a human - never an automatic pass/fail. Images auto-delete 90 days
        after the test.
      </p>
    </div>
  );
}
