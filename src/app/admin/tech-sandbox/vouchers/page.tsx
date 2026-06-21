import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listFunctions } from "@/lib/technical-sandbox/service";
import { listVouchers } from "@/lib/technical-sandbox/vouchers";
import { VouchersClient } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";

export default async function TechVouchersPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const [functions, vouchers] = await Promise.all([listFunctions(true), listVouchers()]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Link href="/admin/tech-sandbox" className="text-sm text-[#5391D5] hover:underline">
        Back to Techno® Sandbox
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Techno® Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Generate access codes for a client to distribute themselves. Each redeemed code provisions a
          sitting and drops the delegate into the assessment. Choose single-use codes (one per
          delegate) or one shared code with a seat pool.
        </p>
      </div>
      {functions.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No active functions yet. Apply migrations 00077 + 00078 to Supabase.
        </p>
      ) : (
        <VouchersClient functions={functions} vouchers={vouchers} />
      )}
    </div>
  );
}
