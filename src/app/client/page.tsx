export const dynamic = "force-dynamic";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";

export default async function ClientDashboardPage() {
  const supabase = createServiceClient();
  const orgId = await getClientOrgId();

  // Scope all queries to the client's organization
  let engQuery = supabase.from("engagements").select("id");
  if (orgId) engQuery = engQuery.eq("organization_id", orgId);

  const [engR, candR, oarR, repR] = await Promise.all([
    engQuery,
    supabase.from("candidates").select("id"),
    supabase.from("overall_assessment_ratings").select("id"),
    supabase.from("candidate_reports").select("id, status"),
  ]);

  const e = engR.data?.length ?? 0, c = candR.data?.length ?? 0;
  const oar = oarR.data?.length ?? 0;
  const rel = repR.data?.filter((x) => x.status === "released").length ?? 0;

  const steps: ProcessStep[] = [
    { id: "engagements", number: 1, title: "View Engagements", href: "/client/engagements", iconName: "ClipboardList", metric: e, metricLabel: "engagements", isComplete: e > 0, isActive: e === 0 },
    { id: "candidates", number: 2, title: "Track Candidates", href: "/client/engagements", iconName: "Users", metric: c, metricLabel: "candidates", isComplete: c > 0, isActive: e > 0 && c === 0 },
    { id: "results", number: 3, title: "Review Results", href: "/client/reports", iconName: "BarChart3", metric: oar, metricLabel: "OARs", isComplete: oar > 0, isActive: c > 0 && oar === 0 },
    { id: "reports", number: 4, title: "Access Reports", href: "/client/reports", iconName: "FileText", metric: rel, metricLabel: "released", isComplete: rel > 0, isActive: oar > 0 && rel === 0 },
    { id: "analytics", number: 5, title: "Analyze Talent Pool", href: "/client/analytics", iconName: "TrendingUp", metric: oar, metricLabel: "assessed", isComplete: oar > 0 && rel > 0, isActive: rel > 0 },
  ];

  return <ProcessMap title="Client Engagement Tracker" subtitle="Monitor your assessment center engagement from commissioning to talent insights." steps={steps} completedCount={steps.filter((s) => s.isComplete).length} totalSteps={steps.length} />;
}
