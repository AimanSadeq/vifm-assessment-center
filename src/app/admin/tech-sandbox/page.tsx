import Link from "next/link";
import { SlidersHorizontal, BarChart3, ClipboardList, BookOpen, ArrowRight } from "lucide-react";
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
  const quickActions = [
    {
      href: customHref,
      icon: SlidersHorizontal,
      title: "Build a custom assessment",
      desc: "Pick a function, skills and tasks, then assign delegates.",
    },
    {
      href: "/admin/tech-sandbox/results",
      icon: BarChart3,
      title: "View completed results",
      desc: "Scored sittings with per-competency bands.",
    },
    {
      href: "/admin/tech-sandbox/sandbox-blocks",
      icon: ClipboardList,
      title: "Review sandbox tasks",
      desc: "The live spreadsheet, calculation and SQL tasks.",
    },
    {
      href: "/admin/tech-sandbox/answers",
      icon: BookOpen,
      title: "View model answers (admin)",
      desc: "The master answers used to score each task.",
    },
  ];
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
      </div>

      {/* Quick actions - titled card grid so the key tasks are obvious. */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-[#5391D5] hover:shadow-sm"
              >
                <span className="inline-flex shrink-0 rounded-lg bg-[#5391D5]/10 p-2 text-[#5391D5]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{a.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{a.desc}</span>
                </span>
                <ArrowRight className="ms-auto h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-[#5391D5]" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* 1) The framework showcase - demo the breadth, then preview the live one. */}
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

      {/* 2) Distribution - both options, collapsible. */}
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


