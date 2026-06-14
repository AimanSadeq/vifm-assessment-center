import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listFunctions, getFrameworkOverview } from "@/lib/technical-sandbox/service";
import { listVouchers } from "@/lib/technical-sandbox/vouchers";
import { AdminClient } from "./_components/admin-client";
import { VouchersClient } from "./vouchers/_components/vouchers-client";
import { FrameworkOverview } from "./_components/framework-overview";

export const dynamic = "force-dynamic";

export default async function TechSandboxAdminPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const [functions, vouchers, overview] = await Promise.all([
    listFunctions(true),
    listVouchers(),
    getFrameworkOverview(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <Link href="/admin" className="text-sm text-[#5391D5] hover:underline">
        Back to admin
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Technical Assessment</h1>
        <p className="text-sm text-muted-foreground">
          Performance-based, function-specific assessment across the competency framework below.
          Candidates work in live sandboxes (spreadsheet, calculation, SQL), scored against master
          answers and banded per competency.
        </p>
        <Link href="/admin/tech-sandbox/answers" className="mt-2 inline-block text-sm text-[#5391D5] hover:underline">
          View model answers (admin) →
        </Link>
      </div>

      {/* 1) The framework showcase — demo the breadth, then preview the live one. */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Competency framework</h2>
        {overview.length === 0 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            No framework loaded yet. Apply migration 00077 to Supabase.
          </p>
        ) : (
          <FrameworkOverview domains={overview} />
        )}
      </section>

      {/* 2) Distribution — both options on one page. */}
      {functions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Give delegates access</h2>

          <div className="rounded-md border-s-4 border-[#5391D5] bg-muted/40 p-3">
            <h3 className="text-sm font-semibold text-foreground">Option 1 — Direct link per delegate</h3>
            <p className="text-xs text-muted-foreground">
              You know who is taking it. Create a personal link (and email it once the domain is verified).
            </p>
          </div>
          <AdminClient functions={functions} />

          <div className="mt-2 rounded-md border-s-4 border-emerald-500 bg-muted/40 p-3">
            <h3 className="text-sm font-semibold text-foreground">Option 2 — Voucher codes (client self-distributes)</h3>
            <p className="text-xs text-muted-foreground">
              The client says &ldquo;give me 20&rdquo; and hands them out. Generate single-use codes or one
              shared seat-pool code; delegates redeem at <span className="font-mono">/tech-sandbox/redeem</span>.
            </p>
          </div>
          <VouchersClient functions={functions} vouchers={vouchers} />
        </section>
      )}
    </div>
  );
}


