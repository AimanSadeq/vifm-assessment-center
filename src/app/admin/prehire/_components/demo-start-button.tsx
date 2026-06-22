"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Rocket, Loader2 } from "lucide-react";
import { startPrehireDemoAction } from "../actions";

/**
 * One-click self-serve start for the Pre-Hire candidate experience (demo aid).
 * Auto-provisions a throwaway demo requisition + candidate, then drops straight
 * into the real apply flow - no requisition wizard, no invite link or voucher.
 */
export function DemoStartButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startPrehireDemoAction();
          if ("error" in res) {
            toast.error(res.error);
            return;
          }
          router.push(`/prehire/apply/${res.data.token}`);
        })
      }
      className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60"
      title="Start the candidate experience now - no link or voucher needed"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
      Start demo screening
    </button>
  );
}
