import { createServiceClient } from "@/lib/supabase/server";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { loadVoucherBlock } from "@/lib/vouchers/status";
import { loadBundleSettings } from "@/lib/bespoke/bundle-settings";
import { RedeemClient } from "./redeem-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem · Bespoke Assessment · VIFM" };

export default async function BundleRedeemPage({
  searchParams,
}: {
  searchParams?: { code?: string };
}) {
  const code = (searchParams?.code ?? "").trim();

  // Prefill name/email from the VOUCHER ROW (server-side) - never from URL params,
  // so a crafted link can't pre-fill an arbitrary identity. Only for an unused
  // single-seat (individual) voucher.
  let namePrefill = "";
  let emailPrefill = "";
  // The bundle's delivery settings decide the screen: an approved-list link asks
  // for the email only (the roster holds the name), and a client logo shows.
  let emailOnly = false;
  let clientLogoUrl: string | null = null;
  if (code) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("bundle_vouchers")
        .select("bespoke_service_id, recipient_name, recipient_email, max_uses, uses")
        .eq("code", code.toUpperCase())
        .maybeSingle<{ bespoke_service_id: string; recipient_name: string | null; recipient_email: string | null; max_uses: number; uses: number }>();
      if (data && data.max_uses === 1 && data.uses < data.max_uses) {
        namePrefill = data.recipient_name ?? "";
        emailPrefill = data.recipient_email ?? "";
      }
      if (data?.bespoke_service_id) {
        const settings = await loadBundleSettings(data.bespoke_service_id);
        emailOnly = settings.rosterRequired;
        clientLogoUrl = settings.clientLogoUrl;
      }
    } catch {
      /* tolerant - the form still validates the code on submit */
    }
  }

  const blocked = await loadVoucherBlock("bundle", code);
  if (blocked) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <VoucherBlockedCard block={blocked} code={code} redeemPath="/bundle/redeem" />
      </div>
    );
  }

  return (
    <RedeemClient
      code={code}
      emailPrefill={emailPrefill}
      namePrefill={namePrefill}
      emailOnly={emailOnly}
      clientLogoUrl={clientLogoUrl}
    />
  );
}
