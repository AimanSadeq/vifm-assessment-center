import { createServiceClient } from "@/lib/supabase/server";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { loadVoucherBlock } from "@/lib/vouchers/status";
import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";

// Audit fix (Techno UX): never accept name/email/company from the URL query
// string - PII in a URL leaks via browser history, server logs, and the
// Referer header, and a forwarded link would expose the recipient's details.
// We accept ONLY the voucher `code` and resolve the assigned recipient's
// prefill values SERVER-SIDE from the voucher row (mirrors the ARC pattern).
export default async function RedeemPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code?.trim() ?? "";

  let initialName = "";
  let initialEmail = "";
  let initialCompany = "";
  if (code) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("technical_sandbox_vouchers")
        .select("assigned_name, assigned_email, organization_name")
        .eq("code", code.toUpperCase())
        .maybeSingle<{
          assigned_name: string | null;
          assigned_email: string | null;
          organization_name: string | null;
        }>();
      initialName = data?.assigned_name || "";
      initialEmail = data?.assigned_email || "";
      initialCompany = data?.organization_name || "";
    } catch {
      /* tolerant - leave prefills blank if the lookup fails */
    }
  }

  // Surface a spent/expired/deactivated code before the delegate fills the
  // form in, rather than after they submit it (shared with every service).
  const blocked = await loadVoucherBlock("technical", code);
  if (blocked) {
    return (
      <div className="mx-auto max-w-md p-6">
        <VoucherBlockedCard block={blocked} code={code} redeemPath="/tech-sandbox/redeem" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-1 text-xs uppercase tracking-wide text-accent">VIFM · Techno</div>
        <h1 className="text-lg font-semibold text-foreground">Redeem your access code</h1>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Enter your voucher code and details to begin the assessment. It is timed once you start.
        </p>
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your voucher code can be used only once. Start only when you are ready to complete the assessment in one sitting.
        </p>
        <RedeemForm
          initialCode={code}
          initialName={initialName}
          initialEmail={initialEmail}
          initialCompany={initialCompany}
        />
      </div>
    </div>
  );
}
