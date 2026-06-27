"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminVoucherIssuer, type AdminVoucherRow } from "@/components/shared/admin-voucher-issuer";
import {
  generateCognitiveVouchersAction,
  disableCognitiveVoucherAction,
  emailExistingVoucherCodeAction,
} from "../actions";

export type CognitiveVoucherRow = AdminVoucherRow & { default_language: "en" | "ar" };

// Thin wrapper over the shared admin voucher issuer (consolidation - admin side).
// Logica options: a project/cohort label (groups with Persona) + UI language.
export function VouchersClient({ vouchers, clients }: { vouchers: CognitiveVoucherRow[]; clients: string[] }) {
  const [projectLabel, setProjectLabel] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");

  return (
    <AdminVoucherIssuer
      redeemPath="/ac/cognitive/redeem"
      clients={clients}
      vouchers={vouchers}
      optionsLabel="Logica"
      options={
        <>
          <div className="flex-1 min-w-[12rem] space-y-1.5">
            <Label className="text-xs">Project / cohort (optional)</Label>
            <Input value={projectLabel} onChange={(e) => setProjectLabel(e.target.value)} placeholder="Groups with Persona for reporting" />
          </div>
          <div className="w-32 space-y-1.5">
            <Label className="text-xs">Language</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value === "ar" ? "ar" : "en")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </>
      }
      onGenerate={async (c) => {
        const res = await generateCognitiveVouchersAction({
          count: c.count,
          label: c.label || undefined,
          clientName: c.clientName || undefined,
          projectLabel: projectLabel || undefined,
          maxUses: c.maxUses,
          expiresAt: c.expiresAt,
          contactName: c.contactName || undefined,
          contactTitle: c.contactTitle || undefined,
          contactEmail: c.contactEmail || undefined,
        });
        return "error" in res ? { error: res.error } : { codes: res.codes };
      }}
      onDisable={async (id) => {
        const res = await disableCognitiveVoucherAction(id);
        return "error" in res ? { error: res.error } : { ok: true };
      }}
      onEmailRow={async (code) => {
        const email = window.prompt("Email this code to which address?");
        if (!email) return;
        const res = await emailExistingVoucherCodeAction({ code, email, language });
        if ("error" in res) toast.error(res.error);
        else toast.success(`Sent to ${email.trim()}.`);
      }}
    />
  );
}
