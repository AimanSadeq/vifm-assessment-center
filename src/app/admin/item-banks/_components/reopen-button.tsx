"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { reopenBankForReviewAction } from "../actions";

/**
 * "Send all back to review" - un-approves a whole bank so an SME can review +
 * edit before re-approving. Two-click confirm (it un-serves the vetted bank
 * until re-approved). The item then falls back to live-AI at deal time, so
 * results are flagged provisional again until re-approved.
 */
export function ReopenButton({ bankKey }: { bankKey: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = () =>
    start(async () => {
      const r = await reopenBankForReviewAction(bankKey);
      if (r.ok) {
        toast.success(`Sent ${r.count} item(s) back to review.`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
      setConfirming(false);
    });

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
      >
        <RotateCcw className="h-3 w-3" /> Send all back to review
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        Confirm - un-approve all
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-[11px] text-muted-foreground hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  );
}
