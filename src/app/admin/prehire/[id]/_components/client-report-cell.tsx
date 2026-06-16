"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Send, Loader2, Check } from "lucide-react";
import { sendReportToClientAction } from "../../actions";

/**
 * Per-candidate "send report to client" control. Emails the same PDF the admin
 * can download to the requisition's client recipient. Shows a "Sent <date>"
 * marker once delivered (re-sendable). Disabled until a client recipient is set.
 */
export function ClientReportCell({
  candidateId,
  sentAt,
  recipientSet,
  lang,
}: {
  candidateId: string;
  sentAt: string | null;
  recipientSet: boolean;
  lang: "en" | "ar";
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    const res = await sendReportToClientAction({ candidateId, lang });
    setSending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    if (res.data.emailed) {
      toast.success(t("prehire.reportSent", { to: res.data.to }));
    } else {
      // No Graph creds on this server → the report was generated but NOT sent.
      toast.warning(t("prehire.reportNotConfigured", { to: res.data.to }), { duration: 8000 });
    }
    router.refresh();
  };

  const sentLabel = sentAt
    ? new Date(sentAt).toLocaleDateString(lang === "ar" ? "ar" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : null;

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <button
        onClick={send}
        disabled={sending || !recipientSet}
        title={!recipientSet ? t("prehire.setRecipientFirst") : undefined}
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : sentAt ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Send className="h-3.5 w-3.5" />}
        {sentAt ? t("prehire.resend") : t("prehire.sendToClient")}
      </button>
      {sentLabel && <span className="text-[10px] text-muted-foreground">{t("prehire.sentOn", { date: sentLabel })}</span>}
    </div>
  );
}
