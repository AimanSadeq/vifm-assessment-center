"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setRedemptionExcludedAction } from "../../actions";

/**
 * Marks one voucher redemption as a test run (out of the cohort) or restores
 * it. Used on the cohort insights page, admin only.
 */
export function ExcludeToggle({
  redemptionId,
  excluded,
  name,
}: {
  redemptionId: string;
  excluded: boolean;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await setRedemptionExcludedAction(redemptionId, !excluded);
      if (!res.ok) {
        toast.error(res.error ?? "Could not update the cohort.");
        return;
      }
      toast.success(excluded ? `${name} is back in the cohort.` : `${name} marked as a test run.`);
      router.refresh();
    });
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 gap-1 px-2 text-xs text-muted-foreground"
      onClick={onClick}
      disabled={pending}
      title={excluded ? "Count this delegate in the cohort again" : "Exclude this run from the cohort (test run)"}
    >
      {excluded ? <Undo2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {excluded ? "Restore" : "Test run"}
    </Button>
  );
}
