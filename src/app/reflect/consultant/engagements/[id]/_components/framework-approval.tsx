"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, CircleDashed, Loader2 } from "lucide-react";
import { approveReflectFrameworkAction, revokeReflectFrameworkApprovalAction } from "@/lib/reflect/actions";

/**
 * Consultant sign-off on the AI-decomposed framework. The framework's behaviours
 * are AI-generated from the client's values, so a human must approve them before
 * raters are invited (the launch action enforces this gate server-side). Draft
 * engagements show Approve / Revoke; once launched the approval is locked in.
 */
export function FrameworkApproval({
  engagementId,
  approvedAt,
  isDraft,
}: {
  engagementId: string;
  approvedAt: string | null;
  isDraft: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });

  if (approvedAt) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Framework approved
        </span>
        {isDraft && (
          <button
            type="button"
            onClick={() => run(() => revokeReflectFrameworkApprovalAction(engagementId), "Approval revoked.")}
            disabled={pending}
            className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Revoke
          </button>
        )}
      </span>
    );
  }

  // Not approved. Only actionable while draft (post-launch is grandfathered).
  if (!isDraft) return null;

  return (
    <button
      type="button"
      onClick={() => run(() => approveReflectFrameworkAction(engagementId), "Framework approved.")}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
      title="Review the AI-decomposed behaviours, then approve so raters can be invited"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDashed className="h-3.5 w-3.5" />}
      Approve framework
    </button>
  );
}
