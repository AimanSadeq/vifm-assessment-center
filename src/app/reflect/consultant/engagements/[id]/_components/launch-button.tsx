"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Rocket, Loader2 } from "lucide-react";
import { launchReflectEngagement } from "@/lib/reflect/actions";

/**
 * Launch a DRAFT engagement from the detail page. Previously launch only existed
 * in the wizard's final step, so a draft you navigated away from could never go
 * live (no invitations sent). This surfaces the same launch + invite-all action
 * anywhere. The server action enforces the guard (>= 1 participant + 1 rater).
 */
export function LaunchButton({ engagementId }: { engagementId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const launch = () => {
    start(async () => {
      const res = await launchReflectEngagement(engagementId);
      if (res.ok) {
        const n = res.invited ?? 0;
        toast.success(
          `Engagement launched - ${n} invitation${n === 1 ? "" : "s"} sent${res.failed ? `, ${res.failed} failed` : ""}.`
        );
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(res.error);
        setConfirming(false);
      }
    });
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
      >
        <Rocket className="h-3.5 w-3.5" /> Launch engagement
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={launch}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Launching...
          </>
        ) : (
          "Confirm launch + send invites"
        )}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  );
}
