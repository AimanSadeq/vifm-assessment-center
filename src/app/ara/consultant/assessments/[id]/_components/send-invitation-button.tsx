"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { sendAraRespondentInvitation } from "@/lib/ara/actions";

type Props = {
  respondentId: string;
  /** When true, the button shows a sandbox warning tone - set from is_sandbox on the assessment. */
  isSandbox?: boolean;
  alreadySent?: boolean;
};

export function SendInvitationButton({ respondentId, isSandbox = false, alreadySent = false }: Props) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await sendAraRespondentInvitation(respondentId);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to send invitation");
        return;
      }
      toast.success(
        isSandbox ? "Invitation queued (sandbox redirect)" : "Invitation sent"
      );
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={
        isSandbox
          ? "Send invitation (sandbox - recipient overridden to SANDBOX_EMAIL_REDIRECT)"
          : alreadySent
            ? "Re-send invitation"
            : "Send invitation"
      }
      className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
      {alreadySent ? "Re-send" : "Send invite"}
    </button>
  );
}
