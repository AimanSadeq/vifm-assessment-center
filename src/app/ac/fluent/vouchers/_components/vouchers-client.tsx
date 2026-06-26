"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { AdminVoucherIssuer, type AdminVoucherRow } from "@/components/shared/admin-voucher-issuer";
import { generateFluentVouchersAction, disableFluentVoucherAction } from "../actions";

export type FluentVoucherRow = AdminVoucherRow & {
  default_language: "en" | "ar";
  proctor_enabled: boolean;
};

// Thin wrapper over the shared admin voucher issuer (consolidation - admin side).
// Fluent's only per-service option is camera proctoring.
export function VouchersClient({ vouchers, clients }: { vouchers: FluentVoucherRow[]; clients: string[] }) {
  const [proctor, setProctor] = useState(false);

  return (
    <AdminVoucherIssuer
      redeemPath="/ac/fluent/redeem"
      clients={clients}
      vouchers={vouchers}
      options={
        <label className="flex cursor-pointer items-center gap-2 self-center pt-4" title="Candidates redeeming these vouchers will be camera-proctored">
          <input
            type="checkbox"
            checked={proctor}
            onChange={(e) => setProctor(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-accent"
          />
          <span className="inline-flex items-center gap-1 text-xs text-foreground">
            <Camera className="h-3.5 w-3.5 text-accent" /> Require camera proctoring
          </span>
        </label>
      }
      onGenerate={async (c) => {
        const res = await generateFluentVouchersAction({
          count: c.count,
          label: c.label || undefined,
          clientName: c.clientName || undefined,
          maxUses: c.maxUses,
          expiresAt: c.expiresAt,
          proctorEnabled: proctor,
        });
        return "error" in res ? { error: res.error } : { codes: res.codes };
      }}
      onDisable={async (id) => {
        const res = await disableFluentVoucherAction(id);
        return "error" in res ? { error: res.error } : { ok: true };
      }}
      rowBadge={(v) =>
        (v as FluentVoucherRow).proctor_enabled ? (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent" title="Camera-proctored">
            <Camera className="h-3 w-3" /> Proctored
          </span>
        ) : null
      }
    />
  );
}
