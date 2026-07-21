import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listAssessableFunctions } from "@/lib/technical-sandbox/service";
import { functionsReadinessSummary } from "@/lib/competencies/technical-function-bank";
import { listVouchers } from "@/lib/technical-sandbox/vouchers";
import { loadPlatformClients } from "@/lib/clients/registry";
import { VoucherNav } from "@/components/shared/voucher-nav";
import { VouchersClient } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";

export default async function TechVouchersPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const [functions, vouchers] = await Promise.all([listAssessableFunctions(), listVouchers()]);
  // "Live questions" check: per function, will a sitting draw from the
  // SME-approved bank (certifiable) or fall back to AI generation (indicative)?
  const readiness = await functionsReadinessSummary(
    functions.map((f) => ({ id: f.id, skillsEn: f.skillsEn ?? [] }))
  ).catch(() => ({}));
  const clients = (await loadPlatformClients().catch(() => [])).map((c) => c.name);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Link href="/admin/tech-sandbox" className="text-sm text-[#5391D5] hover:underline">
        Back to Techno® Sandbox
      </Link>
      <VoucherNav active="techno" />
      {functions.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No active functions yet. Apply migrations 00077 + 00078 to Supabase.
        </p>
      ) : (
        <VouchersClient functions={functions} vouchers={vouchers} clients={clients} readiness={readiness} />
      )}
    </div>
  );
}
