export const dynamic = "force-dynamic";
import { Sparkles, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";

export default async function AssessorDashboardPage() {
  const supabase = await createClient();
  const t = await getServerT();

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
    { id: "assignments", number: 1, title: t("assessorPortal.dashboard.steps.reviewAssignments"), href: "/assessor/assignments", iconName: "BookOpen", metric: a, metricLabel: t("assessorPortal.dashboard.metrics.assignments"), isComplete: a > 0, isActive: a === 0 },
    { id: "observe", number: 2, title: t("assessorPortal.dashboard.steps.assessingCandidates"), href: "/assessor/assignments", iconName: "ClipboardCheck", metric: o, metricLabel: t("assessorPortal.dashboard.metrics.observations"), isComplete: o > 0, isActive: a > 0 && o === 0 },
    { id: "rate", number: 3, title: t("assessorPortal.dashboard.steps.rateCompetencies"), href: "/assessor/assignments", iconName: "Star", metric: r, metricLabel: t("assessorPortal.dashboard.metrics.ratings"), isComplete: r > 0, isActive: o > 0 && r === 0 },
    { id: "integrate", number: 4, title: t("assessorPortal.dashboard.steps.completeIntegration"), href: "/assessor/assignments", iconName: "Layers", metric: w, metricLabel: t("assessorPortal.dashboard.metrics.worksheets"), isComplete: w > 0, isActive: r > 0 && w === 0 },
    { id: "washup", number: 5, title: t("assessorPortal.dashboard.steps.joinWashUp"), href: "/assessor/washup", iconName: "Users2", metric: c, metricLabel: t("assessorPortal.dashboard.metrics.consensus"), isComplete: c > 0, isActive: w > 0 && c === 0 },
    { id: "finalize", number: 6, title: t("assessorPortal.dashboard.steps.finalizeOar"), href: "/assessor/washup", iconName: "Award", metric: oar, metricLabel: t("assessorPortal.dashboard.metrics.oars"), isComplete: oar > 0, isActive: c > 0 && oar === 0 },
  ];

  return (
    <>
      <section className="ara-hero relative overflow-hidden rounded-2xl mb-6">
        <div className="px-6 py-8 sm:px-8 sm:py-10 relative z-10">
          <span className="ara-eyebrow text-accent">
            <Sparkles className="h-3 w-3" />
            {t("assessorPortal.dashboard.eyebrow")}
          </span>
          <h1 className="ara-numeral text-2xl sm:text-3xl font-semibold text-white leading-[1.1] mt-3 mb-3 max-w-2xl">
            {t("assessorPortal.dashboard.title")}
          </h1>
          <p className="text-sm text-white/75 max-w-2xl">
            {t("assessorPortal.dashboard.subtitle")}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur">
              <ClipboardCheck className="h-3.5 w-3.5" />
              {t(a === 1 ? "assessorPortal.dashboard.activeAssignments_one" : "assessorPortal.dashboard.activeAssignments_other", { count: a })}
            </span>
          </div>
        </div>
      </section>
      <ProcessMap
        title={t("assessorPortal.dashboard.title")}
        subtitle={t("assessorPortal.dashboard.processSubtitle")}
        steps={steps}
        completedCount={steps.filter((s) => s.isComplete).length}
        totalSteps={steps.length}
      />
    </>
  );
}
