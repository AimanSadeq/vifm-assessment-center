import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { EngagementPicker } from "@/components/shared/engagement-picker";

export default async function AssessorAssignmentsListPage() {
  const supabase = await createClient();
  const t = await getServerT();

  const { data: engagements } = await supabase
    .from("engagements")
    .select("id, name, status, target_role, organizations(name)")
    .in("status", ["draft", "active"])
    .order("created_at", { ascending: false });

  const { data: assignments } = await supabase
    .from("assessor_assignments")
    .select("engagement_id");

  const countMap = new Map<string, number>();
  (assignments ?? []).forEach((a) => {
    countMap.set(a.engagement_id, (countMap.get(a.engagement_id) ?? 0) + 1);
  });

  const mapped = (engagements ?? []).map((eng) => ({
    id: eng.id,
    name: eng.name,
    status: eng.status,
    target_role: eng.target_role,
    orgName: (eng.organizations as unknown as { name: string })?.name ?? "-",
    assignmentCount: countMap.get(eng.id) ?? 0,
  }));

  return (
    <EngagementPicker
      title={t("assessorPortal.assignmentsList.title")}
      description={t("assessorPortal.assignmentsList.description")}
      backHref="/assessor"
      backLabel={t("assessorPortal.assignmentsList.backToMissionBoard")}
      engagements={mapped}
      buildHref={(id) => `/assessor/assignments/${id}`}
    />
  );
}
