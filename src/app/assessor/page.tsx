export const dynamic = "force-dynamic";
import { Sparkles, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";

export default async function AssessorDashboardPage() {
  const supabase = await createClient();

  const [assignR, obsR, ratR, wsR, conR, oarR] = await Promise.all([
    supabase.from("assessor_assignments").select("id"),
    supabase.from("observations").select("id"),
    supabase.from("ratings").select("id"),
    supabase.from("integration_worksheets").select("id"),
    supabase.from("consensus_ratings").select("id"),
    supabase.from("overall_assessment_ratings").select("id"),
  ]);

  const a = assignR.data?.length ?? 0, o = obsR.data?.length ?? 0, r = ratR.data?.length ?? 0;
  const w = wsR.data?.length ?? 0, c = conR.data?.length ?? 0, oar = oarR.data?.length ?? 0;

  const steps: ProcessStep[] = [
    { id: "assignments", number: 1, title: "Review Assignments", href: "/assessor/assignments", iconName: "BookOpen", metric: a, metricLabel: "assignments", isComplete: a > 0, isActive: a === 0 },
    { id: "observe", number: 2, title: "Assessing Candidates", href: "/assessor/assignments", iconName: "ClipboardCheck", metric: o, metricLabel: "observations", isComplete: o > 0, isActive: a > 0 && o === 0 },
    { id: "rate", number: 3, title: "Rate Competencies", href: "/assessor/assignments", iconName: "Star", metric: r, metricLabel: "ratings", isComplete: r > 0, isActive: o > 0 && r === 0 },
    { id: "integrate", number: 4, title: "Complete Integration", href: "/assessor/assignments", iconName: "Layers", metric: w, metricLabel: "worksheets", isComplete: w > 0, isActive: r > 0 && w === 0 },
    { id: "washup", number: 5, title: "Join Wash-Up", href: "/assessor/washup", iconName: "Users2", metric: c, metricLabel: "consensus", isComplete: c > 0, isActive: w > 0 && c === 0 },
    { id: "finalize", number: 6, title: "Finalize OAR", href: "/assessor/washup", iconName: "Award", metric: oar, metricLabel: "OARs", isComplete: oar > 0, isActive: c > 0 && oar === 0 },
  ];

  return (
    <>
      <section className="ara-hero relative overflow-hidden rounded-2xl mb-6">
        <div className="px-6 py-8 sm:px-8 sm:py-10 relative z-10">
          <span className="ara-eyebrow text-accent">
            <Sparkles className="h-3 w-3" />
            VIFM Assessment Center
          </span>
          <h1 className="ara-numeral text-2xl sm:text-3xl font-semibold text-white leading-[1.1] mt-3 mb-3 max-w-2xl">
            Assessor Mission Board
          </h1>
          <p className="text-sm text-white/75 max-w-2xl">
            Your assessment journey - observe, rate, integrate, and reach consensus
            on every candidate you cover.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur">
              <ClipboardCheck className="h-3.5 w-3.5" />
              {a} active assignment{a === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </section>
      <ProcessMap
        title="Assessor Mission Board"
        subtitle="Your assessment journey - observe, rate, integrate, and reach consensus."
        steps={steps}
        completedCount={steps.filter((s) => s.isComplete).length}
        totalSteps={steps.length}
      />
    </>
  );
}
