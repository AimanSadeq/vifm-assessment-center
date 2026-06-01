"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { createProgramAction } from "../actions";

const TIERS = ["department", "division", "enterprise"] as const;

export function CreateProgramForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("department");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await createProgramAction({ name, organizationName: org, tier });
    setBusy(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(t("techProg.created"));
    router.push(`/admin/tech-assessment/programs/${res.id}`);
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 pt-6">
        <div className="flex-1 min-w-[12rem] space-y-1.5">
          <Label className="text-xs">{t("techProg.nameLabel")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("techProg.namePh")} />
        </div>
        <div className="flex-1 min-w-[12rem] space-y-1.5">
          <Label className="text-xs">{t("techProg.orgLabel")}</Label>
          <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder={t("techProg.orgPh")} />
        </div>
        <div className="w-44 space-y-1.5">
          <Label className="text-xs">{t("techProg.tierLabel")}</Label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as (typeof TIERS)[number])}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {TIERS.map((tk) => (
              <option key={tk} value={tk}>{t(`techProg.tiers.${tk}`)}</option>
            ))}
          </select>
        </div>
        <Button onClick={submit} disabled={busy || !name.trim() || !org.trim()} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("techProg.create")}
        </Button>
      </CardContent>
    </Card>
  );
}
