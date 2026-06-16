"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Loader2 } from "lucide-react";
import { addCandidateAction, inviteAllPendingAction } from "../../actions";
import { copyToClipboard } from "@/lib/utils/clipboard";

export function AddCandidateForm({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invitingAll, setInvitingAll] = useState(false);

  const handleInviteAll = async () => {
    setInvitingAll(true);
    const res = await inviteAllPendingAction(requisitionId);
    setInvitingAll(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data.total === 0 ? t("prehire.invitedNone") : t("prehire.invitedAllResult", res.data));
    router.refresh();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await addCandidateAction({
      requisition_id: requisitionId,
      full_name: fullName,
      email,
      phone: phone || undefined,
      employee_id: employeeId || undefined,
    });
    setSubmitting(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    const link = `${window.location.origin}/prehire/apply/${res.data.access_token}`;
    if (res.data.emailed) {
      toast.success(t("prehire.addedEmailed", { email }), { duration: 6000 });
    } else {
      toast.success(t("prehire.addedCopied"), {
        duration: 7000,
      });
    }
    try {
      await copyToClipboard(link);
    } catch {
      /* clipboard may be unavailable; link is shown via the toast */
    }
    setFullName("");
    setEmail("");
    setPhone("");
    setEmployeeId("");
    router.refresh();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label htmlFor="cand-name">{t("prehire.candNameLabel")}</Label>
            <Input id="cand-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("prehire.candNamePh")} />
          </div>
          <div className="flex-1 min-w-[12rem] space-y-1.5">
            <Label htmlFor="cand-email">{t("prehire.emailLabel")}</Label>
            <Input id="cand-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="w-36 space-y-1.5">
            <Label htmlFor="cand-phone">{t("prehire.phoneLabel")}</Label>
            <Input id="cand-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("prehire.phonePh")} />
          </div>
          <div className="w-36 space-y-1.5">
            <Label htmlFor="cand-empid">{t("prehire.employeeIdLabel")}</Label>
            <Input id="cand-empid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder={t("prehire.employeeIdPh")} />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !fullName || !email} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            {submitting ? t("prehire.adding") : t("prehire.addCandidate")}
          </Button>
          <Button variant="outline" onClick={handleInviteAll} disabled={invitingAll} className="gap-1.5">
            {invitingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {invitingAll ? t("prehire.invitingAll") : t("prehire.inviteAll")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
