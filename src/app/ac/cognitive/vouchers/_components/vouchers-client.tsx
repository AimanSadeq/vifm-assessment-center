"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminVoucherIssuer, type AdminVoucherRow } from "@/components/shared/admin-voucher-issuer";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import {
  generateCognitiveVouchersAction,
  disableCognitiveVoucherAction,
  emailExistingVoucherCodeAction,
} from "../actions";

export type CognitiveVoucherRow = AdminVoucherRow & { default_language: "en" | "ar" };

// Thin wrapper over the shared admin voucher issuer (consolidation - admin side).
// Logica options: a project/cohort label (groups with Persona), UI language, and
// a subtest scope (issue a voucher for e.g. Inductive Reasoning only).
export function VouchersClient({
  vouchers,
  clients,
  initialSubtests,
}: {
  vouchers: CognitiveVoucherRow[];
  clients: string[];
  /** Prefill for the subtest scope (e.g. from /ac/cognitive "Issue voucher for this selection"). */
  initialSubtests?: string[];
}) {
  const [projectLabel, setProjectLabel] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [subtests, setSubtests] = useState<string[]>(() => {
    const valid = COGNITIVE_SUBTEST_KEYS.filter((k) => initialSubtests?.includes(k));
    return valid.length > 0 ? valid : [...COGNITIVE_SUBTEST_KEYS];
  });
  const toggleSubtest = (key: string) =>
    setSubtests((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : COGNITIVE_SUBTEST_KEYS.filter((k) => prev.includes(k) || k === key)
    );

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
          <div className="w-full space-y-1.5">
            <Label className="text-xs">Subtest scope</Label>
            <div className="flex flex-wrap gap-2">
              {COGNITIVE_SUBTESTS.map((s) => {
                const on = subtests.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSubtest(s.key)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      on
                        ? "border-[#5391D5] bg-[#5391D5] text-white"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {s.name_en}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {subtests.length === 0
                ? "Pick at least one subtest."
                : subtests.length === COGNITIVE_SUBTEST_KEYS.length
                  ? "Full battery (all four subtests)."
                  : `Delegates get only: ${subtests
                      .map((k) => COGNITIVE_SUBTESTS.find((s) => s.key === k)?.name_en ?? k)
                      .join(" · ")}.`}
            </p>
          </div>
        </>
      }
      onGenerate={async (c) => {
        if (subtests.length === 0) return { error: "Pick at least one subtest for the voucher scope." };
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
          subtests,
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
