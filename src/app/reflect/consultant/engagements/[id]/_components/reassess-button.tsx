"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createReflectReassessmentFromPrior } from "@/lib/reflect/actions";

type Props = {
  engagementId: string;
};

export function ReflectReassessButton({ engagementId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carry, setCarry] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await createReflectReassessmentFromPrior({
        priorEngagementId: engagementId,
        carryParticipants: carry,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Land the consultant on the new engagement, in draft, ready to
      // tweak before launch.
      router.push(`/reflect/consultant/engagements/${res.newEngagementId}`);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs"
      >
        <Repeat className="h-3.5 w-3.5 me-1.5" />
        Re-engage cohort
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-card rounded-xl border p-6 max-w-md w-full space-y-4">
            <div>
              <h3 className="text-base font-semibold text-primary">
                Start a reassessment
              </h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Creates a new draft engagement with the same framework. Each
                new participant carries a link to their prior record so the
                report can show year-on-year deltas once the new run scores.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={carry}
                onChange={(e) => setCarry(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong className="text-primary">Carry participants over</strong>
                <span className="block text-xs text-muted-foreground">
                  Copy the prior cohort into the new draft. Raters are NOT
                  carried - each participant invites fresh raters.
                </span>
              </span>
            </label>

            {error && (
              <p className="text-xs text-rose-600">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <Button
                type="button"
                onClick={run}
                disabled={pending}
              >
                {pending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                Create reassessment
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
