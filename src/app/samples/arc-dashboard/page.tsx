import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { buildDashboardTree } from "@/lib/ara/dashboard-tree";
import { ArcDashboard } from "@/components/ara/arc-dashboard";
import { SAMPLE_ORG_NAME, SAMPLE_ENTERPRISE_LABEL } from "@/lib/reports/sample-fixture";

/**
 * Public ARC sample - the interactive dashboard, rendered LIVE from the same
 * fixture as the sample PDFs (Ufuq Digital Authority: enterprise over two
 * divisions over their departments, with the individual layer on one). Until
 * 2026-09-02 this URL served a static HTML mock-up with invented constructs
 * and an embedded JSON tree; it is now the shipped dashboard on real engine
 * output, so what a prospect clicks through is what a client gets.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Readiness Compass - Sample Dashboard | VIFM",
  description: "Interactive organisation-to-person drill-down on a sample organisation, rendered live from the AI Readiness Compass engine.",
};

export default async function SampleDashboardPage({ searchParams }: { searchParams?: { lang?: string } }) {
  const sb = createServiceClient();
  const { data: root } = await sb
    .from("ara_assessments")
    .select("id, organization:ara_organizations!inner(name)")
    .eq("is_sandbox", true)
    .eq("scope_label", SAMPLE_ENTERPRISE_LABEL)
    .eq("organization.name", SAMPLE_ORG_NAME)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!root) return notFound();

  const tree = await buildDashboardTree(root.id);
  if (!tree) return notFound();

  return (
    <ArcDashboard
      tree={tree}
      initialLang={searchParams?.lang === "ar" ? "ar" : "en"}
      backHref="/samples"
      backLabel={{ en: "All samples", ar: "كل النماذج" }}
      sampleNote={{
        en: `Sample data. ${SAMPLE_ORG_NAME} is fictional; its respondents are seeded to illustrate the drill-down. Everything on this page is produced by the same engine as the sample reports.`,
        ar: `بيانات تجريبية. ${SAMPLE_ORG_NAME} مؤسسة افتراضية؛ مستجيبوها مُنشأون لتوضيح التفصيل. كل ما في هذه الصفحة ناتج عن المحرك نفسه الذي ينتج التقارير النموذجية.`,
      }}
    />
  );
}
