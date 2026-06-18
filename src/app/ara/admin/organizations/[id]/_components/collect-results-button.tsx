"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { collectAndSendOrgResultsAction } from "@/lib/ara/actions";

/**
 * R10 - "Collect all results & email client" button. Confirms, then runs the
 * server action and surfaces the sent/skipped count in a toast. Disabled when
 * there is no client email on file or no completed delegate to collect.
 */
export function CollectResultsButton({
  orgId,
  clientEmail,
  completedCount,
}: {
  orgId: string;
  clientEmail: string | null;
  completedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const disabled = !clientEmail || completedCount < 1;

  const handleConfirm = () => {
    start(async () => {
      try {
        const res = await collectAndSendOrgResultsAction(orgId);
        if (!res.ok) {
          toast.error(res.error ?? "Could not send results.");
          return;
        }
        toast.success(
          `Sent ${res.sent} result${res.sent === 1 ? "" : "s"} to the client contact` +
            (res.skipped > 0 ? ` (${res.skipped} skipped).` : "."),
        );
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not send results.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2" disabled={disabled}>
          <Send className="h-4 w-4" /> Collect all results &amp; email client
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Email collected results to the client</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              This sends one email to <strong>{clientEmail}</strong> with the
              results PDF of every completed delegate attached
              {completedCount > 0 ? ` (${completedCount} so far)` : ""}. Delegates
              are not notified.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin me-1" /> Sending
              </>
            ) : (
              "Send to client"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
