"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAraQuestionsSmeStatusAction } from "@/lib/ara/actions";

/**
 * Question-level SME sign-off control (migration 00184). Approving clears the
 * "provisional - content pending SME review" flag on results that served these
 * questions. Scoped to the whole version or a single pillar.
 */
export function SmeReviewBar({
  versionId,
  pillarId,
  pending,
  total,
  label,
}: {
  versionId: string;
  pillarId?: string;
  pending: number;
  total: number;
  label?: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  if (total === 0) return null;
  const allApproved = pending === 0;

  const approve = () =>
    start(async () => {
      const r = await setAraQuestionsSmeStatusAction({ versionId, pillarId, status: "approved" });
      if (r.ok) {
        toast.success(`Approved ${r.count} question(s)${label ? ` in ${label}` : ""}.`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          allApproved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {allApproved ? (
          <>
            <ShieldCheck className="h-3 w-3" /> SME approved
          </>
        ) : (
          `${pending}/${total} pending SME review`
        )}
      </span>
      {pending > 0 && (
        <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={approve}>
          {busy ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="me-1 h-3.5 w-3.5" />}
          {label ? `Approve ${label}` : "Approve all pending"}
        </Button>
      )}
    </span>
  );
}
