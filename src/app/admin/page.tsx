export const dynamic = "force-dynamic";
import Link from "next/link";
import { ArrowRight, Sparkles, Compass, Map } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [engR, candR, assignR, obsR, ratR, conR, oarR, repR, wsR] = await Promise.all([
    supabase.from("engagements").select("id"),
    supabase.from("candidates").select("id"),
    supabase.from("assessor_assignments").select("id"),
    supabase.from("observations").select("id"),
    supabase.from("ratings").select("id"),
    supabase.from("consensus_ratings").select("id"),
    supabase.from("overall_assessment_ratings").select("id"),
    supabase.from("candidate_reports").select("id, status"),
    supabase.from("integration_worksheets").select("id"),
  ]);

  const e = engR.data?.length ?? 0, c = candR.data?.length ?? 0, a = assignR.data?.length ?? 0;
  const o = obsR.data?.length ?? 0, r = ratR.data?.length ?? 0, con = conR.data?.length ?? 0;
  const oar = oarR.data?.length ?? 0, rep = repR.data?.length ?? 0, ws = wsR.data?.length ?? 0;
  const rel = repR.data?.filter((x) => x.status === "released").length ?? 0;

  // If exactly one engagement, link directly to it for steps 2-3
  const engDetailHref = e === 1 && engR.data?.[0]?.id
    ? `/admin/engagements/${engR.data[0].id}`
    : "/admin/engagements";

  const steps: ProcessStep[] = [
    { id: "engagements", number: 1, title: "Create Projects", href: "/admin/engagements", iconName: "ClipboardList", metric: e, metricLabel: "projects", isComplete: e > 0, isActive: e === 0 },
    { id: "candidates", number: 2, title: "Add Candidates", href: engDetailHref, iconName: "Users", metric: c, metricLabel: "candidates", isComplete: c > 0, isActive: e > 0 && c === 0 },
    { id: "assessors", number: 3, title: "Assign Assessors", href: engDetailHref, iconName: "UserCheck", metric: a, metricLabel: "assignments", isComplete: a > 0, isActive: c > 0 && a === 0 },
    { id: "observations", number: 4, title: "Project Analytics", href: "/admin/analytics", iconName: "BarChart3", metric: o, metricLabel: "observations", isComplete: o > 0, isActive: a > 0 && o === 0 },
    { id: "integration", number: 5, title: "Integration & Wash-Up", href: "/admin/analytics", iconName: "GitMerge", metric: ws, metricLabel: "worksheets", isComplete: con > 0, isActive: r > 0 && con === 0 },
    { id: "oar", number: 6, title: "Finalize OAR", href: "/admin/analytics", iconName: "Award", metric: oar, metricLabel: "OARs", isComplete: oar > 0, isActive: con > 0 && oar === 0 },
    { id: "reports", number: 7, title: "Release Reports", href: "/admin/engagements", iconName: "FileText", metric: rep, metricLabel: "reports", isComplete: rel > 0, isActive: oar > 0 && rel === 0 },
  ];

  return (
    <>
      {/* ─── Compass-aligned hero strip ─── *
       * Brings the AC admin dashboard into visual parity with /ara/consultant
       * by giving it the same dark navy aurora hero treatment + headline +
       * lightweight call-to-action chips. Deliberately placed ABOVE the
       * existing ProcessMap so the workflow visualisation stays intact. */}
      <section className="ara-hero relative overflow-hidden rounded-2xl mb-6">
        <div className="px-6 py-8 sm:px-8 sm:py-10 relative z-10">
          <span className="ara-eyebrow text-accent">
            <Sparkles className="h-3 w-3" />
            VIFM Assessment Center
          </span>
          <h1 className="ara-numeral text-2xl sm:text-3xl font-semibold text-white leading-[1.1] mt-3 mb-3 max-w-2xl">
            Assessment Center Command
          </h1>
          <p className="text-sm text-white/75 max-w-2xl">
            Track candidate, assessor, and report progress across every stage of
            every engagement — from brief to released report.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <Link
              href="/ac/engage"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/10 hover:bg-white/15 hover:border-white/40 backdrop-blur transition-colors"
            >
              <Compass className="h-3.5 w-3.5" />
              Engagement tiers
            </Link>
            <Link
              href="/ac/roadmap"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/0 hover:bg-white/10 hover:border-white/30 backdrop-blur transition-colors"
            >
              <Map className="h-3.5 w-3.5" />
              Platform roadmap
            </Link>
            <Link
              href="/ara"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors ms-2"
            >
              AI Readiness Compass <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      <ProcessMap
        title="Assessment Center Command"
        subtitle="Continuous assessment cycle - track progress across all stages."
        steps={steps}
        completedCount={steps.filter((s) => s.isComplete).length}
        totalSteps={steps.length}
      />
    </>
  );
}
