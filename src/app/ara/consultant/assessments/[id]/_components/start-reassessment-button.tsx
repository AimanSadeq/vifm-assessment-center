"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createReassessmentFromPrior } from "@/lib/ara/consultant-actions";

type Props = {
  priorAssessmentId: string;
  priorYear: number;
};

/**
 * M6 - kicks off an annual reassessment from a completed/frozen/archived
 * assessment. Writes the new draft via createReassessmentFromPrior, then
 * navigates the consultant straight to the new assessment so they can
 * review the carried-forward respondents and send invitations.
 */
export function StartReassessmentButton({ priorAssessmentId, priorYear }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carryRespondents, setCarryRespondents] = useState(true);
  const [pending, start] = useTransition();

  const handleConfirm = () => {
    start(async () => {
      const result = await createReassessmentFromPrior(priorAssessmentId, {
        carryRespondents,
      });
      if (!result.ok || !result.assessmentId) {
        toast.error(result.error ?? "Failed to start reassessment");
        return;
      }
      toast.success("Reassessment created");
      setOpen(false);
      router.push(`/ara/consultant/assessments/${result.assessmentId}`);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="default" className="gap-1">
          <Sparkles className="h-3 w-3" /> Start reassessment
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start an annual reassessment</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Creates a new draft assessment for next year, seeded from this
                {priorYear ? ` ${priorYear}` : ""} baseline. Region, sector,
                stage, scope, default language, and pillar weights carry over.
                The new assessment will use the currently active question bank
                version.
              </p>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={carryRespondents}
                  onChange={(e) => setCarryRespondents(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  Carry respondents over (each gets a fresh access link;
                  invitations are not auto-sent).
                </span>
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin me-1" />
                Creating
              </>
            ) : (
              "Create reassessment"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
