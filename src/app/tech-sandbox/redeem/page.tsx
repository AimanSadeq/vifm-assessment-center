import { createServiceClient } from "@/lib/supabase/server";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { loadVoucherBlock } from "@/lib/vouchers/status";
import { TechnoRedeemPageClient } from "./_components/redeem-page-client";

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
      <TechnoRedeemPageClient
        initialCode={code}
        initialName={initialName}
        initialEmail={initialEmail}
        initialCompany={initialCompany}
      />
    </div>
  );
}
