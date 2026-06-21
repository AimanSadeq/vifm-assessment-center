"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanFace, Loader2 } from "lucide-react";
import { analyzeProctorSessionAction } from "../../actions";

export function ReviewButton({ sessionId, reviewed }: { sessionId: string; reviewed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await analyzeProctorSessionAction(sessionId);
      if (res.ok) {
        toast.success(
          res.summary.configured
            ? `AI review complete - ${res.summary.analyzed} of ${res.summary.total} frame(s) analysed.`
            : "AI review unavailable (no AI key set); motion summary updated."
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#5391D5] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#5391D5]/90 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanFace className="h-3.5 w-3.5" />}
      {reviewed ? "Re-run AI review" : "Run AI integrity review"}
    </button>
  );
}
