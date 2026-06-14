import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listFunctions } from "@/lib/technical-sandbox/service";
import { AdminClient } from "./_components/admin-client";

export const dynamic = "force-dynamic";

export default async function TechSandboxAdminPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const functions = await listFunctions(true);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link href="/admin" className="text-sm text-[#5391D5] hover:underline">
        Back to admin
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Technical Assessment (Sandbox)</h1>
        <p className="text-sm text-muted-foreground">
          Performance-based, function-specific assessment. Issue a token link; the candidate works in
          live sandboxes (spreadsheet, logic, SQL) and is scored against master answers and banded
          per competency.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          <Link href="/admin/tech-sandbox/vouchers" className="text-sm text-[#5391D5] hover:underline">
            Voucher codes (client self-distribute) →
          </Link>
          <Link href="/admin/tech-sandbox/answers" className="text-sm text-[#5391D5] hover:underline">
            View model answers (admin) →
          </Link>
        </div>
      </div>
      {functions.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No active functions yet. Apply migration 00077 to seed FP&amp;A 1.7.
        </p>
      ) : (
        <AdminClient functions={functions} />
      )}
    </div>
  );
}
