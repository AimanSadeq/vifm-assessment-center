import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { buildDashboardTree } from "@/lib/ara/dashboard-tree";
import { ArcDashboard } from "@/components/ara/arc-dashboard";

/**
 * Consultant-facing interactive dashboard for one assessment, at whatever
 * level it sits: a department shows its pillars and people; a division or
 * enterprise adds the units beneath it with drill-down. Same data as the
 * PDF reports (src/lib/ara/dashboard-tree.ts), so the two never disagree.
 */
export const dynamic = "force-dynamic";

export default async function AssessmentDashboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { lang?: string };
}) {
  const sb = createServiceClient();
  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("id, consultant_id")
    .eq("id", params.id)
    .maybeSingle<{ id: string; consultant_id: string | null }>();
  if (!assessment) return notFound();

  // Same ownership rule as the report and rollup pages: the layout gates the
  // role, this gates the row.
  const caller = await getCurrentCaller();
  if (caller && caller.role !== "admin" && assessment.consultant_id !== caller.uid) {
    return notFound();
  }

  const tree = await buildDashboardTree(assessment.id);
  if (!tree) return notFound();

  return (
    <ArcDashboard
      tree={tree}
      initialLang={searchParams?.lang === "ar" ? "ar" : "en"}
      backHref={`/ara/consultant/assessments/${assessment.id}`}
      backLabel={{ en: "Back to assessment", ar: "العودة إلى التقييم" }}
      showPdfLinks
    />
  );
}
