"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { archiveReflectEngagement } from "@/lib/reflect/actions";

/**
 * Archive a finished engagement. Archiving stamps archived_at, which is what the
 * retention purge matches - without it the 2-year PDPL purge could never run.
 */
export function ReflectArchiveButton({ engagementId }: { engagementId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await archiveReflectEngagement(engagementId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
        title="Archive this engagement (starts the retention clock)"
      >
        <Archive className="h-3.5 w-3.5" /> Archive
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6">
            <div>
              <h3 className="text-base font-semibold text-primary">Archive engagement?</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Archiving closes the engagement and starts its retention clock. Rater responses and
                reports are kept, then permanently deleted once past the retention window. Raters can
                no longer submit. This cannot be undone.
              </p>
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-3 py-2 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
