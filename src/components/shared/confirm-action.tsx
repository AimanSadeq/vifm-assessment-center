"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type ConfirmActionProps = {
  /** Server action to run when the user confirms. Should return void or { ok, error }. */
  action: () => Promise<void | { ok: boolean; error?: string } | undefined>;
  /** Dialog title — what's about to happen in plain language. */
  title: string;
  /** Body copy — consequences / scope. */
  description: ReactNode;
  /** Confirm button label. */
  confirmLabel?: string;
  /** Cancel button label. */
  cancelLabel?: string;
  /** Toast message on success (silenced if null). */
  successMessage?: string | null;
  /** Variant for the trigger button. */
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /** Size for the trigger button. */
  size?: VariantProps<typeof buttonVariants>["size"];
  /** Extra className for the trigger. */
  className?: string;
  /** Whether the confirm button uses destructive styling (default: true). */
  destructive?: boolean;
  /** Trigger contents. */
  children: ReactNode;
  /** Disable the trigger. */
  disabled?: boolean;
};

/**
 * Reusable AlertDialog confirmation wrapper for destructive or
 * irreversible server actions. Handles useTransition + sonner toasts.
 * Renders its own trigger button — wrap around the thing that would
 * otherwise be a raw <form action={...}><Button>...</Button></form>.
 */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  successMessage = "Done",
  variant = "destructive",
  size = "sm",
  className,
  destructive = true,
  children,
  disabled,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const handleConfirm = () => {
    start(async () => {
      try {
        const result = await action();
        if (result && typeof result === "object" && "ok" in result && !result.ok) {
          toast.error(result.error ?? "Action failed");
          return;
        }
        if (successMessage) toast.success(successMessage);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={pending}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {pending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin me-1" />
                {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
