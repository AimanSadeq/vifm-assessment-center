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

export type FunctionOption = { ref: string; name: string; categoryLabel: string };

export function CreateProgramForm({ functions }: { functions: FunctionOption[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [functionRef, setFunctionRef] = useState(functions[0]?.ref ?? "");
  const [busy, setBusy] = useState(false);

  // Group the options by their (already-localized) category label.
  const groups = functions.reduce<Record<string, FunctionOption[]>>((acc, f) => {
    (acc[f.categoryLabel] ??= []).push(f);
    return acc;
  }, {});

  const submit = async () => {
    setBusy(true);
    const res = await createProgramAction({ name, organizationName: org, functionRef });
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
        <div className="w-56 space-y-1.5">
          <Label className="text-xs">{t("techProg.functionLabel")}</Label>
          <select
            value={functionRef}
            onChange={(e) => setFunctionRef(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(groups).map(([label, opts]) => (
              <optgroup key={label} label={label}>
                {opts.map((f) => (
                  <option key={f.ref} value={f.ref}>{f.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Button onClick={submit} disabled={busy || !name.trim() || !org.trim() || !functionRef} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("techProg.create")}
        </Button>
      </CardContent>
    </Card>
  );
}
