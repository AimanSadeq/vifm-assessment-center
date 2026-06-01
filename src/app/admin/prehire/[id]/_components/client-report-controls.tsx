"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Mail, Send, Loader2, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setRequisitionClientEmailAction, sendAllReportsToClientAction } from "../../actions";

/**
 * Header controls for delivering reports to the client: set the client recipient
 * email (once, per requisition) and "Send all reports" to email every scored
 * candidate's report in one go. VIFM screens; the client receives the reports.
 */
export function ClientReportControls({
  requisitionId,
  currentEmail,
  lang,
}: {
  requisitionId: string;
  currentEmail: string | null;
  lang: "en" | "ar";
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState(currentEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);

  const dirty = email.trim() !== (currentEmail ?? "");
  const hasRecipient = !!(currentEmail ?? "").trim();

  const save = async () => {
    setSaving(true);
    const res = await setRequisitionClientEmailAction(requisitionId, email);
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(t("prehire.recipientSaved"));
    router.refresh();
  };

  const sendAll = async () => {
    setSendingAll(true);
    const res = await sendAllReportsToClientAction(requisitionId, lang);
    setSendingAll(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    if (res.data.configured) {
      toast.success(t("prehire.reportsAllSent", res.data));
    } else {
      toast.warning(t("prehire.reportsNotConfigured"), { duration: 8000 });
    }
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-input bg-muted/20 p-3">
      <div className="flex-1 min-w-[14rem] space-y-1.5">
        <label htmlFor="client-email" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Mail className="h-3.5 w-3.5" /> {t("prehire.clientRecipientLabel")}
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("prehire.clientRecipientPh")}
            className="h-9"
          />
          <Button onClick={save} disabled={saving || !dirty} variant="outline" size="sm" className="shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span className="ms-1">{t("prehire.save")}</span>
          </Button>
        </div>
      </div>
      <Button onClick={sendAll} disabled={sendingAll || !hasRecipient} className="gap-1.5">
        {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sendingAll ? t("prehire.sendingAll") : t("prehire.sendAllReports")}
      </Button>
      {!hasRecipient && (
        <p className="basis-full inline-flex items-center gap-1.5 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {t("prehire.recipientHint")}
        </p>
      )}
    </div>
  );
}
