import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { listFunctions, getFrameworkOverview } from "@/lib/technical-sandbox/service";
import { listVouchers } from "@/lib/technical-sandbox/vouchers";
import { validateTalentLens } from "@/lib/constants/ara-individual-factors";
import { AdminClient } from "./_components/admin-client";
import { VouchersClient } from "./vouchers/_components/vouchers-client";
import { FrameworkOverview } from "./_components/framework-overview";
import { CollapsibleSection } from "./_components/collapsible-section";

export const dynamic = "force-dynamic";

export default async function TechSandboxAdminPage({
  searchParams,
}: {
  searchParams?: { lens?: string };
}) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  // Talent lens captured from the launching pillar (00135): drives whether the
  // technical report carries the VIFM Academy course block. NULL = development.
  const talentLens = validateTalentLens(searchParams?.lens);
  const customHref = talentLens
    ? `/admin/tech-sandbox/custom?lens=${talentLens}`
    : "/admin/tech-sandbox/custom";
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
        <div className="mt-2 flex flex-wrap gap-4">
          <Link href={customHref} className="text-sm font-medium text-[#5391D5] hover:underline">
            Build a custom assessment →
          </Link>
          <Link href="/admin/tech-sandbox/results" className="text-sm font-medium text-[#5391D5] hover:underline">
            View completed results →
          </Link>
          <Link href="/admin/tech-sandbox/sandbox-blocks" className="text-sm text-[#5391D5] hover:underline">
            Review sandbox tasks →
          </Link>
          <Link href="/admin/tech-sandbox/answers" className="text-sm text-[#5391D5] hover:underline">
            View model answers (admin) →
          </Link>
        </div>
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

      {/* 2) Distribution — both options, collapsible. */}
      {functions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Give delegates access</h2>

          <CollapsibleSection
            tone="blue"
            icon="link"
            title="Option 1 - Direct link per delegate"
            subtitle="You know who is taking it. Issue a personal link to one candidate, or import named delegates (CSV / paste names + emails) for one personal code each."
          >
            <AdminClient functions={functions} talentLens={talentLens} />
          </CollapsibleSection>

          <CollapsibleSection
            tone="green"
            icon="ticket"
            title="Option 2 - Voucher codes (client self-distributes)"
            subtitle="The client wants a batch to hand out - generate single-use codes or one shared seat-pool code; delegates redeem at /tech-sandbox/redeem."
          >
            <VouchersClient functions={functions} vouchers={vouchers} talentLens={talentLens} />
          </CollapsibleSection>
        </section>
      )}
    </div>
  );
}


