"use client";

import { useTransition } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await sendAraRespondentInvitation(respondentId);
      if (!result.ok) {
        toast.error(result.error ?? t("araAssessmentDetail.invite_send_failed"));
        return;
      }
      toast.success(
        isSandbox
          ? t("araAssessmentDetail.invite_queued_sandbox")
          : t("araAssessmentDetail.invite_sent")
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
          ? t("araAssessmentDetail.invite_title_sandbox")
          : alreadySent
            ? t("araAssessmentDetail.invite_title_resend")
            : t("araAssessmentDetail.invite_title_send")
      }
      className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
      {alreadySent ? t("araAssessmentDetail.invite_resend") : t("araAssessmentDetail.invite_send")}
    </button>
  );
}
