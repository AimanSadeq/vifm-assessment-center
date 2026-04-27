export const dynamic = "force-dynamic";
import { Sparkles, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";

export default async function ClientDashboardPage() {
  const supabase = await createClient();
  const orgId = await getClientOrgId();

  // Scope all queries to the client's organization
  let engQuery = supabase.from("engagements").select("id");
  if (orgId) engQuery = engQuery.eq("organization_id", orgId);

  const engR = await engQuery;
  const engIds = (engR.data ?? []).map((e) => e.id);

  // All downstream queries scoped to org's engagement IDs
  const [candR, oarR, repR] = engIds.length > 0
    ? await Promise.all([
        supabase.from("candidates").select("id").in("engagement_id", engIds),
        supabase.from("overall_assessment_ratings").select("id").in("engagement_id", engIds),
        supabase.from("candidate_reports").select("id, status").in("engagement_id", engIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const e = engIds.length, c = (candR.data ?? []).length;
  const oar = (oarR.data ?? []).length;
  const rel = (repR.data ?? []).filter((x: Record<string, unknown>) => x.status === "released").length;

  const steps: ProcessStep[] = [
    { id: "engagements", number: 1, title: "View Engagements", href: "/client/engagements", iconName: "ClipboardList", metric: e, metricLabel: "engagements", isComplete: e > 0, isActive: e === 0 },
    { id: "candidates", number: 2, title: "Track Candidates", href: "/client/engagements", iconName: "Users", metric: c, metricLabel: "candidates", isComplete: c > 0, isActive: e > 0 && c === 0 },
    { id: "results", number: 3, title: "Review Results", href: "/client/reports", iconName: "BarChart3", metric: oar, metricLabel: "OARs", isComplete: oar > 0, isActive: c > 0 && oar === 0 },
    { id: "reports", number: 4, title: "Access Reports", href: "/client/reports", iconName: "FileText", metric: rel, metricLabel: "released", isComplete: rel > 0, isActive: oar > 0 && rel === 0 },
    { id: "analytics", number: 5, title: "Analyze Talent Pool", href: "/client/analytics", iconName: "TrendingUp", metric: oar, metricLabel: "assessed", isComplete: oar > 0 && rel > 0, isActive: rel > 0 },
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
            Client Engagement Tracker
          </h1>
          <p className="text-sm text-white/75 max-w-2xl">
            Monitor your assessment center engagement from commissioning through to
            released reports and talent-pool analytics.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur">
              <ClipboardList className="h-3.5 w-3.5" />
              {e} engagement{e === 1 ? "" : "s"} · {c} candidate{c === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </section>
      <ProcessMap
        title="Client Engagement Tracker"
        subtitle="Monitor your assessment center engagement from commissioning to talent insights."
        steps={steps}
        completedCount={steps.filter((s) => s.isComplete).length}
        totalSteps={steps.length}
      />
    </>
  );
}
