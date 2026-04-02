export const dynamic = "force-dynamic";
import { createServiceClient } from "@/lib/supabase/server";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";

export default async function AdminDashboardPage() {
  const supabase = createServiceClient();

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
    { id: "engagements", number: 1, title: "Create Engagements", href: "/admin/engagements", iconName: "ClipboardList", metric: e, metricLabel: "engagements", isComplete: e > 0, isActive: e === 0 },
    { id: "candidates", number: 2, title: "Add Candidates", href: engDetailHref, iconName: "Users", metric: c, metricLabel: "candidates", isComplete: c > 0, isActive: e > 0 && c === 0 },
    { id: "assessors", number: 3, title: "Assign Assessors", href: engDetailHref, iconName: "UserCheck", metric: a, metricLabel: "assignments", isComplete: a > 0, isActive: c > 0 && a === 0 },
    { id: "observations", number: 4, title: "Monitor Observations", href: "/admin/analytics", iconName: "Eye", metric: o, metricLabel: "observations", isComplete: r > 0, isActive: a > 0 && o === 0 },
    { id: "integration", number: 5, title: "Integration & Wash-Up", href: "/admin/analytics", iconName: "GitMerge", metric: ws, metricLabel: "worksheets", isComplete: con > 0, isActive: r > 0 && con === 0 },
    { id: "oar", number: 6, title: "Finalize OAR", href: "/admin/analytics", iconName: "Award", metric: oar, metricLabel: "OARs", isComplete: oar > 0, isActive: con > 0 && oar === 0 },
    { id: "reports", number: 7, title: "Release Reports", href: "/admin/engagements", iconName: "FileText", metric: rep, metricLabel: "reports", isComplete: rel > 0, isActive: oar > 0 && rel === 0 },
  ];

  return <ProcessMap title="Assessment Center Command" subtitle="Continuous assessment cycle — track progress across all stages." steps={steps} completedCount={steps.filter((s) => s.isComplete).length} totalSteps={steps.length} />;
}
